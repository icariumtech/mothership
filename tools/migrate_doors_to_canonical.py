#!/usr/bin/env python3
"""migrate_doors_to_canonical.py — one-shot migration from nested room.doors[] to top-level canonical doors[].

Phase 21, plan 21-04. Walks the listed YAML files (or all `data/galaxy/**/map/*.yaml`,
`data/ships/**/deckplan.yaml`, `data/campaign/**/deckplan.yaml` by default), and for each
deck that has rooms with nested `doors:` entries:

  1. For each legacy door, compute its grid-space (x, y, angle) using the same logic
     as the renderer's `legacyDoorToGridPosition` (`src/components/.../roomGeometry.ts`):
        - `{x, y, angle}` doors pass through unchanged.
        - `{wall, position}` rect doors compute (x, y, angle) from the room's rects.
  2. Identify the "other room" by spatial lookup: cell on the other side of the wall
     must lie inside another room's polygon/rects/circle (or be the exterior).
  3. Emit a top-level `doors:` block on the deck, using either:
        - B-rel `{rooms: [a, b], along: <frac>, ...}` when the shared-edge midpoint
          can be located unambiguously, OR
        - B-pos `{rooms: [a, b], position: {x, y, angle}, ...}` when only the
          explicit (x, y, angle) is known reliably.
  4. Door id is preserved as `${room.id}_door_${oldIndex}` so persisted
     DoorStatusState entries keyed by that id continue to resolve.
  5. Strip nested `doors:` arrays from every room.

This is a one-shot tool. Re-running it on already-migrated files is a no-op (rooms have
no nested `doors:`, deck already has top-level `doors:`).

Usage:
    python3 tools/migrate_doors_to_canonical.py            # migrate all known maps
    python3 tools/migrate_doors_to_canonical.py path1 path2 # specific files
    python3 tools/migrate_doors_to_canonical.py --dry-run   # show changes only
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("ERROR: pyyaml is required.", file=sys.stderr)
    sys.exit(1)


# ───────────────────────────────────────────────────────────────────────────────
# Geometry helpers — mirror the renderer's legacyDoorToGridPosition (TypeScript).
# All coordinates are grid units.
# ───────────────────────────────────────────────────────────────────────────────


def _rect_cells_along_wall(rects: list[dict], wall: str) -> list[int]:
    """Mirror of legacyDoorToGridPosition: list of valid cell indices along the
    target wall of a multi-rect room (respects chamfer)."""
    if wall in ("north", "south"):
        target_y = (
            min(r["y"] for r in rects)
            if wall == "north"
            else max(r["y"] + r["h"] for r in rects)
        )
        wall_rects = [
            r
            for r in rects
            if (r["y"] == target_y if wall == "north" else r["y"] + r["h"] == target_y)
        ]
        cells: list[int] = []
        for r in wall_rects:
            c = math.ceil(r.get("chamfer", 0))
            for i in range(max(0, r["w"] - c * 2)):
                cells.append(r["x"] + c + i)
        cells.sort()
        return cells
    # east / west
    target_x = (
        min(r["x"] for r in rects)
        if wall == "west"
        else max(r["x"] + r["w"] for r in rects)
    )
    wall_rects = [
        r
        for r in rects
        if (r["x"] == target_x if wall == "west" else r["x"] + r["w"] == target_x)
    ]
    cells = []
    for r in wall_rects:
        c = math.ceil(r.get("chamfer", 0))
        for i in range(max(0, r["h"] - c * 2)):
            cells.append(r["y"] + c + i)
    cells.sort()
    return cells


def _polygon_area_centroid(poly: list[list[float]]) -> tuple[float, float]:
    """Shoelace area-weighted centroid of a polygon."""
    n = len(poly)
    a2 = 0.0
    cx = 0.0
    cy = 0.0
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        cross = x1 * y2 - x2 * y1
        a2 += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    if abs(a2) < 1e-12:
        sx = sum(p[0] for p in poly) / n
        sy = sum(p[1] for p in poly) / n
        return sx, sy
    a = a2 / 2
    return cx / (6 * a), cy / (6 * a)


def _polygon_boundary_point(
    poly: list[list[float]], origin: tuple[float, float], angle_rad: float
) -> tuple[float, float]:
    """Ray-cast from `origin` at `angle_rad` to the polygon boundary."""
    n = len(poly)
    dx = math.cos(angle_rad)
    dy = math.sin(angle_rad)
    min_t = math.inf
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        ex = x2 - x1
        ey = y2 - y1
        denom = dx * ey - dy * ex
        if abs(denom) < 1e-10:
            continue
        t = ((x1 - origin[0]) * ey - (y1 - origin[1]) * ex) / denom
        s = ((x1 - origin[0]) * dy - (y1 - origin[1]) * dx) / denom
        if t >= 0 and -1e-10 <= s <= 1 + 1e-10:
            if t < min_t:
                min_t = t
    if not math.isfinite(min_t):
        min_t = 2.0
    return origin[0] + min_t * dx, origin[1] + min_t * dy


def _legacy_angle_rad(door: dict, default_wall: str | None) -> float:
    if "angle" in door:
        return math.radians(door["angle"])
    w = door.get("wall", default_wall)
    return {
        "east": 0.0,
        "south": math.pi / 2,
        "west": math.pi,
        "north": -math.pi / 2,
    }.get(w, 0.0)


def _slot_angle_from_dir(angle_rad: float) -> int:
    """Direction-from-centroid angle (radians) → slot angle (0 horiz / 90 vert) in deg."""
    deg = math.degrees(angle_rad) + 90.0
    deg = ((deg % 180) + 180) % 180
    if deg < 1 or deg > 179:
        return 0
    if abs(deg - 90) < 1:
        return 90
    return int(round(deg))


def legacy_door_to_position(
    room: dict, door: dict
) -> dict | None:
    """Return canonical {x, y, angle} (grid coords) for a legacy door entry, or None.

    Mirrors `legacyDoorToGridPosition` in roomGeometry.ts.
    """
    # Explicit position already canonical.
    if "x" in door and "y" in door:
        return {
            "x": float(door["x"]),
            "y": float(door["y"]),
            "angle": int(door.get("angle", 0)),
        }
    # Circle room — ray from centroid at door angle.
    if "circle" in room and room["circle"]:
        c = room["circle"]
        a = _legacy_angle_rad(door, None)
        return {
            "x": float(c["cx"] + c["r"] * math.cos(a)),
            "y": float(c["cy"] + c["r"] * math.sin(a)),
            "angle": _slot_angle_from_dir(a),
        }
    # Polygon room — ray from centroid along door angle.
    if "polygon" in room and room["polygon"]:
        cx, cy = _polygon_area_centroid(room["polygon"])
        a = _legacy_angle_rad(door, None)
        bx, by = _polygon_boundary_point(room["polygon"], (cx, cy), a)
        return {"x": bx, "y": by, "angle": _slot_angle_from_dir(a)}
    # Rect room — wall + position.
    rects = room.get("rects") or []
    wall = door.get("wall")
    if not rects or not wall:
        return None
    cells = _rect_cells_along_wall(rects, wall)
    pos = door.get("position", 0)
    cell = cells[pos] if 0 <= pos < len(cells) else (cells[0] if cells else 0)
    if wall in ("north", "south"):
        target_y = (
            min(r["y"] for r in rects)
            if wall == "north"
            else max(r["y"] + r["h"] for r in rects)
        )
        return {"x": float(cell + 0.5), "y": float(target_y), "angle": 0}
    # east / west
    target_x = (
        min(r["x"] for r in rects)
        if wall == "west"
        else max(r["x"] + r["w"] for r in rects)
    )
    return {"x": float(target_x), "y": float(cell + 0.5), "angle": 90}


# ───────────────────────────────────────────────────────────────────────────────
# Room-shape membership (for spatial lookup of "the other room").
# ───────────────────────────────────────────────────────────────────────────────


def point_in_polygon(p: tuple[float, float], poly: list[list[float]]) -> bool:
    """Ray-casting point-in-polygon test."""
    x, y = p
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        intersects = ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-30) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def point_in_rect(p: tuple[float, float], r: dict) -> bool:
    x, y = p
    return (r["x"] <= x <= r["x"] + r["w"]) and (r["y"] <= y <= r["y"] + r["h"])


def point_in_room(p: tuple[float, float], room: dict) -> bool:
    if room.get("polygon"):
        return point_in_polygon(p, room["polygon"])
    if room.get("circle"):
        c = room["circle"]
        dx = p[0] - c["cx"]
        dy = p[1] - c["cy"]
        return dx * dx + dy * dy <= c["r"] * c["r"]
    for r in room.get("rects") or []:
        if point_in_rect(p, r):
            return True
    return False


def find_other_room(
    rooms: list[dict],
    self_id: str,
    door_pos: dict,
) -> str | None:
    """Spatial lookup: probe one cell on each side of the door and return the
    other room's id, or None if the probe points lie outside any other room."""
    x, y = door_pos["x"], door_pos["y"]
    angle = door_pos.get("angle", 0)
    # Door normal direction is perpendicular to the slot.
    # angle=0 (horizontal slot) → normal is along y axis → probe (x, y±0.5)
    # angle=90 (vertical slot)  → normal is along x axis → probe (x±0.5, y)
    if angle == 0:
        probes = [(x, y + 0.5), (x, y - 0.5)]
    elif angle == 90:
        probes = [(x + 0.5, y), (x - 0.5, y)]
    else:
        rad = math.radians(angle)
        # Normal direction is (cos(rad+90), sin(rad+90)) and its negative.
        nx = -math.sin(rad)
        ny = math.cos(rad)
        probes = [(x + 0.5 * nx, y + 0.5 * ny), (x - 0.5 * nx, y - 0.5 * ny)]
    for pt in probes:
        for r in rooms:
            if r["id"] == self_id:
                continue
            if point_in_room(pt, r):
                return r["id"]
    return None


