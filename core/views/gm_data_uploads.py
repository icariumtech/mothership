"""
GM Data API — SVG deckplan conversion and image uploads.

  POST /api/gm/upload-svg-map/   — upload SVG deckplan, run svg_to_map, write to data location
  POST /api/gm/upload-image/     — save image to campaign data directory (multipart or base64 JSON)

Intentionally unauthenticated (trust-network model, D-09) — see gm_data_files.py.
"""
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
import base64
import binascii
import json
import subprocess
import sys
import logging
from pathlib import Path
from core.views.gm_data_files import _announce_data_changed

logger = logging.getLogger(__name__)


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

    The original SVG is saved to campaign/images/sources/<filename> for future
    re-conversion. svg_to_map.py writes location.yaml (if absent) and deckplan.yaml
    (canonical, overwritten) into out_dir.

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

    # Save the original SVG to the shared sources directory (alongside portrait
    # originals) for future re-conversion. The deckplan output still goes to out_dir.
    sources_dir = data_root / 'campaign' / 'images' / 'sources'
    try:
        sources_dir.mkdir(parents=True, exist_ok=True)
        location_dir.mkdir(parents=True, exist_ok=True)
        svg_dest = sources_dir / filename
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

    _announce_data_changed({'path': out_dir, 'action': 'svg-map-upload'})

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
    'portrait': 'campaign/images/sources',
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
        images_dir = data_root / 'campaign' / 'images' / 'portraits'
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
