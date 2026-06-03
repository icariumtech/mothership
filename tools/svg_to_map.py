#!/usr/bin/env python3
"""
svg_to_map.py — Convert Inkscape SVG maps to YAML encounter map format.

Usage:
    python tools/svg_to_map.py <svg_file> [options]

Options:
    --out-dir DIR    Location directory (default: <svg_dir>/<stem>_out/)
                     Map files are written to <out-dir>/map/.
                     A stub location.yaml is created if none exists.
    --deck NAME      Deck YAML filename stem (default: main_deck).
                     Ignored in multi-deck mode (deck IDs come from layer labels).
    --name NAME      Map/location name (default: derived from SVG filename)
    --type TYPE      Location type for stub location.yaml (default: ship)
    --unit-size N    Pixels per grid cell written to deck YAML (default: 30).
    --grid-scale N   Group N Inkscape grid cells into 1 output cell (default: 1).
                     Use this when rooms have too many cells and tokens/text
                     look tiny. Run once without it; the script prints room
                     dimensions — aim for rooms ~5-12 cells wide.
                     Example: if Engineering is 40 cells wide, use --grid-scale 5
                     to output it as 8 cells wide.
    --detect-doors   Detect doors from shared edges between rooms/corridors,
                     and between touching corridors.

SVG layer convention — single-deck (backwards compatible):
    Hull       — ship outer hull polygon (optional, single path)
    Rooms      — room polygons; each path has inkscape:label = room name
    Corridors  — corridor polygons (name="" in output)

SVG layer convention — multi-deck:
    Hull           — ship outer hull polygon (optional, single path)
    <Deck label>   — one layer per deck (e.g. "Main Deck", "Engineering Deck")
      Rooms        — room polygons within this deck
      Corridors    — corridor polygons within this deck
    <Deck label 2>
      Rooms
      Corridors
    (etc.)
    Multi-deck is auto-detected: if any top-level layer contains Rooms or
    Corridors sublayers, multi-deck mode is used; otherwise single-deck mode.
    Deck IDs in output are derived from the layer label (snake_cased).
    Decks are ordered by their document order; the first deck is the default.

Grid unit:
    Read from inkscape:grid spacingx attribute (px per cell).
    All SVG px coordinates are divided by this unit (then by --grid-scale).
    Output values are rounded to the nearest 0.5 grid cell.

Output files:
    location.yaml         Created once if missing; never overwritten
    map/manifest.yaml     Multi-deck manifest with optional hull polygon
    map/<deck>.yaml       One file per deck with rooms, corridors, and doors
"""

import argparse
import math
import os
import re
import sys
import xml.etree.ElementTree as ET

# ── Namespaces ──────────────────────────────────────────────────────────────

SVG = "http://www.w3.org/2000/svg"
INK = "http://www.inkscape.org/namespaces/inkscape"

# ── SVG path parser ──────────────────────────────────────────────────────────

_TOKEN_RE = re.compile(
    r"[MmLlHhVvZz]|[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?"
)

# SVG curve/arc commands that parse_path_d does not handle.
_CURVE_CMD_RE = re.compile(r"[CcSsQqTtAa]")


