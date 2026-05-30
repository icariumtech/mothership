from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from pathlib import Path
import json
import uuid
from core.data_loader import get_loader
from core.active_view_store import get_state
from core.sse_broadcaster import broadcaster
from core.encounter_utils import normalize_deck_poi
import core.encounter_state as enc


@login_required
def api_encounter_switch_level(request):
    """
    Switch the current encounter deck/level.
    POST: { level: number, deck_id: string }
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    level = data.get('level', 1)
    deck_id = data.get('deck_id', '')

    enc.switch_level(level, deck_id)

    return JsonResponse({'success': True, 'level': level, 'deck_id': deck_id})




@login_required
def api_encounter_toggle_room(request):
    """
    Toggle room visibility for players.
    POST: { room_id: string, visible?: boolean }
    If visible is not specified, toggles the current state.
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    room_id = data.get('room_id')
    if not room_id:
        return JsonResponse({'error': 'room_id required'}, status=400)

    explicit_visible = data.get('visible')
    new_visible, _ = enc.toggle_room(room_id, None if 'visible' not in data else bool(explicit_visible))

    return JsonResponse({
        'success': True,
        'room_id': room_id,
        'visible': new_visible,
        'room_visibility': get_state().get('encounter_room_visibility', {}),
    })




@login_required
def api_encounter_room_visibility(request):
    """
    Get or set room visibility for current level.
    GET: Returns { room_visibility: { room_id: bool, ... } }
    POST: { room_visibility: { room_id: bool, ... } }
    """

    if request.method == 'GET':
        current = get_state()
        return JsonResponse({'room_visibility': current.get('encounter_room_visibility') or {}})

    if request.method == 'POST':
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        visibility = data.get('room_visibility', {})
        enc.set_room_visibility(visibility)
        return JsonResponse({'success': True, 'room_visibility': visibility})

    return JsonResponse({'error': 'Method not allowed'}, status=405)




@login_required
def api_encounter_set_door_status(request):
    """
    Set door status for a connection (door).
    POST: { connection_id: string, door_status: string }
    Valid statuses: OPEN, CLOSED, LOCKED, SEALED, DAMAGED
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    connection_id = data.get('connection_id')
    door_status = data.get('door_status')

    if not connection_id or not door_status:
        return JsonResponse({'error': 'connection_id and door_status required'}, status=400)

    try:
        enc.set_door_status(connection_id, door_status)
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)

    all_door_status = get_state().get('encounter_door_status', {})
    return JsonResponse({
        'success': True,
        'connection_id': connection_id,
        'door_status': door_status,
        'all_door_status': all_door_status,
    })




@csrf_exempt
def api_encounter_place_token(request):
    """
    Place a new token on the encounter map.
    POST: { type: string, name: string, x: int, y: int, image_url?: string, room_id?: string }
    Valid types: player, npc, creature, object
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    token_type = data.get('type')
    name = data.get('name')
    x = data.get('x')
    y = data.get('y')
    image_url = data.get('image_url', '')
    room_id = data.get('room_id', '')

    if not token_type or not name or x is None or y is None:
        return JsonResponse({'error': 'type, name, x, and y are required'}, status=400)

    valid_types = ['player', 'npc', 'creature', 'object']
    if token_type not in valid_types:
        return JsonResponse({'error': f'Invalid type. Must be one of: {", ".join(valid_types)}'}, status=400)

    if not isinstance(x, int) or not isinstance(y, int):
        return JsonResponse({'error': 'x and y must be integers'}, status=400)

    token_id = uuid.uuid4().hex[:8]
    token_data = {
        'type': token_type,
        'name': name,
        'x': x,
        'y': y,
        'status': [],
        'image_url': image_url,
        'room_id': room_id,
    }

    slug = get_state().get('location_slug', '')
    tokens = enc.place_token(slug, token_id, token_data)

    return JsonResponse({'success': True, 'token_id': token_id, 'tokens': tokens})




