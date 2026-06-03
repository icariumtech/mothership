"""
GM Data API — file-level access to campaign YAML data for the AI agent (MCP server).

Endpoints:
  GET  /api/gm/data/?dir=<rel>              — list files in a data subdirectory
  GET  /api/gm/data/<path>                  — read raw file content
  GET  /api/gm/data/<path>?field=<dotpath>  — read a single field by dot-path as JSON
  PUT  /api/gm/data/<path>                  — write YAML atomically (validated + path-traversal-guarded)
  PATCH /api/gm/data/<path>                 — apply JSON merge patch to a YAML file
  DELETE /api/gm/data/<path>                — delete a data file
  POST /api/gm/data-rename/<path>           — rename/move a data file within data/
  POST /api/gm/data-list-append/<path>      — append an item to a named list in a YAML file
  GET  /api/gm/session-context              — snapshot of current game state (active view + NPCs/crew/ship)
  GET  /api/gm/data-schema                  — raw DATA_DIRECTORY_GUIDE.md content
  POST /api/gm/upload-image/                — save image to campaign data directory (multipart or base64 JSON)
  POST /api/gm/upload-svg-map/              — upload SVG deckplan, run svg_to_map, write to data location

All endpoints are intentionally unauthenticated (trust-network model, D-09).
"""
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
import base64
import binascii
import json
import subprocess
import sys
import yaml
import os
import tempfile
import logging
from pathlib import Path
from core.data_loader import get_loader
from core.sse_broadcaster import broadcaster
from core.active_view_store import get_state

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Module-level helper
# ---------------------------------------------------------------------------

_ALLOWED_WRITE_EXTENSIONS = frozenset(('.yaml', '.yml', '.md'))


def _validate_markdown_frontmatter(content: str) -> None:
    """Validate the YAML frontmatter block of a markdown file, if present.

    Raises yaml.YAMLError if the frontmatter block is not valid YAML.
    Does nothing when no leading '---' fence is detected.
    """
    lines = content.splitlines()
    if not lines or lines[0].strip() != '---':
        return
    try:
        close_idx = next(i for i, line in enumerate(lines[1:], 1) if line.strip() == '---')
    except StopIteration:
        return  # unclosed frontmatter — tolerate, do not error
    frontmatter = '\n'.join(lines[1:close_idx])
    yaml.safe_load(frontmatter)