# ───────────────────────────────────────────────────────────────────────────────
# Shared-edge resolution (lightweight — for the B-rel `along` computation).
# Walks both rooms' boundary segments and finds the one closest to (x, y).
# ───────────────────────────────────────────────────────────────────────────────


def _boundary_segments(room: dict) -> list[tuple[tuple[float, float], tuple[float, float]]]:
    """Return boundary segments of a room (polygon edges, or rect exterior edges)."""
    segs: list[tuple[tuple[float, float], tuple[float, float]]] = []
    if room.get("polygon"):
        poly = room["polygon"]
        n = len(poly)
        for i in range(n):
            p1 = (float(poly[i][0]), float(poly[i][1]))
            p2 = (float(poly[(i + 1) % n][0]), float(poly[(i + 1) % n][1]))
            segs.append((p1, p2))
        return segs
    if room.get("circle"):
        # Coarse approximation — not used for along-on-shared-edge currently.
        c = room["circle"]
        N = 64
        for i in range(N):
            a1 = (i / N) * 2 * math.pi
            a2 = ((i + 1) / N) * 2 * math.pi
            segs.append(
                (
                    (c["cx"] + c["r"] * math.cos(a1), c["cy"] + c["r"] * math.sin(a1)),
                    (c["cx"] + c["r"] * math.cos(a2), c["cy"] + c["r"] * math.sin(a2)),
                )
            )
        return segs
    # Rects: exterior unit edges via the wall-segment algorithm.
    counts: dict[str, int] = {}
    for r in room.get("rects") or []:
        for cx in range(r["x"], r["x"] + r["w"]):
            top = f"H:{cx}:{r['y']}"
            bot = f"H:{cx}:{r['y'] + r['h']}"
            counts[top] = counts.get(top, 0) + 1
            counts[bot] = counts.get(bot, 0) + 1
        for cy in range(r["y"], r["y"] + r["h"]):
            left = f"V:{r['x']}:{cy}"
            right = f"V:{r['x'] + r['w']}:{cy}"
            counts[left] = counts.get(left, 0) + 1
            counts[right] = counts.get(right, 0) + 1
    for key, n in counts.items():
        if n != 1:
            continue
        orient, gx_s, gy_s = key.split(":")
        gx = int(gx_s)
        gy = int(gy_s)
        if orient == "H":
            segs.append(((float(gx), float(gy)), (float(gx + 1), float(gy))))
        else:
            segs.append(((float(gx), float(gy)), (float(gx), float(gy + 1))))
    return segs


