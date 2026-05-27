# Phase 27: MCP Image Upload — Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Add binary image upload capability to the JANUS MCP server and expose it through two new janus-skills. The scope covers:
1. A new `upload_image` MCP tool in `mcp_server.py` (charon repo)
2. A new Django API endpoint for binary file upload (called by the MCP tool)
3. Directory taxonomy for image assets under `data/campaign/`
4. Two new SKILL.md files in `janus-skills/skills/`

Out of scope: image display in the UI, schema changes, serving images via Django views.

</domain>

<decisions>
## Implementation Decisions

### Phase Number
- This is Phase 27. Phase 26 was ad-hoc map polish (committed directly, no formal plan).

### D-01: Directory Taxonomy (LOCKED)
NPC portraits follow the existing `images_source` → `images` pattern already established in `data/campaign/NPCs/`. Other image types get explicit subdirectories under `data/campaign/images/`:

```
data/campaign/
  NPCs/
    images_source/   ← raw portrait source files uploaded here
    images/          ← amber-gradient converted portraits (512×512)
  images/
    logos/           ← corporation and ship logos
    maps/            ← handout maps, encounter art
    misc/            ← anything else
```

### D-02: MCP Tool Design (LOCKED)
- Tool name: `upload_image`
- Parameters:
  - `filename: str` — destination filename (no path traversal)
  - `content_base64: str` — base64-encoded binary content
  - `image_type: str` — one of `portrait`, `logo`, `map`, `misc`
  - `convert: bool` (optional, default `true`) — only meaningful for `portrait` type; triggers `convert_npc_portraits.py`
- Return: `{saved_path, converted_path?, original_size_bytes}`
- Path resolution by type: portrait → `data/campaign/NPCs/images_source/{filename}`, logo → `data/campaign/images/logos/{filename}`, map → `data/campaign/images/maps/{filename}`, misc → `data/campaign/images/misc/{filename}`
- Path traversal defense: reject filenames containing `/`, `..`, or `\`

### D-03: Portrait Conversion (LOCKED)
- `convert: true` (default for portrait skill) → after saving to `images_source/`, call `scripts/convert_npc_portraits.py` to produce `data/campaign/NPCs/images/{basename}.png`
- `convert: false` → save raw source only; caller triggers conversion later
- Conversion is skipped (no-op) for non-portrait image types regardless of flag value

### D-04: Django API Endpoint (LOCKED)
The MCP tool calls Django via HTTP (following Phase 23 pattern). New endpoint:
- `POST /api/gm/upload-image/` — JSON with base64; performs path resolution, saves file, optionally runs conversion script (follows existing `/api/gm/` prefix convention)

### D-05: Path Traversal Defense (LOCKED)
- Validate filename on the Django side: reject if it contains `/`, `..`, or `\`
- MCP tool passes filename through unchanged — Django is the authoritative guard

### D-06: Pillow Dependency (LOCKED)
- Add `Pillow>=10.0.0` to `requirements.txt` — required for Docker (Pillow was installed in .venv but missing from requirements.txt)

### D-07: Skill Files (LOCKED)
Two new skills in `janus-skills/skills/`:
1. `janus-upload-portrait/SKILL.md` — guide for uploading NPC portrait from a local file path; defaults convert=true; explains the two-step source→converted workflow
2. `janus-upload-image/SKILL.md` — guide for uploading logo, map, or misc image; requires image_type param; no conversion

### D-08: Where Skills Live (LOCKED)
janus-skills repo only (`/home/gjohnson/mothership/janus-skills/`). No charon-local skill needed.

### Claude's Discretion
- Whether to use multipart form upload vs. base64 JSON for the Django endpoint (base64 JSON is simpler to implement consistently with existing write_file pattern)
- Error message wording
- Whether to create missing subdirectories automatically (recommend: yes, with `makedirs(exist_ok=True)`)
- Exact HTTP status codes returned by the Django endpoint

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing MCP Server (extend, don't replace)
- `mcp_server.py` — FastMCP server with 5 existing tools; new `upload_image` tool follows the same `@mcp.tool` + Django API call pattern

### Existing Django API endpoints (pattern to follow)
- `core/views.py` — look at `write_file_view` (or similar) for the request/response pattern; new upload endpoint should follow the same path-validation and response shape

### Portrait Conversion Script
- `scripts/convert_npc_portraits.py` — reads from `images_source/`, writes to `images/`; invoked via `subprocess` or direct Python import from the Django view

### Existing janus-skills to mirror style
- `janus-skills/skills/janus-add-npc/SKILL.md` — reference skill format, header structure, step format, MCP tool call examples
- `janus-skills/skills/janus-add-ship/SKILL.md` — second reference

### Data directory layout (existing)
- `data/campaign/NPCs/` — contains `images_source/`, `images/`, and NPC YAML files

</canonical_refs>

<specifics>
## Specific Implementation Notes

- `convert_npc_portraits.py` already skips files that already exist in the output directory (idempotent). Calling it after each portrait upload is fine — it only processes files not yet converted.
- The script's defaults: `source_dir = data/campaign/NPCs/images_source`, `output_dir = data/campaign/NPCs/images`. When calling from the Django view, pass explicit absolute paths.
- The `data/campaign/images/logos/` directory already contains `korova-stahl-logo.png` — directory should not be created if it already exists.
- Base64 decode + binary write is straightforward: `base64.b64decode(content_base64)` then open in `'wb'` mode.

</specifics>

<deferred>
## Deferred Ideas

- Image serving via Django static/media URL (Phase 27 only writes files; the frontend already reads portraits from a known path)
- Image resize/optimization for logos/maps (conversion is portrait-specific for now)
- Authentication on the upload endpoint (homelab trust-the-network model, same as Phase 23)
- Thumbnail generation

</deferred>

---

*Phase: 27-mcp-image-upload*
*Context gathered: 2026-05-27 via planning discussion*
