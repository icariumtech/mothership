"""
FastMCP HTTP server for the JANUS GM campaign AI.

Exposes tools at http://<host>:8001/mcp/ over HTTP transport.
Delegates all logic to the Django REST API at DJANGO_BASE_URL.

This module is standalone — it does NOT import Django or manage.py.
Runtime dependencies: fastmcp, httpx (see requirements.txt).

INTENTIONALLY UNAUTHENTICATED: Trust-network model (D-09). The MCP service
runs on the same homelab Docker network as the Django app. Do not expose
port 8001 to the public internet.
"""

import os
from typing import Any

import httpx
from fastmcp import FastMCP

DJANGO_BASE_URL = os.environ.get("DJANGO_BASE_URL", "http://app:8000")
# External URL reachable from client machines (e.g. Windows running Claude Code).
# Set JANUS_EXTERNAL_URL in .env to the homelab-accessible address, e.g. http://icarium.local:8000.
# Falls back to DJANGO_BASE_URL if unset (correct for server-side tool calls; wrong for curl from clients).
JANUS_EXTERNAL_URL = os.environ.get("JANUS_EXTERNAL_URL") or DJANGO_BASE_URL

mcp = FastMCP("JanusGM")


@mcp.tool
async def get_session_context() -> dict:
    """Return current game state snapshot: active encounter, tokens, room visibility, ship status, NPC list."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{DJANGO_BASE_URL}/api/gm/session-context")
        r.raise_for_status()
        return r.json()


@mcp.tool
async def list_files(dir: str) -> list:
    """List files in a data directory. dir is relative to data/ (e.g. 'campaign/crew')."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{DJANGO_BASE_URL}/api/gm/data/", params={"dir": dir})
        r.raise_for_status()
        return r.json()


@mcp.tool
async def read_file(path: str) -> str:
    """Read raw YAML content of a campaign file. path is relative to data/ (e.g. 'campaign/ship/ship.yaml')."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{DJANGO_BASE_URL}/api/gm/data/{path}")
        r.raise_for_status()
        return r.text


@mcp.tool
async def write_file(path: str, content: str) -> dict:
    """Write content to a campaign file. Triggers SSE broadcast to player terminals.

    Supported extensions:
      .yaml / .yml — full YAML validation applied; content must be valid YAML.
      .md          — YAML frontmatter block (between leading --- fences) is validated if present;
                     the markdown body is written as-is. Use this for terminal logs
                     (e.g. comms/analysis-lab/logs/001-entry.md) and routed messages
                     (e.g. comms/messages/001_discovery.md).
    """
    async with httpx.AsyncClient() as client:
        r = await client.put(
            f"{DJANGO_BASE_URL}/api/gm/data/{path}",
            content=content,
            headers={"Content-Type": "text/plain; charset=utf-8"},
        )
        r.raise_for_status()
        return r.json()


@mcp.tool
async def read_field(path: str, field_path: str) -> Any:
    """Read a single field from a YAML file by dot-path. Returns only the field value, not the whole file.

    path: relative to data/ (e.g. 'galaxy/star_map.yaml')
    field_path: dot-separated path to the field (e.g. 'star.name', 'camera.fov', 'systems')
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{DJANGO_BASE_URL}/api/gm/data/{path}",
            params={"field": field_path},
        )
        r.raise_for_status()
        return r.json()["value"]


@mcp.tool
async def append_list_item(path: str, list_key: str, item: dict) -> dict:
    """Append an item to a named list in a YAML file. No need to read the file first — the server
    handles the read-modify-write atomically and triggers SSE broadcast.

    path: relative to data/ (e.g. 'galaxy/star_map.yaml')
    list_key: top-level list key to append to (e.g. 'systems', 'bodies', 'nebulae', 'moons', 'routes')
    item: dict of the new entry to append

    If list_key does not exist in the file yet, it is created as an empty list first.
    """
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{DJANGO_BASE_URL}/api/gm/data-list-append/{path}",
            json={"list_key": list_key, "item": item},
        )
        r.raise_for_status()
        return r.json()


@mcp.tool
async def patch_yaml(path: str, patch: dict) -> dict:
    """Apply a JSON merge patch to a YAML file. Only send the fields that changed — no read required.
    Nested dicts are merged recursively; list values in the patch replace existing lists.
    Triggers SSE broadcast on success.

    path: relative to data/ (e.g. 'campaign/corporation.yaml')
    patch: dict of fields to set (supports nested dicts for deep merge)
    """
    async with httpx.AsyncClient() as client:
        r = await client.patch(
            f"{DJANGO_BASE_URL}/api/gm/data/{path}",
            json=patch,
            headers={"Content-Type": "application/json"},
        )
        r.raise_for_status()
        return r.json()