def _is_collinear(p: tuple[float, float], s: tuple[tuple[float, float], tuple[float, float]]) -> bool:
    (ax, ay), (bx, by) = s
    cross = (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax)
    seg_len = math.hypot(bx - ax, by - ay)
    return abs(cross) < 1e-6 * max(1.0, seg_len)


def _seg_overlap_extents(
    a: tuple[tuple[float, float], tuple[float, float]],
    b: tuple[tuple[float, float], tuple[float, float]],
) -> tuple[float, float] | None:
    """Project b's endpoints onto a's direction; return (tStart, tEnd) of overlap or None."""
    if not _is_collinear(b[0], a) or not _is_collinear(b[1], a):
        return None
    (ax, ay), (bx, by) = a
    dx = bx - ax
    dy = by - ay
    length = math.hypot(dx, dy)
    if length < 1e-9:
        return None
    ux = dx / length
    uy = dy / length
    t_a0 = 0.0
    t_a1 = length
    t_b0 = (b[0][0] - ax) * ux + (b[0][1] - ay) * uy
    t_b1 = (b[1][0] - ax) * ux + (b[1][1] - ay) * uy
    t_bmin = min(t_b0, t_b1)
    t_bmax = max(t_b0, t_b1)
    t_start = max(t_a0, t_bmin)
    t_end = min(t_a1, t_bmax)
    if t_end - t_start < 1e-6:
        return None
    return t_start, t_end