def safe_write_yaml(file_path: Path, content: str) -> None:
    """Write text content atomically to file_path.

    Steps:
    1. Extension whitelist — .yaml/.yml require valid YAML; .md validates frontmatter only.
    2. Ensure parent directory exists.
    3. Write to a temp file in the same directory, then os.replace() to target.
       os.replace() is POSIX-atomic — readers never see a partial file.

    Raises:
        yaml.YAMLError: if content fails the applicable YAML validation.
        ValueError: if the file extension is not in (.yaml, .yml, .md).
    """
    # Step 1: extension whitelist + content validation
    suffix = file_path.suffix.lower()
    if suffix not in _ALLOWED_WRITE_EXTENSIONS:
        raise ValueError(f"Only .yaml, .yml, and .md files are allowed; got: {file_path.name!r}")

    if suffix in ('.yaml', '.yml'):
        yaml.safe_load(content)  # raises yaml.YAMLError on invalid content
    else:
        _validate_markdown_frontmatter(content)  # .md: validate frontmatter block only

    # Step 3: ensure parent directory exists
    file_path.parent.mkdir(parents=True, exist_ok=True)

    # Step 4: atomic write via temp file + os.replace (POSIX rename)
    fd, tmp_path = tempfile.mkstemp(dir=file_path.parent, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(content)
        os.replace(tmp_path, file_path)
    except Exception:
        # Clean up temp file on any error; ignore secondary errors
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def _deep_merge(base: dict, patch: dict) -> dict:
    """Recursively merge patch into base. Lists in patch replace lists in base."""
    result = dict(base)
    for key, value in patch.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def _get_field_by_dotpath(data, field_path: str):
    """Traverse a dot-separated field path in a nested structure. Raises KeyError if not found."""
    current = data
    for part in field_path.split('.'):
        if not isinstance(current, dict) or part not in current:
            raise KeyError(f"Field not found: {field_path!r}")
        current = current[part]
    return current


# ---------------------------------------------------------------------------
# View functions
# ---------------------------------------------------------------------------

def api_gm_data_list(request):
    """List files and directories in a data subdirectory.

    GET /api/gm/data/?dir=<relative_path>
    Returns a sorted JSON array of objects with "name" and "type" fields.
    Directories appear before files; each group sorted alphabetically.
    dir='' or omitting dir entirely returns the data root listing.
    400 if resolved path escapes DATA_DIR (path traversal attempt).
    404 if directory does not exist.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    rel_dir = request.GET.get('dir', '').strip()
    data_root = Path(settings.DATA_DIR).resolve()

    if rel_dir:
        target = (data_root / rel_dir).resolve()
        # Path traversal guard (only needed for non-empty rel_dir)
        if not target.is_relative_to(data_root):
            return JsonResponse({'error': 'Path not allowed'}, status=400)
    else:
        # Empty dir param — list the data root
        target = data_root

    if not target.exists():
        return JsonResponse({'error': f'Directory not found: {rel_dir or "."}'}, status=404)

    if not target.is_dir():
        return JsonResponse({'error': f'Not a directory: {rel_dir}'}, status=400)

    entries = []
    for entry in target.iterdir():
        if not entry.exists():
            continue  # skip broken symlinks
        entries.append({
            'name': entry.name,
            'type': 'directory' if entry.is_dir() else 'file',
        })

    # Sort: directories first (alphabetically), then files (alphabetically)
    entries.sort(key=lambda e: (0 if e['type'] == 'directory' else 1, e['name']))
    return JsonResponse(entries, safe=False)


@csrf_exempt
def api_gm_data_file(request, filepath):
    """Read, write, or patch a single data file.

    GET   /api/gm/data/<path>              — raw file content as text/plain
    GET   /api/gm/data/<path>?field=<path> — single dot-path field as JSON {"value": ...}
    PUT   /api/gm/data/<path>              — write YAML content atomically
    PATCH /api/gm/data/<path>              — apply JSON merge patch to YAML file

    INTENTIONALLY UNAUTHENTICATED: trust-network model per D-09. The container
    is self-hosted on a homelab network and is not exposed to the internet.
    Path traversal and YAML validation are the only defenses needed in this
    threat model; see T-23-03-01 and T-23-03-02 in the plan threat register.
    """
    data_root = Path(settings.DATA_DIR).resolve()
    target = (data_root / filepath).resolve()

    # Path traversal guard (applies to all methods)
    if not target.is_relative_to(data_root):
        return JsonResponse({'error': 'Path not allowed'}, status=400)

    if request.method == 'GET':
        if not target.exists():
            return JsonResponse({'error': f'File not found: {filepath}'}, status=404)
        try:
            content = target.read_text(encoding='utf-8')
        except OSError as e:
            logger.exception('Error reading file %s: %s', filepath, e)
            return JsonResponse({'error': 'Could not read file'}, status=500)

        field_path = request.GET.get('field', '').strip()
        if field_path:
            try:
                data = yaml.safe_load(content) or {}
            except yaml.YAMLError as e:
                return JsonResponse({'error': 'Invalid YAML in file', 'detail': str(e)}, status=400)
            try:
                value = _get_field_by_dotpath(data, field_path)
            except KeyError as e:
                return JsonResponse({'error': str(e)}, status=404)
            return JsonResponse({'value': value})

        return HttpResponse(content, content_type='text/plain; charset=utf-8')

    elif request.method == 'PUT':
        try:
            content = request.body.decode('utf-8')
        except UnicodeDecodeError:
            return JsonResponse({'error': 'Request body must be UTF-8 encoded'}, status=400)

        try:
            safe_write_yaml(target, content)
        except yaml.YAMLError as e:
            return JsonResponse({'error': 'Invalid YAML', 'detail': str(e)}, status=400)
        except ValueError as e:
            return JsonResponse({'error': str(e)}, status=400)
        except OSError as e:
            logger.exception('Error writing file %s: %s', filepath, e)
            return JsonResponse({'error': 'Could not write file'}, status=500)

        # Broadcast SSE so player terminals update immediately (D-10).
        # Wrapped in try/except: broadcast failure must NOT roll back the write.
        try:
            broadcaster.announce_generic('data-changed', {'path': filepath, 'action': 'write'})
        except Exception as e:
            logger.warning('SSE broadcast failed after write: %s', e)

        return JsonResponse({'ok': True, 'path': filepath})

    elif request.method == 'PATCH':
        try:
            patch_dict = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({'error': 'Invalid JSON body'}, status=400)

        if not isinstance(patch_dict, dict):
            return JsonResponse({'error': 'Patch body must be a JSON object'}, status=400)

        if not target.exists():
            return JsonResponse({'error': f'File not found: {filepath}'}, status=404)

        try:
            content = target.read_text(encoding='utf-8')
            data = yaml.safe_load(content) or {}
        except OSError:
            logger.exception('Error reading file %s for patch', filepath)
            return JsonResponse({'error': 'Could not read file'}, status=500)
        except yaml.YAMLError as e:
            return JsonResponse({'error': 'Invalid YAML in file', 'detail': str(e)}, status=400)

        if not isinstance(data, dict):
            return JsonResponse({'error': 'File root must be a YAML mapping'}, status=400)

        merged = _deep_merge(data, patch_dict)
        changed_keys = [k for k in patch_dict if data.get(k) != merged.get(k)]

        try:
            updated = yaml.dump(merged, default_flow_style=False, allow_unicode=True)
            safe_write_yaml(target, updated)
        except (yaml.YAMLError, ValueError, OSError):
            logger.exception('Error writing patched file %s', filepath)
            return JsonResponse({'error': 'Could not write file'}, status=500)

        try:
            broadcaster.announce_generic('data-changed', {'path': filepath, 'action': 'patch'})
        except Exception as e:
            logger.warning('SSE broadcast failed after patch: %s', e)

        return JsonResponse({'ok': True, 'path': filepath, 'changed_keys': changed_keys})

    elif request.method == 'DELETE':
        if not target.exists():
            return JsonResponse({'error': f'File not found: {filepath}'}, status=404)
        if target.is_dir():
            return JsonResponse({'error': 'Cannot delete directories via this endpoint'}, status=400)

        try:
            target.unlink()
        except OSError as e:
            logger.exception('Error deleting file %s: %s', filepath, e)
            return JsonResponse({'error': 'Could not delete file'}, status=500)

        try:
            broadcaster.announce_generic('data-changed', {'path': filepath, 'action': 'delete'})
        except Exception as e:
            logger.warning('SSE broadcast failed after delete: %s', e)

        return JsonResponse({'ok': True, 'path': filepath, 'action': 'deleted'})

    else:
        return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def api_gm_data_rename(request, filepath):
    """Rename or move a data file within the data directory.

    POST /api/gm/data-rename/<path>
    Body JSON: {"new_path": "campaign/crew/alex_novak_renamed.yaml"}

    Both source and destination must stay within data/. The destination
    directory is created automatically if it does not exist.
    Triggers SSE broadcast on success.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    data_root = Path(settings.DATA_DIR).resolve()
    source = (data_root / filepath).resolve()

    if not source.is_relative_to(data_root):
        return JsonResponse({'error': 'Path not allowed'}, status=400)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)

    new_path = body.get('new_path', '').strip()
    if not new_path:
        return JsonResponse({'error': "'new_path' is required"}, status=400)

    dest = (data_root / new_path).resolve()
    if not dest.is_relative_to(data_root):
        return JsonResponse({'error': 'Destination path not allowed'}, status=400)

    if not source.exists():
        return JsonResponse({'error': f'File not found: {filepath}'}, status=404)
    if source.is_dir():
        return JsonResponse({'error': 'Cannot rename directories via this endpoint'}, status=400)
    if dest.exists():
        return JsonResponse({'error': f'Destination already exists: {new_path}'}, status=409)

    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        source.rename(dest)
    except OSError as e:
        logger.exception('Error renaming file %s → %s: %s', filepath, new_path, e)
        return JsonResponse({'error': 'Could not rename file'}, status=500)

    try:
        broadcaster.announce_generic('data-changed', {
            'path': filepath,
            'new_path': new_path,
            'action': 'rename',
        })
    except Exception as e:
        logger.warning('SSE broadcast failed after rename: %s', e)

    return JsonResponse({'ok': True, 'old_path': filepath, 'new_path': new_path})


