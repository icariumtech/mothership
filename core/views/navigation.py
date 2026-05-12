from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from pathlib import Path
import json
from core.data_loader import get_loader
from core.active_view_store import get_state
from core.sse_broadcaster import broadcaster
from core.janus_session import JanusSessionManager
from .active_view import sync_state, build_active_view_payload


@login_required
def api_switch_view(request):
    """
    API endpoint to switch the active view.
    POST: { view_type: string, location_slug?: string, view_slug?: string }
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    current = get_state()
    new_view_type = data.get('view_type', 'STANDBY')
    new_location_slug = data.get('location_slug', '')

    # Check if we're switching to a different ENCOUNTER location
    is_new_encounter_location = (
        new_view_type == 'ENCOUNTER' and
        new_location_slug and
        (current.get('location_slug') != new_location_slug or current.get('view_type') != 'ENCOUNTER')
    )

    # Build update kwargs — start with base fields
    update_kwargs = {
        'view_type': new_view_type,
        'location_slug': new_location_slug,
        'view_slug': data.get('view_slug', ''),
        # Clear overlay when switching views
        'overlay_location_slug': '',
        'overlay_terminal_slug': '',
        'overlay_doc_slug': '',
    }

    # Auto-set JANUS channel based on view type
    if new_view_type == 'JANUS_TERMINAL':
        update_kwargs['janus_active_channel'] = 'story'
        # Clear story channel conversation on JANUS_TERMINAL view switch
        JanusSessionManager.clear_conversation('story')
    elif new_view_type == 'BRIDGE':
        update_kwargs['janus_active_channel'] = 'bridge'
        # Clear bridge channel conversation on BRIDGE view switch
        JanusSessionManager.clear_conversation('bridge')
    elif new_view_type == 'ENCOUNTER' and new_location_slug:
        update_kwargs['janus_active_channel'] = f'encounter-{new_location_slug}'

    # When switching to a new ENCOUNTER location, initialize all rooms as hidden
    if is_new_encounter_location:
        # Clear portrait overlays when switching to a new encounter location
        update_kwargs['encounter_active_portraits'] = []
        loader = get_loader()
        location = loader.find_location_by_slug(new_location_slug)
        if location and location.get('map'):
            map_data = location['map']
            # Collect all room IDs from all decks and set them to hidden
            all_room_ids = []
            if map_data.get('is_multi_deck'):
                # Multi-deck: load all decks and get room IDs
                manifest = map_data.get('manifest', {})
                if location.get('directory'):
                    location_dir = Path(location['directory'])
                    for deck_info in manifest.get('decks', []):
                        deck_data = loader.load_deck_map(location_dir, deck_info['id'])
                        if deck_data and deck_data.get('rooms'):
                            all_room_ids.extend(r['id'] for r in deck_data['rooms'])
            else:
                # Single deck: get room IDs directly
                if map_data.get('rooms'):
                    all_room_ids = [r['id'] for r in map_data['rooms']]

            # Set all rooms to hidden (False)
            update_kwargs['encounter_room_visibility'] = {room_id: False for room_id in all_room_ids}

            # Set default deck level and ID
            if map_data.get('is_multi_deck'):
                manifest = map_data.get('manifest', {})
                decks = manifest.get('decks', [])
                # Find the default deck, or use the first one
                default_deck = next((d for d in decks if d.get('default')), decks[0] if decks else None)
                if default_deck:
                    update_kwargs['encounter_level'] = default_deck.get('level', 1)
                    update_kwargs['encounter_deck_id'] = default_deck.get('id', '')
                else:
                    update_kwargs['encounter_level'] = 1
                    update_kwargs['encounter_deck_id'] = ''
            else:
                # Single deck map
                update_kwargs['encounter_level'] = 1
                update_kwargs['encounter_deck_id'] = map_data.get('deck_id', '')

    new_state = sync_state(**update_kwargs)

    return JsonResponse({
        'success': True,
        'view_type': new_state['view_type'],
        'location_slug': new_state['location_slug']
    })




@login_required
def api_show_terminal(request):
    """
    API endpoint to show a terminal overlay.
    POST: { location_slug: string, terminal_slug: string }
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    new_state = sync_state(
        overlay_location_slug=data.get('location_slug', ''),
        overlay_terminal_slug=data.get('terminal_slug', ''),
    )

    return JsonResponse({
        'success': True,
        'overlay_terminal_slug': new_state['overlay_terminal_slug']
    })




@csrf_exempt
def api_bridge_selection(request):
    """
    Public API endpoint to update the player's current bridge map selection.

    INTENTIONALLY UNAUTHENTICATED: Called by the player terminal at
    `/terminal/`, which is itself an unauthenticated route. Adding
    `@login_required` here would return a 302 redirect for player
    sessions and break bridge map navigation.

    Writes ephemeral in-memory state only (view_slug / bridge_tab /
    bridge_map_mode / bridge_label) — no persistent data side effect.
    The audit flagged this as low-severity (no persistent write); the
    resolution is documentation, not authentication. See Phase 20
    RESEARCH.md Pattern 2 for the full caller list.

    Called by the player terminal when navigating the bridge galaxy/system/orbit map.
    POST: { location_slug?: string, tab?: string, map_mode?: string, label?: string }
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    kwargs = {}
    if 'location_slug' in data:
        kwargs['view_slug'] = data['location_slug']
    if 'tab' in data:
        kwargs['bridge_tab'] = data['tab']
        kwargs['bridge_label'] = ''  # clear label on tab change
    if 'map_mode' in data:
        kwargs['bridge_map_mode'] = data['map_mode']
    if 'label' in data:
        kwargs['bridge_label'] = data['label']
    new_state = sync_state(**kwargs)

    return JsonResponse({'success': True})




@csrf_exempt
@login_required
def api_set_ship_location(request):
    """GM action: set the ship's current galactic position. Writes to ship.yaml + broadcasts SSE."""


    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    location_slug = data.get('location_slug', '')
    loader = get_loader()
    loader.save_ship_location(location_slug)
    # Broadcast updated ship status so all clients see the new location_slug
    try:
        ship_data = loader.load_ship_status()
        if ship_data:
            broadcaster.announce_ship_status(ship_data)
    except Exception:
        pass
    return JsonResponse({'success': True, 'location_slug': location_slug})




@csrf_exempt
def api_hide_terminal(request):
    """
    Public API endpoint to hide the terminal overlay.
    Called by players when they dismiss the terminal dialog.
    POST: {}
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    new_state = sync_state(
        overlay_location_slug='',
        overlay_terminal_slug='',
    )

    return JsonResponse({
        'success': True
    })




@login_required
def api_show_doc(request, slug):
    """
    GM endpoint — push a campaign doc to the player display.
    POST: /api/gm/show-doc/<slug>/
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    new_state = sync_state(overlay_doc_slug=slug)

    return JsonResponse({'success': True, 'overlay_doc_slug': slug})




@csrf_exempt
def api_hide_doc(request):
    """
    Public endpoint — hide the document overlay (called by players on dismiss).
    POST: {}
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    new_state = sync_state(overlay_doc_slug='')

    return JsonResponse({'success': True})