def shared_edge_overlaps(
    room_a: dict, room_b: dict
) -> list[tuple[tuple[float, float], tuple[float, float]]]:
    """Return overlapping segments between the two rooms' boundaries (as segs in
    grid space). Each entry is a (start_pt, end_pt) sub-segment of the shared run."""
    a_segs = _boundary_segments(room_a)
    b_segs = _boundary_segments(room_b)
    out: list[tuple[tuple[float, float], tuple[float, float]]] = []
    for sa in a_segs:
        for sb in b_segs:
            ov = _seg_overlap_extents(sa, sb)
            if ov is None:
                continue
            t0, t1 = ov
            (ax, ay), (bx, by) = sa
            length = math.hypot(bx - ax, by - ay)
            if length < 1e-9:
                continue
            ux = (bx - ax) / length
            uy = (by - ay) / length
            out.append(
                (
                    (ax + ux * t0, ay + uy * t0),
                    (ax + ux * t1, ay + uy * t1),
                )
            )
    return out


def _merge_collinear_runs(
    segs: list[tuple[tuple[float, float], tuple[float, float]]],
) -> list[tuple[tuple[float, float], tuple[float, float]]]:
    """Merge collinear adjacent sub-segments into maximal runs."""
    if not segs:
        return []
    groups: dict[str, list[tuple[tuple[float, float], tuple[float, float]]]] = {}
    for s in segs:
        (ax, ay), (bx, by) = s
        dx = bx - ax
        dy = by - ay
        length = math.hypot(dx, dy)
        if length < 1e-9:
            continue
        ux = dx / length
        uy = dy / length
        # Normalize direction
        if ux < -1e-9 or (abs(ux) < 1e-9 and uy < -1e-9):
            ux, uy = -ux, -uy
        nx, ny = -uy, ux
        offset = nx * ax + ny * ay
        key = f"{ux:.8f}|{uy:.8f}|{offset:.8f}"
        groups.setdefault(key, []).append(s)
    runs: list[tuple[tuple[float, float], tuple[float, float]]] = []
    for group in groups.values():
        (ax, ay), _ = group[0]
        (bx, by) = group[0][1]
        dx = bx - ax
        dy = by - ay
        length = math.hypot(dx, dy)
        ux = dx / length
        uy = dy / length
        intervals: list[list[float]] = []
        for s in group:
            (sx0, sy0), (sx1, sy1) = s
            t0 = (sx0 - ax) * ux + (sy0 - ay) * uy
            t1 = (sx1 - ax) * ux + (sy1 - ay) * uy
            intervals.append([min(t0, t1), max(t0, t1)])
        intervals.sort()
        merged: list[list[float]] = []
        for iv in intervals:
            if not merged or iv[0] - merged[-1][1] > 1e-6:
                merged.append(iv[:])
            else:
                merged[-1][1] = max(merged[-1][1], iv[1])
        for t0, t1 in merged:
            runs.append(
                ((ax + ux * t0, ay + uy * t0), (ax + ux * t1, ay + uy * t1))
            )
    return runs


