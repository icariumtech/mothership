"""
GM Data API — file-level access to campaign YAML data for the AI agent (MCP server).

Four endpoints:
  GET  /api/gm/data/?dir=<rel>        — list files in a data subdirectory
  GET  /api/gm/data/<path>            — read raw file content
  PUT  /api/gm/data/<path>            — write YAML atomically (validated + path-traversal-guarded)
  GET  /api/gm/session-context        — snapshot of current game state (active view + NPCs/crew/ship)
  GET  /api/gm/data-schema            — raw DATA_DIRECTORY_GUIDE.md content

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
from core.sse_broadcaster import broadcaster
from core.active_view_store import get_state

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Module-level helper
# ---------------------------------------------------------------------------

def safe_write_yaml(file_path: Path, content: str) -> None:
    """Write YAML content atomically to file_path.

    Steps:
    1. Validate content is parseable YAML (raises yaml.YAMLError on failure).
    2. Reject non-YAML file extensions (raises ValueError).
    3. Ensure parent directory exists.
    4. Write to a temp file in the same directory, then os.replace() to target.
       os.replace() is POSIX-atomic — readers never see a partial file.

    Raises:
        yaml.YAMLError: if content is not valid YAML.
        ValueError: if the file extension is not .yaml or .yml.
    """
    # Step 1: validate YAML — raises yaml.YAMLError on invalid content
    yaml.safe_load(content)

    # Step 2: extension whitelist — only .yaml / .yml allowed
    suffix = file_path.suffix.lower()
    if suffix not in ('.yaml', '.yml'):
        raise ValueError(f"Only .yaml and .yml files are allowed; got: {file_path.name!r}")

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


# ---------------------------------------------------------------------------
# View functions
# ---------------------------------------------------------------------------

def api_gm_data_list(request):
    """List files in a data subdirectory.

    GET /api/gm/data/?dir=<relative_path>
    Returns a sorted JSON array of file names (not full paths).
    400 if ?dir is missing.
    400 if resolved path escapes DATA_DIR (path traversal attempt).
    404 if directory does not exist.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    rel_dir = request.GET.get('dir', '').strip()
    if not rel_dir:
        return JsonResponse({'error': "Missing required query parameter: 'dir'"}, status=400)

    data_root = Path(settings.DATA_DIR).resolve()
    target = (data_root / rel_dir).resolve()

    # Path traversal guard
    if not target.is_relative_to(data_root):
        return JsonResponse({'error': 'Path not allowed'}, status=400)

    if not target.exists():
        return JsonResponse({'error': f'Directory not found: {rel_dir}'}, status=404)

    if not target.is_dir():
        return JsonResponse({'error': f'Not a directory: {rel_dir}'}, status=400)

    files = sorted(
        entry.name
        for entry in target.iterdir()
        if entry.is_file()
    )
    return JsonResponse(files, safe=False)


@csrf_exempt
def api_gm_data_file(request, filepath):
    """Read or write a single data file.

    GET  /api/gm/data/<path> — return raw file content as text/plain
    PUT  /api/gm/data/<path> — write YAML content atomically

    INTENTIONALLY UNAUTHENTICATED: trust-network model per D-09. The container
    is self-hosted on a homelab network and is not exposed to the internet.
    Path traversal and YAML validation are the only defenses needed in this
    threat model; see T-23-03-01 and T-23-03-02 in the plan threat register.
    """
    data_root = Path(settings.DATA_DIR).resolve()
    target = (data_root / filepath).resolve()

    # Path traversal guard (applies to both GET and PUT)
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

    else:
        return JsonResponse({'error': 'Method not allowed'}, status=405)


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