@csrf_exempt
def api_encounter_move_token(request):
    """
    Move an existing token to a new position.
    POST: { token_id: string, x: int, y: int, room_id?: string }
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    token_id = data.get('token_id')
    x = data.get('x')
    y = data.get('y')
    room_id = data.get('room_id', '')

    if not token_id or x is None or y is None:
        return JsonResponse({'error': 'token_id, x, and y are required'}, status=400)

    if not isinstance(x, int) or not isinstance(y, int):
        return JsonResponse({'error': 'x and y must be integers'}, status=400)

    slug = get_state().get('location_slug', '')
    try:
        tokens = enc.move_token(slug, token_id, x, y, room_id)
    except KeyError:
        return JsonResponse({'error': 'Token not found'}, status=404)

    return JsonResponse({'success': True, 'token_id': token_id, 'tokens': tokens})




@csrf_exempt
def api_encounter_remove_token(request):
    """
    Remove a token from the encounter map.
    POST: { token_id: string }
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    token_id = data.get('token_id')
    if not token_id:
        return JsonResponse({'error': 'token_id is required'}, status=400)

    slug = get_state().get('location_slug', '')
    try:
        tokens = enc.remove_token(slug, token_id)
    except KeyError:
        return JsonResponse({'error': 'Token not found'}, status=404)

    return JsonResponse({'success': True, 'tokens': tokens})




@csrf_exempt
def api_encounter_update_token_status(request):
    """
    Update the status list of a token (wounded, dead, panicked, etc.).
    POST: { token_id: string, status: [string] }
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    token_id = data.get('token_id')
    status = data.get('status')

    if not token_id or status is None:
        return JsonResponse({'error': 'token_id and status are required'}, status=400)

    if not isinstance(status, list):
        return JsonResponse({'error': 'status must be an array'}, status=400)

    slug = get_state().get('location_slug', '')
    try:
        tokens = enc.update_token_status(slug, token_id, status)
    except KeyError:
        return JsonResponse({'error': 'Token not found'}, status=404)

    return JsonResponse({'success': True, 'token_id': token_id, 'tokens': tokens})




@csrf_exempt
def api_encounter_clear_tokens(request):
    """
    Clear all tokens from the encounter map.
    POST: {} (empty body)
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    slug = get_state().get('location_slug', '')
    enc.clear_tokens(slug)

    return JsonResponse({'success': True, 'tokens': {}})