def find_shared_edge_runs(
    room_a: dict, room_b: dict
) -> list[tuple[tuple[float, float], tuple[float, float]]]:
    """Return maximal connected shared-edge runs between two rooms."""
    return _merge_collinear_runs(shared_edge_overlaps(room_a, room_b))


def compute_along_on_run(
    door_pos: dict,
    run: tuple[tuple[float, float], tuple[float, float]],
) -> tuple[float, float] | None:
    """Project (door_pos.x, door_pos.y) onto `run`; return (along_fraction, perp_dist)
    or None if the run is degenerate."""
    (ax, ay), (bx, by) = run
    dx = bx - ax
    dy = by - ay
    length = math.hypot(dx, dy)
    if length < 1e-9:
        return None
    ux = dx / length
    uy = dy / length
    px = door_pos["x"] - ax
    py = door_pos["y"] - ay
    t = (px * ux + py * uy) / length  # fraction in [0, 1]
    proj_x = ax + dx * t
    proj_y = ay + dy * t
    perp = math.hypot(door_pos["x"] - proj_x, door_pos["y"] - proj_y)
    t = max(0.0, min(1.0, t))
    return t, perp


# ───────────────────────────────────────────────────────────────────────────────
# Migration core.
# ───────────────────────────────────────────────────────────────────────────────


def migrate_deck(deck: dict, *, file_label: str = "") -> tuple[list[dict], int]:
    """Walk `deck['rooms']`, lift nested doors to a top-level list.

    Returns (top_level_doors, count) where count is the number of doors migrated.
    Mutates `deck['rooms']` in place by stripping nested `doors:`.
    """
    rooms: list[dict] = deck.get("rooms") or []
    out: list[dict] = []
    seen_keys: set[str] = set()
    for room in rooms:
        nested = room.get("doors") or []
        if not nested:
            # Still strip empty `doors: []` arrays so the migrated YAML has no
            # room-nested doors field at all.
            if "doors" in room:
                del room["doors"]
            continue
        for idx, d in enumerate(nested):
            door_id = f"{room['id']}_door_{idx}"
            pos = legacy_door_to_position(room, d)
            if pos is None:
                print(
                    f"  WARN: {file_label} room '{room['id']}' door[{idx}] could not be"
                    " resolved to a position — skipping",
                    file=sys.stderr,
                )
                continue
            other = find_other_room(rooms, room["id"], pos)
            # Build canonical door. Prefer B-rel only if other room found AND we
            # have exactly one shared-edge run AND the door projects cleanly onto
            # that run with low perpendicular error. Otherwise emit B-pos with
            # explicit position — safe for the renderer regardless.
            entry: dict[str, Any] = {
                "id": door_id,
                "rooms": [room["id"]] if other is None else [room["id"], other],
                "type": d.get("type", "standard"),
                "status": d.get("status", "CLOSED"),
            }
            use_brel = False
            if other is not None:
                other_room = next((r for r in rooms if r["id"] == other), None)
                if other_room is not None:
                    runs = find_shared_edge_runs(room, other_room)
                    if len(runs) == 1:
                        proj = compute_along_on_run(pos, runs[0])
                        if proj is not None and proj[1] < 0.05:
                            entry["along"] = round(proj[0], 4)
                            use_brel = True
            if not use_brel:
                entry["position"] = {
                    "x": _maybe_int(pos["x"]),
                    "y": _maybe_int(pos["y"]),
                    "angle": pos["angle"],
                }
            # Dedup — the migration walks rooms on both sides of every door, but the
            # legacy YAML often authors the same door twice (once per side). We key
            # by sorted-room-pair + rounded position, keep the first.
            key = _dedup_key(entry, pos)
            if key in seen_keys:
                continue
            seen_keys.add(key)
            out.append(entry)
        # Strip nested doors regardless (even if all migrated).
        if "doors" in room:
            del room["doors"]
    return out, len(out)


