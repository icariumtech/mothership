"""
GM Data API — file-level CRUD access to campaign YAML data for the AI agent (MCP server).

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

All endpoints are intentionally unauthenticated (trust-network model, D-09).
"""
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
import json
import yaml
import os
import tempfile
import logging
from pathlib import Path
from core.data_loader import get_loader
from core.active_view_store import get_state

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Shared helpers (also used by gm_data_mapedit.py and gm_data_uploads.py)
# ---------------------------------------------------------------------------

_ALLOWED_WRITE_EXTENSIONS = frozenset(('.yaml', '.yml', '.md'))


def _announce_data_changed(payload: dict) -> None:
    """Invalidate stale caches, then broadcast a data-changed SSE event.

    PayloadBuilder caches NPCs/ship-deck data (30 s TTL) and JanusAI caches
    config/knowledge for process life — without invalidation, clients receive
    the data-changed event but subsequent broadcasts still serve stale data.
    Wrapped in try/except: broadcast failure must NOT roll back the write.
    """
    from core.janus_ai import clear_janus_cache
    from core.views.active_view import invalidate_payload_cache
    from core.sse_broadcaster import broadcaster
    try:
        invalidate_payload_cache()
        clear_janus_cache()
        broadcaster.announce_generic('data-changed', payload)
    except Exception as e:
        logger.warning('SSE broadcast failed after %s: %s', payload.get('action'), e)


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

    GET /api/gm/data/?dir=<relative_path>   (param 'path' is accepted as an alias)
    Returns a sorted JSON array of objects with "name" and "type" fields.
    Directories appear before files; each group sorted alphabetically.
    dir='' or omitting dir entirely returns the data root listing.
    400 if resolved path escapes DATA_DIR (path traversal attempt).
    A directory that does not exist is treated as empty: 200 + [] (NOT 404).
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    # Accept 'path' as an alias for 'dir' so the listing param matches the
    # read/write tools (which all use 'path') — eliminates a recurring wrong-param guess.
    rel_dir = (request.GET.get('dir') or request.GET.get('path') or '').strip()
    data_root = Path(settings.DATA_DIR).resolve()

    if rel_dir:
        target = (data_root / rel_dir).resolve()
        # Path traversal guard (only needed for non-empty rel_dir)
        if not target.is_relative_to(data_root):
            return JsonResponse({'error': 'Path not allowed'}, status=400)
    else:
        # Empty dir param — list the data root
        target = data_root

    # A missing directory returns an empty list, not an error. This lets the AI create
    # the first file in a not-yet-existing location (e.g. campaign/npcs/) without a
    # tree-probing detour, and matches the dominant skill pattern of listing a PARENT
    # and checking membership. Path traversal (above) and "exists but is a file" (below)
    # remain hard errors.
    if not target.exists():
        return JsonResponse([], safe=False)

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
        _announce_data_changed({'path': filepath, 'action': 'write'})

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

        _announce_data_changed({'path': filepath, 'action': 'patch'})

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

        _announce_data_changed({'path': filepath, 'action': 'delete'})

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

    _announce_data_changed({'path': filepath, 'new_path': new_path, 'action': 'rename'})

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

    _announce_data_changed({'path': filepath, 'action': 'list-append', 'list_key': list_key})

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
