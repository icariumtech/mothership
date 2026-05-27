# Phase 27: MCP Image Upload — Research

**Researched:** 2026-05-27
**Domain:** FastMCP tool extension + Django binary file upload + Python image conversion
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Directory taxonomy:** NPC portraits → `data/campaign/NPCs/images_source/`; logos → `data/campaign/images/logos/`; maps → `data/campaign/images/maps/`; misc → `data/campaign/images/misc/`
- **MCP tool name:** `upload_image` with params `filename: str`, `content_base64: str`, `image_type: str` (`portrait|logo|map|misc`), `convert: bool` (optional, default `true`)
- **Return shape:** `{saved_path, converted_path?, original_size_bytes}`
- **Path traversal defense:** reject filenames containing `/`, `..`, or `\`
- **Portrait conversion:** `convert: true` → call `scripts/convert_npc_portraits.py` after save; `convert: false` → save raw only; non-portrait types skip conversion regardless
- **Django endpoint:** `POST /api/upload-image/` — base64 JSON body (following Phase 23 pattern)
- **Skills:** `janus-upload-portrait/SKILL.md` and `janus-upload-image/SKILL.md` in janus-skills only (no charon-local skill)

### Claude's Discretion
- Multipart vs. base64 JSON for Django endpoint (base64 JSON preferred — consistent with write_file pattern)
- Error message wording
- Auto-create missing subdirectories with `makedirs(exist_ok=True)` (recommend yes)
- Exact HTTP status codes

### Deferred Ideas (OUT OF SCOPE)
- Image serving via Django static/media URL
- Image resize/optimization for logos/maps
- Authentication on upload endpoint
- Thumbnail generation
</user_constraints>

---

## Summary

Phase 27 adds a single new MCP tool (`upload_image`) to the existing 5-tool FastMCP server in `mcp_server.py`, a new Django view function (`api_gm_upload_image`) in `core/views/gm_data.py`, and two new SKILL.md files in the janus-skills repo. The implementation is a straightforward extension of the pattern established in Phase 23.

The MCP tool receives base64-encoded binary data as a `str` parameter — this is identical in mechanism to how `write_file` receives YAML content today. FastMCP 3.3.1 handles `bool` parameters with defaults (`convert: bool = True`) natively via Python type annotations with no special configuration required.

The Django view decodes base64, validates path safety, `makedirs(exist_ok=True)` for the target directory, writes raw bytes, and optionally calls `convert_npc_portraits.py`'s `convert_portrait()` function directly via Python import (no subprocess needed — the function is importable and Pillow 12.0.0 is installed in the venv).

**Primary recommendation:** Implement the Django view with direct Python import of `convert_portrait()`, not `subprocess.run`. This avoids PATH/cwd issues in Docker, is synchronous-safe (Gunicorn gevent workers handle blocking I/O fine), and keeps error handling clean.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Base64 decode + file write | API / Backend (Django view) | — | Binary I/O belongs in the server layer, not in the MCP tool itself |
| Path safety validation | API / Backend (Django view) | MCP tool (filename-only check) | Defense in depth; Django view is the authoritative guard |
| Directory routing by type | API / Backend (Django view) | — | Server owns path resolution; MCP tool passes image_type as intent |
| Portrait conversion dispatch | API / Backend (Django view) | — | Django has access to scripts/ and Pillow; MCP tool just passes convert flag |
| MCP tool interface | MCP Server (mcp_server.py) | — | Thin HTTP delegation layer per existing Phase 23 pattern |
| Skill workflow guidance | janus-skills (SKILL.md files) | — | Skills live only in janus-skills repo (locked decision) |

---

## Standard Stack

### Core (all already in requirements.txt or stdlib)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `base64` | stdlib | Decode base64 content_base64 param | [VERIFIED: Python stdlib] |
| `pathlib.Path` | stdlib | Path resolution and safety checks | [VERIFIED: Python stdlib] — already used in gm_data.py |
| `os.makedirs` / `Path.mkdir` | stdlib | Create missing subdirectories | [VERIFIED: Python stdlib] |
| Pillow (`PIL`) | 12.0.0 | Image conversion via direct import of `convert_portrait()` | [ASSUMED] — installed in `.venv`, not in `requirements.txt` |
| FastMCP | 3.3.1 | `@mcp.tool` decorator, bool param with default | [VERIFIED: requirements.txt] |
| `httpx` | ≥0.27.0 | MCP tool → Django HTTP POST | [VERIFIED: requirements.txt] |

**Critical gap discovered:** Pillow 12.0.0 is installed in `.venv` but is **not listed in `requirements.txt`**. The Docker image builds from `requirements.txt` only — Pillow will not be present in the container. `convert_npc_portraits.py` will fail at import time if called from the Django view inside Docker.

**Resolution required before planning:** Either (a) add `Pillow` to `requirements.txt`, or (b) invoke conversion via `subprocess.run` pointing at the host Python where Pillow is installed. Option (a) is strongly preferred — Pillow is already a de facto project dependency for the scripts/ directory.

### No New External Libraries
This phase installs no new packages beyond the Pillow gap closure above.

---

## Package Legitimacy Audit

No new external packages are being introduced in this phase. The only dependency gap is Pillow (already installed in the venv, just missing from requirements.txt).

| Package | Registry | Age | Downloads | slopcheck | Disposition |
|---------|----------|-----|-----------|-----------|-------------|
| Pillow | PyPI | 13+ yrs | >500M/wk | N/A (already installed) | Add to requirements.txt |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Claude Code (with janus-skills skill)
    |
    | MCP call: upload_image(filename, content_base64, image_type, convert)
    v
mcp_server.py  [FastMCP @mcp.tool]
    |
    | POST /api/upload-image/   JSON body: {filename, content_base64, image_type, convert}
    v
Django: core/views/gm_data.py  [api_gm_upload_image]
    |
    |-- validate filename (no / .. \)
    |-- resolve destination path by image_type
    |-- makedirs(exist_ok=True)
    |-- base64.b64decode(content_base64)
    |-- open(dest, 'wb').write(decoded_bytes)
    |
    +-- if image_type == 'portrait' and convert == True:
    |       from scripts.convert_npc_portraits import convert_portrait
    |       convert_portrait(source_path, output_path)
    |
    v
data/campaign/
    NPCs/images_source/{filename}    (portrait type)
    NPCs/images/{stem}.png           (converted portrait)
    images/logos/{filename}          (logo type)
    images/maps/{filename}           (map type)
    images/misc/{filename}           (misc type)
```