def _maybe_int(v: float) -> Any:
    if abs(v - round(v)) < 1e-9:
        return int(round(v))
    return round(v, 4)


def _dedup_key(entry: dict, pos: dict) -> str:
    rooms = entry.get("rooms", [])
    pair = "__".join(sorted(rooms)) if len(rooms) >= 2 else f"{rooms[0]}__ext"
    # Round to nearest 0.5 cell — the same shared edge computed from either
    # room-side can produce positions that differ by up to ~1 cell due to
    # wall-coordinate off-by-one in legacy YAML. Using 0.5-cell tolerance
    # prevents near-identical doors from surviving dedup and triggering
    # DoorNormalizationError at runtime.
    return f"{pair}|{round(pos['x'] * 2) / 2}|{round(pos['y'] * 2) / 2}|{pos['angle']}"


def migrate_file(path: Path, *, dry_run: bool = False) -> int:
    """Migrate a single YAML map / deckplan file. Returns number of doors migrated.

    Supports two file shapes:
      (a) standalone deck (has top-level `rooms:`), e.g. somnus/map/main_deck.yaml
      (b) deckplan with embedded decks (`decks: [{ ..., rooms: [...] }]`), e.g.
          ships/patrol_gunboat/deckplan.yaml or campaign/ship/deckplan.yaml
    """
    with open(path) as f:
        data = yaml.safe_load(f) or {}

    total = 0
    label = str(path)
    if "rooms" in data:
        doors, n = migrate_deck(data, file_label=label)
        if n > 0:
            # Place top-level doors block immediately after rooms.
            data["doors"] = (data.get("doors") or []) + doors
        total += n
    if "decks" in data and isinstance(data["decks"], list):
        for deck in data["decks"]:
            if not isinstance(deck, dict):
                continue
            doors, n = migrate_deck(deck, file_label=f"{label} (deck {deck.get('id', '?')})")
            if n > 0:
                deck["doors"] = (deck.get("doors") or []) + doors
            total += n

    if total == 0:
        print(f"  {path}: no nested doors to migrate")
        return 0

    if dry_run:
        print(f"  {path}: would migrate {total} doors (dry-run)")
        return total

    # Write back. Preserve key order via PyYAML default; use block style for
    # readability, but compact each door entry on one line (flow-style) by
    # marking it as such.
    text = _dump_with_compact_doors(data)
    with open(path, "w") as f:
        f.write(text)
    print(f"  {path}: migrated {total} doors")
    return total


# ───────────────────────────────────────────────────────────────────────────────
# YAML output formatting — compact doors (flow style for each entry).
# ───────────────────────────────────────────────────────────────────────────────


class _FlowList(list):
    """Marker subclass — emitted with flow style (single-line) by the dumper."""


class _FlowDict(dict):
    pass


def _flow_list_rep(dumper: yaml.SafeDumper, data: _FlowList) -> Any:
    return dumper.represent_sequence("tag:yaml.org,2002:seq", data, flow_style=True)