@csrf_exempt
def api_gm_data_list_append(request, filepath):
    """Append an item to a named list in a YAML file.

    POST /api/gm/data-list-append/<path>
    Body JSON: {"list_key": "systems", "item": {...}}

    Reads the file, appends the item to the named list, and writes back atomically.
    If list_key does not exist in the file, it is created as a new empty list.
    Triggers SSE broadcast on success.

    Returns: {"ok": true, "list_key": "systems", "new_length": N}
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    data_root = Path(settings.DATA_DIR).resolve()
    target = (data_root / filepath).resolve()

    if not target.is_relative_to(data_root):
        return JsonResponse({'error': 'Path not allowed'}, status=400)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)

    list_key = body.get('list_key')
    item = body.get('item')

    if not list_key or not isinstance(list_key, str):
        return JsonResponse({'error': "'list_key' is required and must be a string"}, status=400)
    if item is None or not isinstance(item, dict):
        return JsonResponse({'error': "'item' is required and must be a JSON object"}, status=400)

    if not target.exists():
        return JsonResponse({'error': f'File not found: {filepath}'}, status=404)

    try:
        content = target.read_text(encoding='utf-8')
        data = yaml.safe_load(content) or {}
    except OSError:
        logger.exception('Error reading file %s for list-append', filepath)
        return JsonResponse({'error': 'Could not read file'}, status=500)
    except yaml.YAMLError as e:
        return JsonResponse({'error': 'Invalid YAML in file', 'detail': str(e)}, status=400)

    if not isinstance(data, dict):
        return JsonResponse({'error': 'File root must be a YAML mapping'}, status=400)

    existing = data.get(list_key)
    if existing is None:
        data[list_key] = []
    elif not isinstance(existing, list):
        return JsonResponse({'error': f"'{list_key}' exists but is not a list"}, status=400)

    data[list_key].append(item)

    try:
        updated = yaml.dump(data, default_flow_style=False, allow_unicode=True)
        safe_write_yaml(target, updated)
    except (yaml.YAMLError, ValueError, OSError):
        logger.exception('Error writing file %s after list-append', filepath)
        return JsonResponse({'error': 'Could not write file'}, status=500)

    try:
        broadcaster.announce_generic('data-changed', {'path': filepath, 'action': 'list-append', 'list_key': list_key})
    except Exception as e:
        logger.warning('SSE broadcast failed after list-append: %s', e)

    return JsonResponse({'ok': True, 'list_key': list_key, 'new_length': len(data[list_key])})


def api_gm_session_context(request):
    """Return a snapshot of the current game state for the AI agent.

    GET /api/gm/session-context
    Composes:
      - Active view state (view_type, location_slug, encounter state, etc.)
      - NPCs from the data directory
      - Crew from the data directory
      - Ship status from the data directory

    Returns 500 with logged traceback if any source raises an exception.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        state = get_state()
        loader = get_loader()
        npcs = loader.load_npcs() or []
        crew = loader.load_crew() or []
        ship_status = loader.load_ship_status() or {}
    except Exception:
        logger.exception('Error composing session context')
        return JsonResponse({'error': 'Internal server error'}, status=500)

    return JsonResponse({
        'state': state,
        'npcs': npcs,
        'crew': crew,
        'ship_status': ship_status,
    })