### Recommended Project Structure (additions only)
```
core/views/
└── gm_data.py                # Add api_gm_upload_image() here (same file as existing GM data views)

core/urls.py                  # Add path('api/gm/upload-image/', ...) entry
core/views/__init__.py        # Add api_gm_upload_image to imports

janus-skills/skills/
├── janus-upload-portrait/
│   └── SKILL.md
└── janus-upload-image/
    └── SKILL.md

data/campaign/images/
├── korova-stahl-logo.png     # EXISTS — stays here (not moved to logos/)
├── logos/                    # CREATE (empty, .gitkeep)
├── maps/                     # CREATE (empty, .gitkeep)
└── misc/                     # CREATE (empty, .gitkeep)
```

### Pattern 1: FastMCP Tool with Optional Bool Parameter
**What:** `@mcp.tool` decorated async function with typed parameters including a bool with default.
**When to use:** Whenever a tool has an optional behavior flag.

```python
# Source: gofastmcp.com/servers/tools (CITED) + existing mcp_server.py pattern [VERIFIED: codebase]
@mcp.tool
async def upload_image(
    filename: str,
    content_base64: str,
    image_type: str,
    convert: bool = True,
) -> dict:
    """Upload a binary image file. image_type must be one of: portrait, logo, map, misc.
    For portrait type, convert=True (default) triggers amber-gradient conversion."""
    async with httpx.AsyncClient() as client:
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
```

### Pattern 2: Django Binary-Write View (base64 JSON)
**What:** `@csrf_exempt` POST view that decodes base64 content and writes binary.
**When to use:** This is the new upload endpoint pattern; mirrors `api_gm_data_file` PUT for text.

