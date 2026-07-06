"""
GM Data API — deckplan element resolution and surgical editing.

  GET  /api/gm/data-map-edit/<path>?q=<query>  — resolve a natural reference
       (room/corridor/door id, label, or glob) to candidate elements
  POST /api/gm/data-map-edit/<path>            — resolve + mutate a single
       deckplan element (set fields, add/remove a POI) without loading or
       hand-editing the whole file

Intentionally unauthenticated (trust-network model, D-09) — see gm_data_files.py.
"""
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
import fnmatch
import json
import re
import yaml
import logging
from difflib import get_close_matches
from pathlib import Path
from core.views.gm_data_files import _deep_merge, _announce_data_changed, safe_write_yaml

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Map element resolution (deckplan.yaml)
# ---------------------------------------------------------------------------

def _slugify(text) -> str:
    """Lowercase + collapse runs of non-alphanumerics to single underscores.

    Mirrors tools/svg_to_map.py:to_snake so 'Mess Hall' -> 'mess_hall'.
    """
    return re.sub(r'[^a-z0-9]+', '_', str(text).lower()).strip('_')


def _derive_door_id(door: dict, index: int) -> str:
    """Replicate the frontend doorNormalizer.deriveId so map-edit addresses a
    door by the SAME id used for rendering and door-status persistence.

    Explicit non-empty `id` wins; otherwise `<roomA>__<roomB|exterior>__<index>`,
    where `index` is the door's position within its deck's `doors` list.
    """
    explicit = door.get('id')
    if explicit:
        return str(explicit)
    rooms = door.get('rooms') or []
    a = rooms[0] if rooms else 'door'
    b = rooms[1] if len(rooms) > 1 else 'exterior'
    return f"{a}__{b}__{index}"


def _index_map_elements(data: dict) -> list[dict]:
    """Flatten a deckplan into addressable elements, in document order.

    Each element: {id, kind, label, deck, _obj} where `_obj` is the LIVE dict
    inside `data` (so callers can mutate it in place). `_obj` is stripped before
    any element is returned to a client.
    """
    elements: list[dict] = []
    for deck in data.get('decks', []) or []:
        deck_id = deck.get('id')
        for room in deck.get('rooms', []) or []:
            rid = room.get('id')
            if not rid:
                continue
            kind = 'corridor' if room.get('type') == 'corridor' else 'room'
            elements.append({
                'id': str(rid),
                'kind': kind,
                'label': room.get('name') or str(rid),
                'deck': deck_id,
                '_obj': room,
            })
        for i, door in enumerate(deck.get('doors', []) or []):
            did = _derive_door_id(door, i)
            rooms = door.get('rooms') or []
            elements.append({
                'id': did,
                'kind': 'door',
                'label': ' / '.join(str(r) for r in rooms) or did,
                'deck': deck_id,
                '_obj': door,
            })
    return elements