def parse_path_d(d: str, *, label: str = "") -> list[tuple[float, float]]:
    """Parse SVG path 'd' attribute into absolute (x, y) polygon vertices.

    Supports M m L l H h V v Z z commands.
    After 'm', subsequent implicit pairs are treated as 'l' (relative lineto).
    Closing duplicate vertex and consecutive duplicates are removed.

    Emits a warning to stderr and returns an empty vertex list if the path
    contains curve or arc commands (C c S s Q q T t A a) — these would
    silently garble the polygon if not caught here. Re-export the SVG from
    Inkscape with "Object to Path" + straight segments only.
    """
    curve_match = _CURVE_CMD_RE.search(d)
    if curve_match:
        ctx = f" (label: {label!r})" if label else ""
        print(
            f"WARNING: SVG path{ctx} contains unsupported curve command "
            f"'{curve_match.group()}' — skipping. "
            "Re-export with straight segments only (Path > Object to Path, "
            "then Extensions > Generate from Path > ... or Inkscape 'Flatten Beziers').",
            file=sys.stderr,
        )
        return []
    tokens = _TOKEN_RE.findall(d)
    vertices: list[tuple[float, float]] = []
    cx = cy = 0.0
    start_x = start_y = 0.0
    cmd: str | None = None
    i = 0

    while i < len(tokens):
        t = tokens[i]

        if t in "MmLlHhVvZz":
            cmd = t
            i += 1
            if cmd in ("Z", "z"):
                cx, cy = start_x, start_y
            continue

        v = float(t)

        if cmd == "M":
            cx, cy = v, float(tokens[i + 1]); i += 2
            start_x, start_y = cx, cy
            vertices.append((cx, cy))
            cmd = "L"  # subsequent pairs are implicit lineto

        elif cmd == "m":
            cx += v; cy += float(tokens[i + 1]); i += 2
            start_x, start_y = cx, cy
            vertices.append((cx, cy))
            cmd = "l"  # subsequent pairs are implicit relative lineto

        elif cmd == "L":
            cx, cy = v, float(tokens[i + 1]); i += 2
            vertices.append((cx, cy))

        elif cmd == "l":
            cx += v; cy += float(tokens[i + 1]); i += 2
            vertices.append((cx, cy))

        elif cmd == "H":
            cx = v; i += 1
            vertices.append((cx, cy))

        elif cmd == "h":
            cx += v; i += 1
            vertices.append((cx, cy))

        elif cmd == "V":
            cy = v; i += 1
            vertices.append((cx, cy))

        elif cmd == "v":
            cy += v; i += 1
            vertices.append((cx, cy))

        else:
            i += 1  # unknown token

    # Remove closing duplicate (last == first)
    if len(vertices) > 1 and _approx_eq(vertices[-1], vertices[0]):
        vertices = vertices[:-1]

    # Remove consecutive duplicates (e.g. from 'v 0')
    deduped: list[tuple[float, float]] = []
    for pt in vertices:
        if not deduped or not _approx_eq(pt, deduped[-1]):
            deduped.append(pt)

    return deduped


def _approx_eq(a: tuple[float, float], b: tuple[float, float], tol: float = 1e-4) -> bool:
    return abs(a[0] - b[0]) < tol and abs(a[1] - b[1]) < tol


# ── Coordinate conversion ────────────────────────────────────────────────────

def to_grid(px: float, unit: float) -> float:
    """Convert px to grid cells, rounded to the nearest 0.25."""
    return round(px / unit * 4) / 4


def verts_to_grid(
    verts: list[tuple[float, float]], unit: float
) -> list[tuple[float, float]]:
    return [(to_grid(x, unit), to_grid(y, unit)) for x, y in verts]


# ── Polygon utilities ────────────────────────────────────────────────────────

def centroid(pts: list[tuple[float, float]]) -> tuple[float, float]:
    n = len(pts)
    return (sum(p[0] for p in pts) / n, sum(p[1] for p in pts) / n)


def remove_collinear(
    pts: list[tuple[float, float]], tol: float = 1e-6
) -> list[tuple[float, float]]:
    """Remove collinear middle points from a polygon."""
    if len(pts) < 3:
        return pts
    result = []
    n = len(pts)
    for i in range(n):
        a = pts[(i - 1) % n]
        b = pts[i]
        c = pts[(i + 1) % n]
        cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
        if abs(cross) > tol:
            result.append(b)
    return result


# ── Door detection ───────────────────────────────────────────────────────────