```python
# Source: core/views/gm_data.py existing pattern [VERIFIED: codebase]
import base64
import logging
from pathlib import Path
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

logger = logging.getLogger(__name__)

ALLOWED_IMAGE_TYPES = {'portrait', 'logo', 'map', 'misc'}

@csrf_exempt
def api_gm_upload_image(request):
    """POST /api/gm/upload-image/ — save base64-encoded image to data directory.
    
    Body (JSON):
      filename:       str  — destination filename, no path separators
      content_base64: str  — base64-encoded binary content
      image_type:     str  — one of portrait|logo|map|misc
      convert:        bool — (portrait only) trigger amber-gradient conversion; default true
    
    Returns:
      {saved_path, converted_path?, original_size_bytes}
    
    INTENTIONALLY UNAUTHENTICATED: trust-network model per D-09.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)
    
    filename = body.get('filename', '').strip()
    content_base64 = body.get('content_base64', '')
    image_type = body.get('image_type', '').strip()
    convert = body.get('convert', True)
    
    # Filename safety: reject path traversal characters
    if not filename or any(c in filename for c in ('/', '\\', '..')):
        return JsonResponse({'error': 'Invalid filename'}, status=400)
    
    if image_type not in ALLOWED_IMAGE_TYPES:
        return JsonResponse(
            {'error': f"Invalid image_type; must be one of: {', '.join(sorted(ALLOWED_IMAGE_TYPES))}"},
            status=400,
        )
    
    # Resolve destination path
    data_root = Path(settings.DATA_DIR)
    type_dirs = {
        'portrait': data_root / 'campaign' / 'NPCs' / 'images_source',
        'logo':     data_root / 'campaign' / 'images' / 'logos',
        'map':      data_root / 'campaign' / 'images' / 'maps',
        'misc':     data_root / 'campaign' / 'images' / 'misc',
    }
    dest_dir = type_dirs[image_type]
    dest_path = dest_dir / filename
    
    # Decode base64 content
    try:
        raw_bytes = base64.b64decode(content_base64)
    except Exception:
        return JsonResponse({'error': 'Invalid base64 content'}, status=400)
    
    # Write file
    dest_dir.mkdir(parents=True, exist_ok=True)
    try:
        dest_path.write_bytes(raw_bytes)
    except OSError as e:
        logger.exception('Error writing image %s: %s', filename, e)
        return JsonResponse({'error': 'Could not write file'}, status=500)
    
    result = {
        'saved_path': str(dest_path.relative_to(data_root)),
        'original_size_bytes': len(raw_bytes),
    }
    
    # Optional portrait conversion
    if image_type == 'portrait' and convert:
        images_dir = data_root / 'campaign' / 'NPCs' / 'images'
        stem = Path(filename).stem
        output_path = images_dir / f'{stem}.png'
        images_dir.mkdir(parents=True, exist_ok=True)
        try:
            import sys
            scripts_dir = str(Path(settings.BASE_DIR) / 'scripts')
            if scripts_dir not in sys.path:
                sys.path.insert(0, scripts_dir)
            from convert_npc_portraits import convert_portrait
            convert_portrait(str(dest_path), str(output_path))
            result['converted_path'] = str(output_path.relative_to(data_root))
        except Exception as e:
            logger.exception('Portrait conversion failed for %s: %s', filename, e)
            # Non-fatal: source was saved successfully; return warning
            result['conversion_warning'] = str(e)
    
    return JsonResponse(result)
```

### Pattern 3: SKILL.md Header Format
**What:** Frontmatter + `@`-include + structured `<objective>`, `<process>` sections.
**When to use:** Both new skills follow janus-add-npc/janus-add-ship format exactly.

```markdown
# Source: janus-skills/skills/janus-add-npc/SKILL.md [VERIFIED: codebase]
---
name: janus-upload-portrait
description: "Upload an NPC portrait image from a local file path. Saves to images_source/ and runs amber-gradient conversion."
argument-hint: "<filename-or-path>"
allowed-tools:
  - mcp__JanusGM__upload_image
---

@$HOME/.claude/janus-skills/resources/schema-campaign.md

# /janus-upload-portrait
...
```

### Anti-Patterns to Avoid
- **`subprocess.run` for conversion:** The `convert_portrait()` function is directly importable. `subprocess` adds process overhead, PATH ambiguity in Docker, and complicates error handling. Use direct Python import instead.
- **Multipart form upload:** Adds complexity for no benefit. The existing Django API uses JSON bodies throughout. Base64 JSON keeps the pattern consistent.
- **Storing base64 in the response:** Return only paths and byte count. The caller already has the image — no need to echo it back.
- **Moving `korova-stahl-logo.png`:** The existing logo lives at `data/campaign/images/korova-stahl-logo.png` (not in `logos/`). Do NOT move it. New uploads go to `logos/`. The CONTEXT.md note that "logos/ already contains korova-stahl-logo.png" is inaccurate — the file is in the parent directory.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Portrait amber conversion | Custom image processing | `convert_portrait()` in scripts/convert_npc_portraits.py | Already written, tested, idempotent |
| Path safety | Custom sanitizer regex | `Path.resolve().is_relative_to()` + character blocklist | Same pattern already in `api_gm_data_file` |
| Atomic file write | Custom temp-file logic | `Path.write_bytes()` (binary is fine for non-text; no YAML validation needed) | Images are not text; atomic rename only matters for text files read concurrently |
| Base64 decode | Custom decode | `base64.b64decode()` stdlib | Handles padding automatically |
| Directory creation | Existence checks + mkdir | `mkdir(parents=True, exist_ok=True)` | One-liner, race-safe |