def api_gm_data_schema(request):
    """Return the raw DATA_DIRECTORY_GUIDE.md content as text/markdown.

    GET /api/gm/data-schema
    Reads DATA_DIRECTORY_GUIDE.md from the project root (BASE_DIR).
    404 if the file does not exist.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    schema_file = Path(settings.BASE_DIR) / 'DATA_DIRECTORY_GUIDE.md'
    if not schema_file.exists():
        return JsonResponse({'error': 'DATA_DIRECTORY_GUIDE.md not found'}, status=404)

    try:
        content = schema_file.read_text(encoding='utf-8')
    except OSError as e:
        logger.exception('Error reading DATA_DIRECTORY_GUIDE.md: %s', e)
        return JsonResponse({'error': 'Could not read schema file'}, status=500)

    return HttpResponse(content, content_type='text/markdown; charset=utf-8')


# ---------------------------------------------------------------------------
# SVG deckplan upload + conversion view
# ---------------------------------------------------------------------------

_SVG_TO_MAP_SCRIPT = Path(settings.BASE_DIR) / 'tools' / 'svg_to_map.py'


@csrf_exempt
def api_gm_upload_svg_map(request):
    """Upload an SVG deckplan, run svg_to_map.py, and write output to a data location.

    POST /api/gm/upload-svg-map/

    Multipart form data (preferred):
      file          — the SVG file
      out_dir       — destination relative to data/ (e.g. "galaxy/tau-ceti/patrol_gunboat")
      deck          — deck YAML filename stem (default: "main_deck")
      name          — map/location display name (default: derived from SVG filename)
      type          — location type for stub location.yaml (default: "ship")
      unit_size     — pixels per output cell (default: 30)
      grid_scale    — group N Inkscape cells into 1 output cell (default: 1)
      detect_doors  — "true"/"false" (default: "false")

    JSON body (alternative — SVG as base64):
      filename, content_base64, out_dir, deck, name, type,
      unit_size, grid_scale, detect_doors

    The SVG is saved to <out_dir>/<stem>.svg for future re-conversion.
    Single-deck: svg_to_map.py writes location.yaml (if absent) and map/<deck>.yaml.
    Multi-deck: writes location.yaml + map/manifest.yaml + one map/<deck_id>.yaml per deck.

    Returns:
      200 { out_dir, svg_path, files_created: [...], log: str }
      400 on validation failure or conversion error
      405 for non-POST methods
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    if request.FILES.get('file'):
        uploaded = request.FILES['file']
        filename = str(request.POST.get('filename') or uploaded.name).strip()
        raw_bytes = uploaded.read()
        out_dir = str(request.POST.get('out_dir', '')).strip()
        deck = str(request.POST.get('deck', 'main_deck')).strip()
        name = str(request.POST.get('name', '')).strip() or None
        location_type = str(request.POST.get('type', 'ship')).strip()
        unit_size = int(request.POST.get('unit_size', 30))
        grid_scale = int(request.POST.get('grid_scale', 1))
        detect_doors = str(request.POST.get('detect_doors', 'false')).lower() in ('true', '1', 'yes')
    else:
        try:
            body = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({'error': 'Invalid JSON body'}, status=400)

        filename = str(body.get('filename', '')).strip()
        content_base64 = body.get('content_base64', '')
        out_dir = str(body.get('out_dir', '')).strip()
        deck = str(body.get('deck', 'main_deck')).strip()
        name = str(body.get('name', '')) or None
        location_type = str(body.get('type', 'ship')).strip()
        unit_size = int(body.get('unit_size', 30))
        grid_scale = int(body.get('grid_scale', 1))
        detect_doors_raw = body.get('detect_doors', False)
        detect_doors = detect_doors_raw if isinstance(detect_doors_raw, bool) else str(detect_doors_raw).lower() in ('true', '1', 'yes')

        try:
            raw_bytes = base64.b64decode(content_base64, validate=False)
        except (binascii.Error, Exception):
            return JsonResponse({'error': 'Invalid base64 content'}, status=400)

    if not filename or any(c in filename for c in ('/', '\\', '..')):
        return JsonResponse({'error': 'Invalid filename'}, status=400)
    if not filename.lower().endswith('.svg'):
        return JsonResponse({'error': 'File must be an SVG (.svg)'}, status=400)
    if not out_dir:
        return JsonResponse({'error': "'out_dir' is required (e.g. 'galaxy/tau-ceti/my_ship')"}, status=400)

    data_root = Path(settings.DATA_DIR).resolve()
    location_dir = (data_root / out_dir).resolve()
    if not location_dir.is_relative_to(data_root):
        return JsonResponse({'error': 'out_dir path not allowed'}, status=400)

    # Write SVG into the location directory so it can be re-converted later
    try:
        location_dir.mkdir(parents=True, exist_ok=True)
        svg_dest = location_dir / filename
        svg_dest.write_bytes(raw_bytes)
    except OSError as e:
        logger.exception('Error saving SVG file %s: %s', filename, e)
        return JsonResponse({'error': 'Could not save SVG file'}, status=500)

    # Build svg_to_map.py command
    cmd = [
        sys.executable,
        str(_SVG_TO_MAP_SCRIPT),
        str(svg_dest),
        '--out-dir', str(location_dir),
        '--deck', deck,
        '--type', location_type,
        '--unit-size', str(unit_size),
        '--grid-scale', str(grid_scale),
    ]
    if name:
        cmd += ['--name', name]
    if detect_doors:
        cmd.append('--detect-doors')

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    except subprocess.TimeoutExpired:
        return JsonResponse({'error': 'svg_to_map timed out after 60 seconds'}, status=500)
    except OSError as e:
        logger.exception('Error running svg_to_map.py: %s', e)
        return JsonResponse({'error': 'Could not run svg_to_map'}, status=500)

    log_output = (result.stdout + result.stderr).strip()

    if result.returncode != 0:
        return JsonResponse({'error': 'svg_to_map conversion failed', 'log': log_output}, status=400)

    # Collect all files created under location_dir (relative to data_root)
    files_created = sorted(
        str(p.relative_to(data_root))
        for p in location_dir.rglob('*')
        if p.is_file()
    )

    try:
        broadcaster.announce_generic('data-changed', {'path': out_dir, 'action': 'svg-map-upload'})
    except Exception as e:
        logger.warning('SSE broadcast failed after svg-map upload: %s', e)

    return JsonResponse({
        'ok': True,
        'out_dir': out_dir,
        'svg_path': str(svg_dest.relative_to(data_root)),
        'files_created': files_created,
        'log': log_output,
    })