def segments_overlap(
    p1: tuple[float, float],
    p2: tuple[float, float],
    p3: tuple[float, float],
    p4: tuple[float, float],
    tol: float = 0.01,
) -> tuple[tuple[float, float], float] | None:
    """Check if two line segments are collinear and share a sub-segment.

    Returns (midpoint_of_overlap, overlap_length) or None.
    """
    dx12, dy12 = p2[0] - p1[0], p2[1] - p1[1]
    len12 = math.hypot(dx12, dy12)
    dx34, dy34 = p4[0] - p3[0], p4[1] - p3[1]
    len34 = math.hypot(dx34, dy34)
    if len12 < tol or len34 < tol:
        return None

    # Collinearity: p3 and p4 must lie on the line through p1–p2
    cross1 = dx12 * (p3[1] - p1[1]) - dy12 * (p3[0] - p1[0])
    cross2 = dx12 * (p4[1] - p1[1]) - dy12 * (p4[0] - p1[0])
    if abs(cross1) > tol * len12 or abs(cross2) > tol * len12:
        return None

    # Project onto the line direction
    def proj(pt: tuple[float, float]) -> float:
        return (pt[0] - p1[0]) * dx12 / len12 + (pt[1] - p1[1]) * dy12 / len12

    t3, t4 = proj(p3), proj(p4)
    if t3 > t4:
        t3, t4 = t4, t3

    lo = max(0.0, t3)
    hi = min(len12, t4)
    if hi - lo < tol:
        return None

    tmid = (lo + hi) / 2
    mid = (p1[0] + dx12 / len12 * tmid, p1[1] + dy12 / len12 * tmid)
    return (mid, hi - lo)


def _shared_edges_with_segments(
    poly_a: list[tuple[float, float]],
    poly_b: list[tuple[float, float]],
) -> list[tuple[tuple[tuple[float, float], float], tuple[tuple[float, float], tuple[float, float]]]]:
    """Like find_shared_edges but also returns the edge segment (p1, p2) that was hit."""
    results = []
    na, nb = len(poly_a), len(poly_b)
    for i in range(na):
        p1, p2 = poly_a[i], poly_a[(i + 1) % na]
        for j in range(nb):
            p3, p4 = poly_b[j], poly_b[(j + 1) % nb]
            result = segments_overlap(p1, p2, p3, p4)
            if result:
                results.append((result, (p1, p2)))
    return results


def find_shared_edges(
    poly_a: list[tuple[float, float]],
    poly_b: list[tuple[float, float]],
) -> list[tuple[tuple[float, float], float]]:
    """Find all overlapping edges between two polygons."""
    shared = []
    na, nb = len(poly_a), len(poly_b)
    for i in range(na):
        p1, p2 = poly_a[i], poly_a[(i + 1) % na]
        for j in range(nb):
            p3, p4 = poly_b[j], poly_b[(j + 1) % nb]
            result = segments_overlap(p1, p2, p3, p4)
            if result:
                shared.append(result)
    return shared


def edge_slot_angle(
    p1: tuple[float, float], p2: tuple[float, float]
) -> int:
    """Door slot orientation from the shared edge direction.
    Returns 0 for horizontal slot (N/S wall), 90 for vertical slot (E/W wall).
    For diagonal edges returns the nearest of 0 or 90.
    """
    dx = abs(p2[0] - p1[0])
    dy = abs(p2[1] - p1[1])
    return 90 if dy > dx else 0


# ── SVG layer extraction ─────────────────────────────────────────────────────

def get_layer_paths(parent: ET.Element, layer_label: str) -> list[ET.Element]:
    """Return all <path> elements from the named layer within parent."""
    for g in parent.iter(f"{{{SVG}}}g"):
        if g.get(f"{{{INK}}}label") == layer_label:
            return list(g.iter(f"{{{SVG}}}path"))
    return []


def get_ink_label(elem: ET.Element) -> str:
    return elem.get(f"{{{INK}}}label", "")


def find_deck_groups(root: ET.Element) -> list[tuple[str, ET.Element]]:
    """Find top-level layer groups that contain Rooms or Corridors sublayers.

    Only examines direct children of the SVG root element to avoid false
    positives from nested groups. Returns [(label, element)] in document
    order. An empty list means single-deck mode should be used.
    """
    decks = []
    for g in root:
        if g.tag != f"{{{SVG}}}g":
            continue
        label = g.get(f"{{{INK}}}label", "")
        if not label:
            continue
        child_labels = {
            child.get(f"{{{INK}}}label", "")
            for child in g
            if child.tag == f"{{{SVG}}}g"
        }
        if "Rooms" in child_labels or "Corridors" in child_labels:
            decks.append((label, g))
    return decks


# ── YAML formatting ──────────────────────────────────────────────────────────