@login_required
def api_encounter_toggle_portrait(request):
    """
    Toggle an NPC portrait display on the terminal.
    POST: { npc_id: string }
    If npc_id is already in encounter_active_portraits, removes it (dismiss).
    If not, appends it (show).
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    npc_id = data.get('npc_id', '').strip()
    if not npc_id:
        return JsonResponse({'error': 'npc_id required'}, status=400)

    portraits = enc.toggle_portrait(npc_id)
    return JsonResponse({'success': True, 'active_portraits': portraits})




@csrf_exempt
def api_encounter_token_images(request):
    """
    Get list of available token images from campaign data.
    GET: Returns list of image objects with id, name, type, url, source
    """

    if request.method != 'GET':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    loader = get_loader()
    images = []

    # Load crew portraits
    crew = loader.load_crew()
    for member in crew:
        if member.get('portrait'):
            images.append({
                'id': member.get('id', member.get('name', '')),
                'name': member.get('name', ''),
                'type': 'player',
                'url': member.get('portrait'),
                'source': 'crew'
            })

    # Load NPC portraits
    npcs = loader.load_npcs()
    for npc in npcs:
        if npc.get('portrait'):
            images.append({
                'id': npc.get('id', npc.get('name', '')),
                'name': npc.get('name', ''),
                'type': 'npc',
                'url': npc.get('portrait'),
                'source': 'npc'
            })

    # Scan loose image files in NPCs/images/ directory
    npc_images_dir = loader.data_dir / 'campaign' / 'NPCs' / 'images'
    if npc_images_dir.exists():
        for img_file in npc_images_dir.iterdir():
            if img_file.is_file() and img_file.suffix.lower() in ['.png', '.jpg', '.jpeg', '.webp']:
                images.append({
                    'id': img_file.name,
                    'name': img_file.stem,
                    'type': 'creature',
                    'url': str(img_file.relative_to(loader.data_dir)),
                    'source': 'images'
                })

    return JsonResponse({'images': images})





def api_encounter_map_data(request, location_slug):
    """
    Get encounter map data for a location including multi-deck support.
    Public endpoint - returns manifest + current deck data + room visibility.
    GET: /api/encounter-map/<location_slug>/
    Optional query param: deck_id - specific deck to load
    """

    loader = get_loader()

    # Find location by walking hierarchy
    location = loader.find_location_by_slug(location_slug)
    if not location:
        return JsonResponse({'error': 'Location not found'}, status=404)

    map_data = location.get('map')

    # Deckplan fallback: locations using deckplan.yaml have no map/ directory
    if not map_data and location.get('directory'):
        location_dir = Path(location['directory'])
        deckplan = loader.load_deckplan(location_dir)
        if deckplan and deckplan.get('decks'):
            decks = deckplan['decks']
            default_deck = next((d for d in decks if d.get('default')), decks[0])
            manifest = {
                'name': deckplan.get('name', location.get('name', '')),
                'facility_type': deckplan.get('facility_type', location.get('type', '')),
                'total_decks': deckplan['total_decks'],
                'decks': [{'id': d['id'], 'name': d.get('name', d['id']),
                            'level': d.get('level', 1), 'default': d.get('default', False)}
                           for d in decks],
                'hull': deckplan.get('hull'),
            }
            map_data = {
                'is_multi_deck': True,
                'manifest': manifest,
                'current_deck': {**default_deck, 'deck_id': default_deck['id']},
                'current_deck_id': default_deck['id'],
            }

    if not map_data:
        return JsonResponse({'error': 'No map data for location'}, status=404)

    # Get active view for room visibility and current deck
    active_view = get_state()

    # Handle optional deck_id query param - fall back to active_view encounter_deck_id
    requested_deck_id = request.GET.get('deck_id') or active_view.get('encounter_deck_id', '')

    # If a specific deck is requested, find it in the deckplan or old-format manifest
    if map_data.get('is_multi_deck') and requested_deck_id:
        if location.get('directory'):
            location_dir = Path(location['directory'])
            # Try deckplan first (inline rooms), fall back to old load_deck_map
            deckplan = loader.load_deckplan(location_dir)
            if deckplan and deckplan.get('decks'):
                deck = next((d for d in deckplan['decks'] if d['id'] == requested_deck_id), None)
                if deck:
                    map_data['current_deck'] = {**deck, 'deck_id': deck['id']}
                    map_data['current_deck_id'] = requested_deck_id
            else:
                deck_data = loader.load_deck_map(location_dir, requested_deck_id)
                if deck_data:
                    map_data['current_deck'] = deck_data
                    map_data['current_deck_id'] = requested_deck_id

    # Normalize room-level POIs into the top-level poi array on the active deck
    if map_data.get('is_multi_deck') and map_data.get('current_deck'):
        map_data['current_deck'] = normalize_deck_poi(map_data['current_deck'])
    elif map_data.get('rooms'):
        map_data = normalize_deck_poi(map_data)

    # Add room visibility state
    map_data['room_visibility'] = active_view.get('encounter_room_visibility') or {}
    map_data['encounter_level'] = active_view.get('encounter_level', 1)
    map_data['encounter_deck_id'] = active_view.get('encounter_deck_id', '')

    return JsonResponse(map_data)




def api_encounter_all_decks(request, location_slug):
    """
    Get all decks' data for a multi-deck location.
    Used by GM console to show rooms across all levels.
    GET: /api/encounter-map/<location_slug>/all-decks/
    """

    loader = get_loader()

    # Find location by walking hierarchy
    location = loader.find_location_by_slug(location_slug)
    if not location:
        return JsonResponse({'error': 'Location not found'}, status=404)

    map_data = location.get('map')

    # Deckplan fallback: locations using deckplan.yaml have no map/ directory
    if not map_data and location.get('directory'):
        location_dir = Path(location['directory'])
        deckplan = loader.load_deckplan(location_dir)
        if deckplan and deckplan.get('decks'):
            decks = deckplan['decks']
            manifest = {
                'name': deckplan.get('name', location.get('name', '')),
                'facility_type': deckplan.get('facility_type', location.get('type', '')),
                'total_decks': deckplan['total_decks'],
                'decks': [{'id': d['id'], 'name': d.get('name', d['id']),
                            'level': d.get('level', 1), 'default': d.get('default', False)}
                           for d in decks],
                'hull': deckplan.get('hull'),
            }
            active_view = get_state()
            return JsonResponse({
                'is_multi_deck': True,
                'manifest': manifest,
                'decks': [{'id': d['id'], 'name': d.get('name', d['id']),
                            'level': d.get('level', 1), 'rooms': d.get('rooms', [])}
                           for d in sorted(decks, key=lambda d: d.get('level', 0))],
                'room_visibility': active_view.get('encounter_room_visibility') or {},
                'current_deck_id': active_view.get('encounter_deck_id', ''),
            })

    if not map_data:
        return JsonResponse({'error': 'No map data for location'}, status=404)

    # Get active view for room visibility
    active_view = get_state()

    # If not a multi-deck map, just return current deck data
    if not map_data.get('is_multi_deck'):
        return JsonResponse({
            'is_multi_deck': False,
            'decks': [{
                'id': 'single',
                'name': map_data.get('name', 'Map'),
                'level': 1,
                'rooms': map_data.get('rooms', []),
            }],
            'room_visibility': active_view.get('encounter_room_visibility') or {},
        })

    # Load all decks from manifest (old map/ directory format)
    manifest = map_data.get('manifest', {})
    decks_data = []

    if location.get('directory'):
        location_dir = Path(location['directory'])
        for deck_info in manifest.get('decks', []):
            deck_data = loader.load_deck_map(location_dir, deck_info['id'])
            if deck_data:
                decks_data.append({
                    'id': deck_info['id'],
                    'name': deck_info.get('name', deck_info['id']),
                    'level': deck_info.get('level', 1),
                    'rooms': deck_data.get('rooms', []),
                })

    decks_data.sort(key=lambda d: d['level'])

    return JsonResponse({
        'is_multi_deck': True,
        'manifest': manifest,
        'decks': decks_data,
        'room_visibility': active_view.get('encounter_room_visibility') or {},
        'current_deck_id': active_view.get('encounter_deck_id', ''),
    })




def api_terminal_data(request, location_slug, terminal_slug):
    """
    Get terminal data including messages for display.
    GET: /api/terminal/<location_slug>/<terminal_slug>/
    """

    loader = get_loader()

    # Find location by walking hierarchy
    location = loader.find_location_by_slug(location_slug)
    if not location:
        return JsonResponse({'error': 'Location not found'}, status=404)

    # Find terminal in location
    terminals = location.get('terminals', [])
    terminal = next((t for t in terminals if t['slug'] == terminal_slug), None)
    if not terminal:
        return JsonResponse({'error': 'Terminal not found'}, status=404)

    # Format messages for the response
    def format_message(msg):
        timestamp = msg.get('timestamp')
        if hasattr(timestamp, 'isoformat'):
            timestamp = timestamp.isoformat()
        return {
            'message_id': msg.get('message_id', msg.get('filename', '')),
            'subject': msg.get('subject', ''),
            'from': msg.get('from', ''),
            'to': msg.get('to', ''),
            'content': msg.get('content', ''),
            'timestamp': timestamp,
            'priority': msg.get('priority', 'NORMAL'),
            'read': msg.get('read', True),
            'folder': msg.get('folder', 'inbox'),
            'contact': msg.get('contact', ''),
            'conversation_id': msg.get('conversation_id', ''),
            'in_reply_to': msg.get('in_reply_to', ''),
        }

    def format_log(log):
        timestamp = log.get('timestamp')
        if hasattr(timestamp, 'isoformat'):
            timestamp = timestamp.isoformat()
        return {
            'log_id': log.get('filename', ''),
            'title': log.get('title', ''),
            'author': log.get('author', ''),
            'timestamp': timestamp,
            'content': log.get('content', ''),
        }

    inbox = [format_message(m) for m in terminal.get('inbox', [])]
    sent = [format_message(m) for m in terminal.get('sent', [])]
    logs = [format_log(l) for l in terminal.get('logs', [])]

    return JsonResponse({
        'slug': terminal.get('slug'),
        'owner': terminal.get('owner', ''),
        'terminal_id': terminal.get('terminal_id', ''),
        'access_level': terminal.get('access_level', 'PUBLIC'),
        'description': terminal.get('description', ''),
        'location_name': location.get('name', ''),
        'inbox': inbox,
        'sent': sent,
        'logs': logs,
    })


# =============================================================================
# JANUS Channel Management (Multi-Channel Support)
# =============================================================================