def _flow_dict_rep(dumper: yaml.SafeDumper, data: _FlowDict) -> Any:
    return dumper.represent_mapping("tag:yaml.org,2002:map", data, flow_style=True)


yaml.SafeDumper.add_representer(_FlowList, _flow_list_rep)
yaml.SafeDumper.add_representer(_FlowDict, _flow_dict_rep)


def _mark_compact(data: Any) -> Any:
    """Walk the data structure: convert top-level `doors:` entries and their
    nested `rooms`/`position` to flow-style for single-line YAML."""
    if isinstance(data, dict):
        result: dict[str, Any] = {}
        for k, v in data.items():
            if k == "doors" and isinstance(v, list):
                new_doors = []
                for entry in v:
                    if isinstance(entry, dict):
                        fd = _FlowDict()
                        for ek, ev in entry.items():
                            if ek == "rooms" and isinstance(ev, list):
                                fd[ek] = _FlowList(ev)
                            elif ek == "position" and isinstance(ev, dict):
                                fd[ek] = _FlowDict(ev)
                            else:
                                fd[ek] = ev
                        new_doors.append(fd)
                    else:
                        new_doors.append(entry)
                result[k] = new_doors
            elif k == "polygon" and isinstance(v, list):
                # Keep polygon points as flow style for compactness (matches existing files).
                result[k] = [_FlowList([float(p[0]), float(p[1])]) if isinstance(p, list) else p for p in v]
            else:
                result[k] = _mark_compact(v)
        return result
    if isinstance(data, list):
        return [_mark_compact(x) for x in data]
    return data


def _dump_with_compact_doors(data: dict) -> str:
    # NOTE: yaml.safe_dump re-serialises the entire document, which normalises
    # all floating-point values (e.g. `4.0` → `4`, `4` → `4`) and reformats
    # block-style lists even for sections that were not modified by migration.
    # This is intentional — the migration is a one-time idempotent operation and
    # the normalised output is canonical. Running it a second time on an already-
    # migrated file produces no further diffs (since nested `doors:` lists are
    # absent after the first run). Do NOT add ad-hoc formatting fixes here; if
    # representation fidelity matters, switch to ruamel.yaml (round-trip loader).
    marked = _mark_compact(data)
    return yaml.safe_dump(
        marked,
        default_flow_style=False,
        sort_keys=False,
        allow_unicode=True,
        width=2000,
    )


# ───────────────────────────────────────────────────────────────────────────────
# Default discovery.
# ───────────────────────────────────────────────────────────────────────────────


DEFAULT_GLOBS = [
    "data/galaxy/**/map/*.yaml",
    "data/galaxy/**/deckplan.yaml",
    "data/ships/**/deckplan.yaml",
    "data/campaign/**/deckplan.yaml",
]


def discover_files(root: Path) -> list[Path]:
    seen: set[Path] = set()
    out: list[Path] = []
    for pattern in DEFAULT_GLOBS:
        for p in sorted(root.glob(pattern)):
            if p.name == "manifest.yaml":
                continue
            if p in seen:
                continue
            seen.add(p)
            out.append(p)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("paths", nargs="*", help="Specific YAML files to migrate (default: discover).")
    ap.add_argument("--dry-run", action="store_true", help="Show what would change, don't write.")
    ap.add_argument(
        "--root",
        default=".",
        help="Project root for glob discovery (default: current dir).",
    )
    args = ap.parse_args()

    root = Path(args.root).resolve()
    if args.paths:
        files = [Path(p).resolve() for p in args.paths]
    else:
        files = discover_files(root)

    if not files:
        print("No map/deckplan YAML files found.")
        return 0

    print(f"Migrating {len(files)} file(s):")
    grand_total = 0
    for f in files:
        if not f.exists():
            print(f"  SKIP (missing): {f}")
            continue
        grand_total += migrate_file(f, dry_run=args.dry_run)
    print(f"\nDone. Total doors migrated: {grand_total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