# ---------------------------------------------------------------------------
# Image upload view
# ---------------------------------------------------------------------------

# Allowlist of valid image types and their destination directories
# (relative to DATA_DIR).
ALLOWED_IMAGE_TYPES = frozenset({'portrait', 'logo', 'map', 'misc'})

_IMAGE_TYPE_DIRS = {
    'portrait': 'campaign/NPCs/images_source',
    'logo': 'campaign/images/logos',
    'map': 'campaign/images/maps',
    'misc': 'campaign/images/misc',
}


@csrf_exempt
def api_gm_upload_image(request):
    """Save an image to the campaign data directory.

    POST /api/gm/upload-image/

    Multipart form data (preferred for large files — no base64 overhead):
      file           — the image file
      filename       — destination filename (optional, defaults to uploaded filename)
      image_type     — one of: portrait, logo, map, misc
      convert        — "true"/"false" (optional, portrait only)

    JSON body (legacy — suitable for small files only):
      filename       — destination filename (str, no path separators)
      content_base64 — base64-encoded file bytes (str)
      image_type     — one of: portrait, logo, map, misc
      convert        — (bool, default True) portrait conversion flag

    Returns:
      200 { saved_path, original_size_bytes[, converted_path] }
      400 on validation failure
      405 for non-POST methods
      500 on OS write failure
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    if request.FILES.get('file'):
        # Multipart form data path — bytes never base64-encoded
        uploaded = request.FILES['file']
        filename = str(request.POST.get('filename') or uploaded.name).strip()
        image_type = str(request.POST.get('image_type', '')).strip()
        convert = str(request.POST.get('convert', 'true')).lower() not in ('false', '0', 'no')
        raw_bytes = uploaded.read()
    else:
        # JSON / base64 path (legacy — MCP tool pipeline)
        try:
            body = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({'error': 'Invalid JSON body'}, status=400)

        filename = str(body.get('filename', '')).strip()
        content_base64 = body.get('content_base64', '')
        image_type = str(body.get('image_type', '')).strip()
        convert = body.get('convert', True)
        # Normalize convert to bool (guard against MCP clients serializing booleans as strings)
        if not isinstance(convert, bool):
            convert = str(convert).lower() not in ('false', '0', 'no')

        try:
            raw_bytes = base64.b64decode(content_base64, validate=False)
        except (binascii.Error, Exception):
            return JsonResponse({'error': 'Invalid base64 content'}, status=400)

    # Filename safety check — reject empty or containing dangerous characters
    if not filename or any(c in filename for c in ('/', '\\', '..')):
        return JsonResponse({'error': 'Invalid filename'}, status=400)

    # image_type allowlist
    if image_type not in ALLOWED_IMAGE_TYPES:
        return JsonResponse({'error': f'Invalid image_type: {image_type!r}. Must be one of: {sorted(ALLOWED_IMAGE_TYPES)}'}, status=400)

    # Resolve destination path
    data_root = Path(settings.DATA_DIR)
    dest_dir = data_root / _IMAGE_TYPE_DIRS[image_type]
    dest_path = dest_dir / filename

    # Write file to disk
    try:
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_path.write_bytes(raw_bytes)
    except OSError as e:
        logger.exception('Error writing uploaded image %s: %s', dest_path, e)
        return JsonResponse({'error': 'Could not write file'}, status=500)

    result = {
        'saved_path': str(dest_path.relative_to(data_root)),
        'original_size_bytes': len(raw_bytes),
    }

    # Portrait conversion (optional, non-fatal)
    if image_type == 'portrait' and convert:
        images_dir = data_root / 'campaign' / 'NPCs' / 'images'
        stem = Path(filename).stem
        output_path = images_dir / f'{stem}.png'
        try:
            images_dir.mkdir(parents=True, exist_ok=True)
            # Add tools/ to sys.path (only once)
            scripts_dir = str(Path(settings.BASE_DIR) / 'tools')
            if scripts_dir not in sys.path:
                sys.path.insert(0, scripts_dir)
            from convert_portraits import convert_portrait
            convert_portrait(str(dest_path), str(output_path))
            result['converted_path'] = str(output_path.relative_to(data_root))
        except Exception as e:
            logger.warning('Portrait conversion failed for %s: %s', filename, e)
            result['conversion_warning'] = str(e)

    return JsonResponse(result)