@mcp.tool
async def find_map_element(deckplan: str, query: str) -> dict:
    """Resolve a natural map reference to candidate deckplan element ids WITHOUT loading the file.

    Use this to disambiguate before editing — e.g. 'coolant tanks' may match several rooms.
    You can also skip it and call edit_map_element directly; it returns candidates when the
    target is ambiguous.

    deckplan: path to the deckplan relative to data/ (e.g. 'ships/patrol_gunboat/deckplan.yaml')
    query: a room/corridor name or id, a door id, or a glob like 'coolant_tanks*'

    Returns {"matches": [{"id","kind","label","deck"}], "strategy", "suggestions"?}.
    kind is one of room | corridor | door. Rooms/corridors are matched by id or display name;
    doors are matched by their id of the form '<roomA>__<roomB>__<index>' (or '<room>__exterior__<index>').
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{DJANGO_BASE_URL}/api/gm/data-map-edit/{deckplan}",
            params={"q": query},
        )
        r.raise_for_status()
        return r.json()


@mcp.tool
async def edit_map_element(
    deckplan: str,
    target: str,
    set: dict | None = None,
    add_poi: dict | None = None,
    remove_poi=None,
) -> dict:
    """Edit ONE element (room/corridor/door) in a deckplan without loading or rewriting the file.

    Prefer this over read_file + write_file for changing a single room, door, or POI — the edit
    happens server-side, so you never spend tokens loading the whole deckplan.

    deckplan: path relative to data/ (e.g. 'ships/patrol_gunboat/deckplan.yaml')
    target: element reference (id, room/corridor name, or door id). If it matches more than one
            element, this returns {"error":"ambiguous","candidates":[...]} — show the candidates to
            the GM and ask which one, then retry with a specific id. If nothing matches it returns
            {"error":...,"suggestions":[...]}.

    Provide EXACTLY ONE of:
      set:        dict of fields to deep-merge into the element. Works for any field —
                  rooms: description, label_offset ([dx,dy] grid cells), name, type;
                  doors: status (OPEN|CLOSED|LOCKED|SEALED|DAMAGED|BROKEN), type.
      add_poi:    a POI to append to a ROOM (not a door): {icon, label?, type?, position?, description?}.
                  icon is a lowercase icon name; type is item|objective|hazard|npc|player.
      remove_poi: a POI label (str) or 0-based index (int) to remove from the room.

    POIs are addressed through their room (you never target a POI directly). Use plain ASCII in
    string values (no em-dashes / curly quotes) per the encounter YAML rules.

    Returns {"ok": true, "element", "kind", "op", "deck"} on success.
    """
    body: dict = {"target": target}
    if set is not None:
        body["set"] = set
    if add_poi is not None:
        body["add_poi"] = add_poi
    if remove_poi is not None:
        body["remove_poi"] = remove_poi
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{DJANGO_BASE_URL}/api/gm/data-map-edit/{deckplan}",
            json=body,
        )
        # Ambiguous (409) / not-found (404): return the body so the caller can ask the GM
        # which element they mean, rather than raising.
        if r.status_code in (404, 409):
            return r.json()
        r.raise_for_status()
        return r.json()


@mcp.tool
async def delete_file(path: str) -> dict:
    """Delete a campaign data file. path is relative to data/ (e.g. 'campaign/crew/old_npc.yaml').

    Triggers SSE broadcast on success. Cannot delete directories.
    Returns: {"ok": true, "path": str, "action": "deleted"}
    """
    async with httpx.AsyncClient() as client:
        r = await client.delete(f"{DJANGO_BASE_URL}/api/gm/data/{path}")
        r.raise_for_status()
        return r.json()


@mcp.tool
async def rename_file(path: str, new_path: str) -> dict:
    """Rename or move a campaign data file within the data directory.

    path: current path relative to data/ (e.g. 'campaign/crew/alex.yaml')
    new_path: destination path relative to data/ (e.g. 'campaign/crew/alex_novak.yaml')

    Both paths must stay within data/. Destination directory is created automatically.
    Fails with 409 if destination already exists. Triggers SSE broadcast on success.
    Returns: {"ok": true, "old_path": str, "new_path": str}
    """
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{DJANGO_BASE_URL}/api/gm/data-rename/{path}",
            json={"new_path": new_path},
        )
        r.raise_for_status()
        return r.json()


@mcp.tool
async def upload_svg_map(
    filename: str,
    content_base64: str,
    out_dir: str,
    deck: str = "main_deck",
    name: str = "",
    location_type: str = "ship",
    unit_size: int = 30,
    grid_scale: int = 1,
    detect_doors: bool = False,
) -> dict:
    """Upload an SVG deckplan, convert it with svg_to_map.py, and write results to the data directory.

    filename: SVG filename (e.g. "patrol_gunboat.svg")
    content_base64: base64-encoded SVG file bytes

    out_dir: destination location directory relative to data/
             (e.g. "galaxy/tau-ceti/patrol_gunboat")
             Created automatically if it does not exist.

    deck: deck YAML filename stem for single-deck SVGs (default: "main_deck")
          Ignored when the SVG contains multiple deck layers (multi-deck mode).
    name: map display name (default: derived from SVG filename)
    location_type: value for stub location.yaml type field (default: "ship")
    unit_size: pixels per output grid cell in deck YAML (default: 30)
    grid_scale: group N Inkscape cells into 1 output cell (default: 1)
                Use when rooms have too many cells and tokens look tiny.
                Run once with grid_scale=1 first; check the log for room
                dimensions; aim for the largest room ~8–12 cells wide.
    detect_doors: auto-detect doors from shared room/corridor edges (default: false)

    SVG layer conventions:
      Single-deck: top-level "Hull" / "Rooms" / "Corridors" layers.
      Multi-deck:  top-level deck layers (any label) each containing "Rooms" and/or
                   "Corridors" sublayers. Auto-detected — one upload produces all decks.

    The SVG is saved as <out_dir>/<filename>.svg for future re-conversion.
    Always writes <out_dir>/deckplan.yaml (canonical single-file format, overwritten each run).
    Returns:
      { out_dir, svg_path, files_created: [...], log: str }
    The log includes room dimensions — use it to decide if grid_scale needs adjusting.

    Prefer direct curl multipart upload for files over ~200KB:
      curl -X POST http://<host>/api/gm/upload-svg-map/ \\
        -F file=@plan.svg -F out_dir=galaxy/tau-ceti/my_ship -F grid_scale=4
    """
    async with httpx.AsyncClient(timeout=90.0) as client:
        r = await client.post(
            f"{DJANGO_BASE_URL}/api/gm/upload-svg-map/",
            json={
                "filename": filename,
                "content_base64": content_base64,
                "out_dir": out_dir,
                "deck": deck,
                "name": name,
                "type": location_type,
                "unit_size": unit_size,
                "grid_scale": grid_scale,
                "detect_doors": detect_doors,
            },
        )
        r.raise_for_status()
        return r.json()


@mcp.tool
async def get_data_schema() -> str:
    """Return the DATA_DIRECTORY_GUIDE summary so the AI understands the campaign file structure and what files exist."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{DJANGO_BASE_URL}/api/gm/data-schema")
        r.raise_for_status()
        return r.text