def fv(v: float) -> str:
    """Format a grid value as int when whole, else as float."""
    if v == int(v):
        return str(int(v))
    return str(v)


def fmt_polygon(pts: list[tuple[float, float]]) -> str:
    return "[" + ", ".join(f"[{fv(x)},{fv(y)}]" for x, y in pts) + "]"


def to_snake(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


# ── Location scaffold ────────────────────────────────────────────────────────

def ensure_location_yaml(location_dir: str, map_name: str, location_type: str) -> None:
    """Create a stub location.yaml if one does not already exist."""
    path = os.path.join(location_dir, "location.yaml")
    if os.path.exists(path):
        print(f"Existing: {path}  (not modified)")
        return
    with open(path, "w") as f:
        f.write(f'name: "{map_name}"\n')
        f.write(f'type: "{location_type}"\n')
        f.write('description: ""\n')
        f.write('status: "OPERATIONAL"\n')
    print(f"Created:  {path}")


# ── Processing helpers ───────────────────────────────────────────────────────

def _extract_areas(
    parent: ET.Element, unit: float
) -> tuple[list[dict], list[dict]]:
    """Extract rooms and corridors from a layer element (root or deck group)."""
    rooms: list[dict] = []
    for path in get_layer_paths(parent, "Rooms"):
        label = get_ink_label(path) or path.get("id", "room")
        raw = parse_path_d(path.get("d", ""), label=label)
        poly = remove_collinear(verts_to_grid(raw, unit))
        rooms.append({"id": to_snake(label), "name": label.upper(), "polygon": poly})
        xs = [p[0] for p in poly]
        ys = [p[1] for p in poly]
        w = max(xs) - min(xs)
        h = max(ys) - min(ys)
        print(f"  Room '{label}': {len(poly)} vertices  ({w:.1f}×{h:.1f} cells)")

    corridors: list[dict] = []
    for i, path in enumerate(get_layer_paths(parent, "Corridors")):
        label = get_ink_label(path)
        cid = to_snake(label) if label else f"corridor_{i + 1}"
        raw = parse_path_d(path.get("d", ""), label=cid)
        poly = remove_collinear(verts_to_grid(raw, unit))
        corridors.append({"id": cid, "polygon": poly})
        print(f"  Corridor '{cid}': {len(poly)} vertices")

    return rooms, corridors


def _build_doors(rooms: list[dict], corridors: list[dict]) -> list[dict]:
    """Run door detection for a set of rooms and corridors."""
    all_areas = {r["id"]: r["polygon"] for r in rooms + corridors}
    seen_pairs: set[tuple[str, str]] = set()
    ordered_ids = [r["id"] for r in rooms] + [c["id"] for c in corridors]
    doors: list[dict] = []

    for a_id in ordered_ids:
        poly_a = all_areas[a_id]
        for b_id in ordered_ids:
            if a_id == b_id:
                continue
            pair = tuple(sorted([a_id, b_id]))
            if pair in seen_pairs:
                continue
            shared = _shared_edges_with_segments(poly_a, all_areas[b_id])
            if not shared:
                continue
            seen_pairs.add(pair)
            # If there's exactly one shared edge, emit B-rel (along: 0.5).
            # If multiple, emit B-pos for each so positions stay distinct.
            if len(shared) == 1:
                doors.append(
                    {
                        "rooms": [a_id, b_id],
                        "along": 0.5,
                        "type": "standard",
                        "status": "CLOSED",
                    }
                )
            else:
                for (mid, _length), (p1, p2) in shared:
                    doors.append(
                        {
                            "rooms": [a_id, b_id],
                            "position": {
                                "x": round(mid[0] * 4) / 4,
                                "y": round(mid[1] * 4) / 4,
                                "angle": edge_slot_angle(p1, p2),
                            },
                            "type": "standard",
                            "status": "CLOSED",
                        }
                    )

    def sort_key(d: dict):
        pair = tuple(sorted(d["rooms"]))
        if "along" in d:
            return (pair, 0, d["along"], 0.0)
        p = d["position"]
        return (pair, 1, p["y"], p["x"])

    doors.sort(key=sort_key)
    return doors


def _write_deck_yaml(
    map_dir: str,
    deck_id: str,
    deck_label: str,
    map_name: str,
    unit_size: int,
    rooms: list[dict],
    corridors: list[dict],
    doors: list[dict],
    detect_doors: bool,
) -> None:
    deck_path = os.path.join(map_dir, f"{deck_id}.yaml")
    with open(deck_path, "w") as f:
        f.write(f'deck_id: "{deck_id}"\n')
        f.write(f'name: "{map_name} — {deck_label}"\n')
        f.write(f'location_name: "{map_name}"\n')
        f.write(f"unit_size: {unit_size}\n\n")
        f.write("rooms:\n\n")

        for room in rooms:
            f.write(f'  - id: {room["id"]}\n')
            f.write(f'    name: "{room["name"]}"\n')
            f.write(f'    polygon: {fmt_polygon(room["polygon"])}\n')
            f.write("    # description: \"\"\n")
            f.write("    # type: \"\"\n")
            f.write("\n")

        for corr in corridors:
            f.write(f'  - id: {corr["id"]}\n')
            f.write('    name: ""\n')
            f.write(f'    polygon: {fmt_polygon(corr["polygon"])}\n')
            f.write("    type: corridor\n")
            f.write("\n")

        # Top-level canonical doors block (Phase 21 canonical model — B-rel
        # by default, B-pos when ambiguous). Loaders pass this through to
        # the frontend doorNormalizer which validates it against geometry.
        if detect_doors and doors:
            f.write("doors:\n")
            for d in doors:
                a, b = d["rooms"][0], d["rooms"][1]
                if "along" in d:
                    f.write(
                        f'  - {{rooms: [{a}, {b}], along: {d["along"]},'
                        f' type: {d["type"]}, status: {d["status"]}}}\n'
                    )
                else:
                    p = d["position"]
                    f.write(
                        f'  - {{rooms: [{a}, {b}],'
                        f' position: {{x: {fv(p["x"])}, y: {fv(p["y"])}, angle: {p["angle"]}}},'
                        f' type: {d["type"]}, status: {d["status"]}}}\n'
                    )
        elif detect_doors:
            f.write("# doors: []\n")

    print(f"Written: {deck_path}")


# ── Main conversion ──────────────────────────────────────────────────────────

def convert(
    svg_path: str,
    location_dir: str,
    deck_id: str,
    map_name: str,
    location_type: str,
    unit_size: int,
    grid_scale: int,
    detect_doors: bool,
) -> None:
    tree = ET.parse(svg_path)
    root = tree.getroot()

    # Grid unit
    raw_unit: float | None = None
    for g in root.iter(f"{{{INK}}}grid"):
        s = g.get("spacingx")
        if s:
            raw_unit = float(s)
            break
    if raw_unit is None:
        sys.exit("ERROR: No inkscape:grid element found — cannot determine grid unit.")
    unit = raw_unit * grid_scale
    if grid_scale == 1:
        print(f"Grid unit: {raw_unit:.7f} px/cell")
    else:
        print(f"Grid unit: {raw_unit:.7f} px/cell  ×  grid-scale {grid_scale}  =  {unit:.7f} px/output-cell")

    # Hull
    hull_poly: list[tuple[float, float]] | None = None
    hull_paths = get_layer_paths(root, "Hull")
    if hull_paths:
        raw = parse_path_d(hull_paths[0].get("d", ""), label="Hull")
        hull_poly = remove_collinear(verts_to_grid(raw, unit))
        print(f"Hull: {len(hull_poly)} vertices")
    else:
        print("Hull: (none)")

    # Detect multi-deck vs single-deck
    deck_groups = find_deck_groups(root)

    if deck_groups:
        print(f"\nMulti-deck mode: {len(deck_groups)} decks found.\n")
        decks_data = []
        for deck_label, deck_elem in deck_groups:
            deck_id_local = to_snake(deck_label)
            print(f"[{deck_label}]")
            rooms, corridors = _extract_areas(deck_elem, unit)
            doors: list[dict] = []
            if detect_doors:
                doors = _build_doors(rooms, corridors)
                print(f"  Door detection: {len(doors)} doors emitted.")
            decks_data.append(
                {
                    "id": deck_id_local,
                    "label": deck_label,
                    "rooms": rooms,
                    "corridors": corridors,
                    "doors": doors,
                }
            )
            print()
    else:
        print("\nSingle-deck mode.")
        rooms, corridors = _extract_areas(root, unit)
        doors = []
        if detect_doors:
            doors = _build_doors(rooms, corridors)
            print(f"\nDoor detection complete: {len(doors)} doors emitted.")
        decks_data = [
            {
                "id": deck_id,
                "label": "Main Deck",
                "rooms": rooms,
                "corridors": corridors,
                "doors": doors,
            }
        ]

    # Write output
    map_dir = os.path.join(location_dir, "map")
    os.makedirs(map_dir, exist_ok=True)

    ensure_location_yaml(location_dir, map_name, location_type)

    # manifest.yaml
    manifest_path = os.path.join(map_dir, "manifest.yaml")
    with open(manifest_path, "w") as f:
        f.write(f'name: "{map_name}"\n')
        f.write('facility_type: "ship"\n')
        f.write(f"total_decks: {len(decks_data)}\n")

        if hull_poly:
            f.write("\nhull:\n  polygon:\n")
            for x, y in hull_poly:
                f.write(f"    - [{fv(x)}, {fv(y)}]\n")

        f.write("\ndecks:\n")
        for level, d in enumerate(decks_data, start=1):
            f.write(f'  - id: "{d["id"]}"\n')
            f.write(f'    name: "{d["label"]}"\n')
            f.write(f'    file: "{d["id"]}.yaml"\n')
            f.write(f"    level: {level}\n")
            f.write(f'    default: {"true" if level == 1 else "false"}\n')

    print(f"\nWritten: {manifest_path}")

    for d in decks_data:
        _write_deck_yaml(
            map_dir,
            d["id"],
            d["label"],
            map_name,
            unit_size,
            d["rooms"],
            d["corridors"],
            d["doors"],
            detect_doors,
        )


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(
        description="Convert Inkscape SVG map to YAML encounter map format."
    )
    ap.add_argument("svg", help="Input SVG file path")
    ap.add_argument(
        "--out-dir",
        metavar="DIR",
        help="Location directory (default: <svg_dir>/<stem>_out/); map files go to <DIR>/map/",
    )
    ap.add_argument(
        "--deck",
        default="main_deck",
        metavar="NAME",
        help="Deck YAML filename stem for single-deck mode (default: main_deck); ignored in multi-deck mode",
    )
    ap.add_argument(
        "--name",
        metavar="NAME",
        help="Map/location name (default: derived from SVG filename)",
    )
    ap.add_argument(
        "--type",
        default="ship",
        metavar="TYPE",
        help="Location type for stub location.yaml (default: ship)",
    )
    ap.add_argument(
        "--unit-size",
        default=30,
        type=int,
        metavar="N",
        help="Pixels per grid cell in deck YAML (default: 30)",
    )
    ap.add_argument(
        "--grid-scale",
        default=1,
        type=int,
        metavar="N",
        help="Group N Inkscape cells into 1 output cell (default: 1); use when rooms have too many cells",
    )
    ap.add_argument(
        "--detect-doors",
        action="store_true",
        help="Detect doors from shared edges between rooms and corridors",
    )
    args = ap.parse_args()

    svg_path = os.path.abspath(args.svg)
    if not os.path.exists(svg_path):
        sys.exit(f"ERROR: File not found: {svg_path}")

    stem = os.path.splitext(os.path.basename(svg_path))[0]
    map_name = args.name or stem.replace("_", " ").replace("-", " ").title()
    location_dir = args.out_dir or os.path.join(os.path.dirname(svg_path), f"{stem}_out")

    print(f"Converting:    {svg_path}")
    print(f"Map name:      {map_name}")
    print(f"Location dir:  {location_dir}")
    print(f"Unit size:     {args.unit_size} px/cell")
    print(f"Grid scale:    {args.grid_scale}\n")

    convert(svg_path, location_dir, args.deck, map_name, args.type, args.unit_size, args.grid_scale, args.detect_doors)
    print("\nDone.")


if __name__ == "__main__":
    main()