def _resolve_map_element(data: dict, query: str) -> dict:
    """Resolve a natural reference to deckplan element(s).

    Returns {"matches": [{id, kind, label, deck, _obj}], "strategy": str} and,
    when nothing matched, {"matches": [], "strategy": "none", "suggestions": [...]}.

    Strategy order (first non-empty wins): exact id -> slugified label/id ->
    glob (when the query contains * ? [) -> prefix -> fuzzy.
    """
    elements = _index_map_elements(data)
    q = str(query).strip()
    qslug = _slugify(q)

    # Label-based matching applies to rooms/corridors only. A door's label is
    # just its connected room name(s), which would otherwise collide with the
    # room itself ("Mess Hall" must resolve to the room, not its exterior door).
    # Doors are addressed by their derived id (`<a>__<b>__<i>`).
    def label_matches(e, predicate):
        return e['kind'] != 'door' and predicate(_slugify(e['label']))

    # 1. exact id
    matches = [e for e in elements if e['id'] == q]
    strategy = 'exact'

    # 2. slugified label (rooms/corridors) or slugified id
    if not matches:
        matches = [e for e in elements
                   if _slugify(e['id']) == qslug or label_matches(e, lambda s: s == qslug)]
        strategy = 'slug'

    # 3. glob (only when the query looks like a pattern)
    if not matches and any(c in q for c in '*?['):
        matches = [e for e in elements
                   if fnmatch.fnmatch(e['id'], q)
                   or label_matches(e, lambda s: fnmatch.fnmatch(s, qslug))]
        strategy = 'glob'

    # 4. prefix on id or slugified label
    if not matches and qslug:
        matches = [e for e in elements
                   if e['id'].startswith(qslug)
                   or label_matches(e, lambda s: s.startswith(qslug))]
        strategy = 'prefix'

    # 5. fuzzy (last resort)
    if not matches:
        by_slug: dict[str, dict] = {}
        for e in elements:
            by_slug.setdefault(_slugify(e['id']), e)
            if e['kind'] != 'door':
                by_slug.setdefault(_slugify(e['label']), e)
        seen: set[str] = set()
        matches = []
        for cand in get_close_matches(qslug, list(by_slug.keys()), n=8, cutoff=0.6):
            e = by_slug[cand]
            if e['id'] not in seen:
                seen.add(e['id'])
                matches.append(e)
        strategy = 'fuzzy'

    if matches:
        return {'matches': matches, 'strategy': strategy}

    all_ids = [e['id'] for e in elements]
    suggestions = get_close_matches(qslug, [_slugify(i) for i in all_ids], n=5, cutoff=0.3)
    return {'matches': [], 'strategy': 'none', 'suggestions': suggestions or all_ids[:5]}


def _public_element(e: dict) -> dict:
    """Strip internal (underscore-prefixed) keys before returning to a client."""
    return {k: v for k, v in e.items() if not k.startswith('_')}