**Key insight:** This phase is almost entirely glue code — connect existing pieces. The conversion script, the MCP transport pattern, and the Django file-write pattern all exist. The main task is wiring them together correctly.

---

## Common Pitfalls

### Pitfall 1: Pillow Missing from requirements.txt
**What goes wrong:** Docker image builds without Pillow. `from convert_npc_portraits import convert_portrait` fails at import with `ModuleNotFoundError: No module named 'PIL'`. Portrait conversion silently breaks in production.
**Why it happens:** Pillow was installed manually in the dev venv but never added to `requirements.txt`. The Dockerfile runs `pip install -r requirements.txt` only.
**How to avoid:** Add `Pillow>=10.0.0` to `requirements.txt` as part of Wave 0 / first task.
**Warning signs:** Import error logged in gunicorn output; `conversion_warning` key appears in every upload response.

### Pitfall 2: CONTEXT.md Directory Discrepancy
**What goes wrong:** Plan assumes `data/campaign/images/logos/` already exists and contains `korova-stahl-logo.png`. In reality, the logo lives at `data/campaign/images/korova-stahl-logo.png` and the `logos/`, `maps/`, `misc/` subdirs do not exist.
**Why it happens:** CONTEXT.md note was slightly inaccurate about the existing layout.
**How to avoid:** Plan must create all three subdirectories (`logos/`, `maps/`, `misc/`) with `.gitkeep` files. Do not move the existing logo.
**Warning signs:** `FileNotFoundError` when trying to write to `logos/` without `makedirs`.