@mcp.tool
async def get_django_url() -> str:
    """Return the externally accessible Django base URL for direct HTTP uploads from client machines (e.g. curl from Windows)."""
    return JANUS_EXTERNAL_URL


@mcp.tool
async def upload_image(
    filename: str,
    content_base64: str,
    image_type: str,
    convert: bool = True,
) -> dict:
    """Upload a base64-encoded image to the campaign data directory.

    Prefer direct curl multipart upload for files over ~50KB — base64 through this tool
    pipeline bloats Claude's context window. Use get_django_url() + curl instead.

    image_type controls the destination:
      - "portrait" → data/campaign/images/sources/<filename> (original)
      - "logo"     → data/campaign/images/logos/<filename>
      - "map"      → data/campaign/images/maps/<filename>
      - "misc"     → data/campaign/images/misc/<filename>

    convert (default True, portrait only): when True and image_type is "portrait",
    Django applies an amber-gradient 512x512 conversion using Pillow and writes the
    display-ready result to data/campaign/images/portraits/<filename>. Set to False
    to store only the original bytes in sources/ unchanged.

    Returns:
      {
        "saved_path": str,           # relative path within data/ where the file was written
        "converted_path": str,       # only present when conversion was applied
        "original_size_bytes": int   # size of the raw decoded bytes
      }
    """
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{DJANGO_BASE_URL}/api/gm/upload-image/",
            json={
                "filename": filename,
                "content_base64": content_base64,
                "image_type": image_type,
                "convert": convert,
            },
        )
        r.raise_for_status()
        return r.json()


if __name__ == "__main__":
    mcp.run(transport="sse", host="0.0.0.0", port=8001)