@csrf_exempt
def api_gm_data_map_edit(request, filepath):
    """Resolve and edit a single deckplan element without loading the whole file.

    GET  /api/gm/data-map-edit/<path>?q=<query>
        Resolve a natural reference (room/corridor/door id, label, or glob like
        'coolant_tanks*') to candidate elements. Read-only.
        200 {"matches": [{id, kind, label, deck}], "strategy"} | with suggestions when none.

    POST /api/gm/data-map-edit/<path>
        Body JSON: {"target": "<ref>", and EXACTLY ONE of:
            "set":        {field: value, ...}   deep-merge fields into the element
            "add_poi":    {icon, label, ...}    append a POI to a room (not a door)
            "remove_poi": "<label>" | <index>   remove a POI by label or 0-based index
        }
        Resolves `target`; 404 (with suggestions) if no match, 409 (with candidates,
        no write) if ambiguous. On success writes atomically + broadcasts data-changed.
        200 {"ok": true, "element", "kind", "op", "deck"}.

    INTENTIONALLY UNAUTHENTICATED: trust-network model per D-09.
    Note: like the PATCH endpoint, a successful write re-serializes the file via
    yaml.dump (block style); authored comments / flow style are not preserved.
    """
    if request.method not in ('GET', 'POST'):
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    data_root = Path(settings.DATA_DIR).resolve()
    target_path = (data_root / filepath).resolve()
    if not target_path.is_relative_to(data_root):
        return JsonResponse({'error': 'Path not allowed'}, status=400)
    if not target_path.exists():
        return JsonResponse({'error': f'File not found: {filepath}'}, status=404)

    try:
        content = target_path.read_text(encoding='utf-8')
        data = yaml.safe_load(content) or {}
    except OSError:
        logger.exception('Error reading file %s for map-edit', filepath)
        return JsonResponse({'error': 'Could not read file'}, status=500)
    except yaml.YAMLError as e:
        return JsonResponse({'error': 'Invalid YAML in file', 'detail': str(e)}, status=400)

    if not isinstance(data, dict):
        return JsonResponse({'error': 'File root must be a YAML mapping'}, status=400)

    # --- GET: resolve only -------------------------------------------------
    if request.method == 'GET':
        query = request.GET.get('q', '').strip()
        if not query:
            return JsonResponse({'error': "query param 'q' is required"}, status=400)
        res = _resolve_map_element(data, query)
        out = {'matches': [_public_element(m) for m in res['matches']], 'strategy': res['strategy']}
        if 'suggestions' in res:
            out['suggestions'] = res['suggestions']
        return JsonResponse(out)

    # --- POST: resolve + mutate -------------------------------------------
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)
    if not isinstance(body, dict):
        return JsonResponse({'error': 'Body must be a JSON object'}, status=400)

    target = body.get('target')
    if not target or not isinstance(target, str):
        return JsonResponse({'error': "'target' is required and must be a string"}, status=400)

    ops = {k: body[k] for k in ('set', 'add_poi', 'remove_poi') if body.get(k) is not None}
    if len(ops) != 1:
        return JsonResponse(
            {'error': "Exactly one of 'set', 'add_poi', 'remove_poi' is required"}, status=400)
    op = next(iter(ops))

    res = _resolve_map_element(data, target)
    matches = res['matches']
    if not matches:
        return JsonResponse(
            {'error': f"No map element matches '{target}'",
             'suggestions': res.get('suggestions', [])}, status=404)
    if len(matches) > 1:
        return JsonResponse(
            {'error': 'ambiguous',
             'detail': f"'{target}' matches {len(matches)} elements",
             'candidates': [_public_element(m) for m in matches]}, status=409)

    element = matches[0]
    obj = element['_obj']
    kind = element['kind']

    if op == 'set':
        patch = body['set']
        if not isinstance(patch, dict):
            return JsonResponse({'error': "'set' must be a JSON object"}, status=400)
        merged = _deep_merge(obj, patch)
        obj.clear()
        obj.update(merged)

    elif op == 'add_poi':
        if kind == 'door':
            return JsonResponse({'error': 'Cannot add a POI to a door'}, status=400)
        poi = body['add_poi']
        if not isinstance(poi, dict):
            return JsonResponse({'error': "'add_poi' must be a JSON object"}, status=400)
        existing = obj.setdefault('poi', [])
        if not isinstance(existing, list):
            return JsonResponse({'error': "element 'poi' exists but is not a list"}, status=400)
        existing.append(poi)

    else:  # remove_poi
        if kind == 'door':
            return JsonResponse({'error': 'Doors have no POIs'}, status=400)
        ref = body['remove_poi']
        poi_list = obj.get('poi')
        if not isinstance(poi_list, list) or not poi_list:
            return JsonResponse({'error': 'element has no POIs to remove'}, status=404)
        idx = None
        if isinstance(ref, bool):
            return JsonResponse(
                {'error': "'remove_poi' must be a label string or an index integer"}, status=400)
        if isinstance(ref, int):
            if ref < 0 or ref >= len(poi_list):
                return JsonResponse({'error': f'POI index {ref} out of range'}, status=404)
            idx = ref
        else:
            for i, p in enumerate(poi_list):
                if isinstance(p, dict) and p.get('label') == ref:
                    idx = i
                    break
            if idx is None:
                return JsonResponse({'error': f"No POI with label '{ref}'"}, status=404)
        poi_list.pop(idx)
        if not poi_list:
            obj.pop('poi', None)

    try:
        updated = yaml.dump(data, default_flow_style=False, allow_unicode=True)
        safe_write_yaml(target_path, updated)
    except (yaml.YAMLError, ValueError, OSError):
        logger.exception('Error writing map-edited file %s', filepath)
        return JsonResponse({'error': 'Could not write file'}, status=500)

    _announce_data_changed({'path': filepath, 'action': 'map-edit', 'element': element['id'], 'op': op})

    return JsonResponse(
        {'ok': True, 'element': element['id'], 'kind': kind, 'op': op, 'deck': element['deck']})