### Pitfall 3: Path Traversal in Filename
**What goes wrong:** Caller passes `filename = "../../../etc/passwd"` — file written outside data directory.
**Why it happens:** `filename` is user-controlled input.
**How to avoid:** Reject any filename containing `/`, `\`, or `..` before path construction. This is simpler than `Path.resolve()` checks because `filename` should be a bare name with no path components at all.
**Warning signs:** Filename contains any of those characters.

### Pitfall 4: `convert_portrait()` Skips Existing Outputs
**What goes wrong:** If `data/campaign/NPCs/images/{stem}.png` already exists, `convert_portrait()` will NOT overwrite it (it's idempotent by design). Re-uploading a portrait source will not update the converted image.
**Why it happens:** The conversion script's `main()` is idempotent — it's designed for batch runs. But `convert_portrait(input_path, output_path)` itself does NOT check for existence; only `main()` skips existing files.
**How to avoid:** Call `convert_portrait(src, dst)` directly (not `main()`). The direct function always converts. This is already the recommended approach.
**Warning signs:** Confusion if someone calls `main()` instead of `convert_portrait()`.

### Pitfall 5: `sys.path` Mutation in Django
**What goes wrong:** Adding `scripts/` to `sys.path` inside a request handler mutates a global; concurrent requests see it inconsistently during the window before the first insert.
**Why it happens:** `sys.path` is process-global.
**How to avoid:** Do the `sys.path.insert` check with `if scripts_dir not in sys.path` guard (idempotent after first call). Or better: add `scripts/` to `sys.path` at Django app startup in `core/apps.py` `ready()` method.
**Warning signs:** `ImportError` on concurrent first requests (extremely unlikely with workers=1 but worth noting).

### Pitfall 6: FastMCP `bool` Default Serialization
**What goes wrong:** Some MCP clients serialize `True` as `"true"` (string) rather than `true` (JSON boolean). The Django view receives a string and `convert` evaluates as always truthy.
**Why it happens:** MCP tool call serialization varies by client.
**How to avoid:** Normalize in the Django view: `convert = body.get('convert', True)` then `if not isinstance(convert, bool): convert = str(convert).lower() not in ('false', '0', 'no')`.
**Warning signs:** `convert=false` doesn't suppress conversion.

---

## Code Examples

### Full MCP Tool (upload_image)
```python
# Source: mcp_server.py existing pattern [VERIFIED: codebase]
@mcp.tool
async def upload_image(
    filename: str,
    content_base64: str,
    image_type: str,
    convert: bool = True,
) -> dict:
    """Upload a binary image file to the campaign data directory.
    
    image_type must be one of: portrait, logo, map, misc.
    - portrait: saved to data/campaign/NPCs/images_source/{filename}
    - logo: saved to data/campaign/images/logos/{filename}
    - map: saved to data/campaign/images/maps/{filename}
    - misc: saved to data/campaign/images/misc/{filename}
    
    convert (portrait only, default True): run amber-gradient conversion after save,
    producing data/campaign/NPCs/images/{stem}.png.
    
    Returns: {saved_path, converted_path?, original_size_bytes}
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
```

**Note on timeout:** Base64 decoding + Pillow conversion of a 500KB source image can take 1-3 seconds. The default httpx timeout (5s) is usually sufficient but setting `timeout=60.0` is safer for large files.

### convert_portrait Direct Import
```python
# Source: scripts/convert_npc_portraits.py [VERIFIED: codebase]
# Function signature:
def convert_portrait(input_path: str, output_path: str) -> None:
    """Load, resize (512x512 center crop), amber-convert, and save portrait."""
    ...
# Called with absolute string paths. Does NOT check if output exists — always converts.
# Raises PIL.UnidentifiedImageError if input is not a valid image.
# Creates output directory is NOT done by this function — caller must makedirs first.
```

### Skill SKILL.md Structure (janus-upload-portrait)
```markdown
---
name: janus-upload-portrait
description: "Upload an NPC portrait from a local file. Saves to images_source/ and runs amber-gradient conversion by default."
argument-hint: "<path-to-image>"
allowed-tools:
  - mcp__JanusGM__upload_image
---

@$HOME/.claude/janus-skills/resources/schema-campaign.md

# /janus-upload-portrait

<objective>
Upload a portrait image file for an NPC and save it to the campaign's images_source/ directory.
By default, also runs the amber-gradient conversion pass (512×512, amber tint) that produces
the display-ready portrait in data/campaign/NPCs/images/.
</objective>

<process>
1. Read the local file at $ARGUMENTS as binary and encode to base64.
2. Extract just the filename (no directory path) from $ARGUMENTS.
3. Call upload_image(filename=<name>, content_base64=<b64>, image_type="portrait", convert=true).
4. Report: saved_path, converted_path (if present), original_size_bytes.
</process>
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Multipart form upload | Base64 JSON (consistent with existing write_file pattern) | Simpler Django view, no multipart parser needed |
| `subprocess.run` for conversion | Direct Python function import | No subprocess overhead, clean error propagation |

**Nothing deprecated** in this phase — all patterns are current.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | FastMCP 3.3.1 `bool = True` default parameter works as expected with MCP JSON transport | Standard Stack | `convert` param always True or always ignored; mitigation: add bool normalization in Django view |
| A2 | `convert_portrait(input_path, output_path)` does NOT skip existing output (only `main()` skips) | Don't Hand-Roll | Re-uploads don't update converted image; mitigation: verify with a quick test run |
| A3 | Adding `scripts/` to `sys.path` in a Django view is acceptable with workers=1 | Code Examples | Thread-safety issue (very low risk at workers=1) |

---

## Open Questions

1. **Pillow in requirements.txt**
   - What we know: Pillow 12.0.0 is installed in `.venv` but absent from `requirements.txt`; Docker builds from `requirements.txt` only
   - What's unclear: Whether this was intentional (scripts/ is dev-only tooling) or an oversight
   - Recommendation: Add `Pillow>=10.0.0` to `requirements.txt` in Wave 0; this is the safest path and aligns with the script being in the project repo

2. **httpx timeout for large images**
   - What we know: Default httpx timeout is 5 seconds; Pillow conversion of a 500KB portrait can take 1-3 seconds
   - Recommendation: Set `timeout=60.0` on the `AsyncClient` for the upload_image tool call

3. **Existing `korova-stahl-logo.png` location**
   - What we know: File is at `data/campaign/images/korova-stahl-logo.png` (not in `logos/`)
   - Recommendation: Leave existing file in place; create `logos/` subdir with `.gitkeep`; no migration needed

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.12 | Django view, conversion | ✓ | 3.12.x | — |
| Pillow (PIL) | Portrait conversion | ✓ (venv) / ✗ (Docker image) | 12.0.0 | Add to requirements.txt |
| `base64` stdlib | Binary decode | ✓ | stdlib | — |
| FastMCP 3.3.1 | MCP server | ✓ (requirements.txt) | 3.3.1 | — |
| httpx | MCP → Django HTTP | ✓ (requirements.txt) | ≥0.27.0 | — |
| `data/campaign/images/logos/` | Logo uploads | ✗ (missing) | — | Create with makedirs |
| `data/campaign/images/maps/` | Map uploads | ✗ (missing) | — | Create with makedirs |
| `data/campaign/images/misc/` | Misc uploads | ✗ (missing) | — | Create with makedirs |

**Missing dependencies with no fallback:**
- Pillow in Docker image (blocks portrait conversion in production) — must add to `requirements.txt`

**Missing dependencies with fallback:**
- `logos/`, `maps/`, `misc/` directories — view creates them automatically via `makedirs(exist_ok=True)`

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Django TestCase (`django.test.TestCase`) |
| Config file | none — `python manage.py test core.tests` |
| Quick run command | `python manage.py test core.tests.test_gm_api` |
| Full suite command | `python manage.py test core` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| — | POST /api/gm/upload-image/ with valid portrait base64 returns 200 + saved_path | unit | `python manage.py test core.tests.test_upload_image` | ❌ Wave 0 |
| — | POST with invalid image_type returns 400 | unit | same | ❌ Wave 0 |
| — | POST with path-traversal filename (../foo) returns 400 | unit | same | ❌ Wave 0 |
| — | POST with malformed base64 returns 400 | unit | same | ❌ Wave 0 |
| — | POST with convert=false skips conversion | unit | same | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `python manage.py test core.tests.test_gm_api` (existing tests)
- **Per wave merge:** `python manage.py test core`
- **Phase gate:** Full suite green before close

### Wave 0 Gaps
- [ ] `core/tests/test_upload_image.py` — covers all upload endpoint behaviors listed above

*Note: Conversion test (convert=True path) requires Pillow and a real image file; mark that case `@unittest.skip("requires Pillow + writable DATA_DIR")` following the same pattern as `test_write_file_valid_yaml` in the existing test file.*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Trust-network model (homelab) |
| V3 Session Management | no | — |
| V4 Access Control | no | Trust-network model |
| V5 Input Validation | yes | Filename character blocklist + image_type allowlist |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via filename | Tampering | Reject filenames containing `/`, `\`, `..` before any path construction |
| Arbitrary file write via image_type | Tampering | `image_type` must be in allowlist `{portrait, logo, map, misc}`; path resolution is server-side only |
| Large payload DoS | DoS | Not mitigated (trust-network model); Django's default `DATA_UPLOAD_MAX_MEMORY_SIZE` (2.5MB) provides basic protection |
| Malformed base64 | Tampering | `base64.b64decode()` raises `binascii.Error`; catch and return 400 |

---

## Sources

### Primary (HIGH confidence)
- `mcp_server.py` [VERIFIED: codebase] — FastMCP tool pattern, httpx call structure, DJANGO_BASE_URL
- `core/views/gm_data.py` [VERIFIED: codebase] — Django view pattern, path traversal guard, `@csrf_exempt`, `JsonResponse` shapes
- `core/urls.py` [VERIFIED: codebase] — URL registration pattern for new endpoints
- `scripts/convert_npc_portraits.py` [VERIFIED: codebase] — `convert_portrait()` function signature, Pillow usage
- `core/tests/test_gm_api.py` [VERIFIED: codebase] — existing test structure and skip pattern
- `janus-skills/skills/janus-add-npc/SKILL.md` [VERIFIED: codebase] — SKILL.md format, frontmatter, `@-include` path
- `janus-skills/install.sh` [VERIFIED: codebase] — glob pattern `janus-*/` auto-includes new skills
- `requirements.txt` [VERIFIED: codebase] — FastMCP 3.3.1, httpx ≥0.27.0; Pillow ABSENT
- `data/campaign/images/` [VERIFIED: codebase] — logos/, maps/, misc/ subdirs ABSENT; korova-stahl-logo.png in root

### Secondary (MEDIUM confidence)
- [gofastmcp.com/servers/tools](https://gofastmcp.com/servers/tools) [CITED] — FastMCP `bool = True` optional parameter syntax

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in codebase or requirements.txt
- Architecture: HIGH — exact pattern from existing Phase 23 code confirmed
- Pitfalls: HIGH — Pillow gap and directory discrepancy verified by filesystem inspection
- Skills format: HIGH — janus-add-npc/janus-add-ship read directly

**Research date:** 2026-05-27
**Valid until:** 2026-06-27 (stable stack)
