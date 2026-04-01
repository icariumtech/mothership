from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import logout
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Message
import queue as queue_module
import yaml
import os
import json
from django.conf import settings
from terminal.active_view_store import get_state, update_state
from terminal.sse_broadcaster import broadcaster, format_sse


def get_janus_location_path(active_view) -> str:
    """
    Derive JANUS's location context from the active view.

    Priority:
    1. If in ENCOUNTER view with a location, derive path from location_slug
    2. Fall back to explicitly set janus_location_path
    3. Return None if no location context available

    Accepts either a dict (from get_state()) or an ORM object.

    Returns:
        Location path string like "sol/earth/uscss_morrigan" or None
    """
    from terminal.data_loader import DataLoader

    # Support both dict and ORM object
    if isinstance(active_view, dict):
        view_type = active_view.get('view_type', '')
        location_slug = active_view.get('location_slug', '')
        janus_location_path = active_view.get('janus_location_path', '')
    else:
        view_type = active_view.view_type
        location_slug = active_view.location_slug
        janus_location_path = active_view.janus_location_path

    # If in ENCOUNTER view, derive from encounter location
    if view_type == 'ENCOUNTER' and location_slug:
        loader = DataLoader()
        path_slugs = loader.get_location_path(location_slug)
        if path_slugs:
            return '/'.join(path_slugs)

    # Fall back to explicitly set JANUS location
    if janus_location_path:
        return janus_location_path

    return None


@login_required
def terminal_view_react(request):
    """
    React version of player messages terminal.
    Shows messages in retro computer terminal style.
    """
    return render(request, 'terminal/player_console_react.html')


def logout_view(request):
    """
    Custom logout view that handles both GET and POST.
    """
    if request.method == 'POST':
        logout(request)
        return redirect('login')

    # For GET requests, show a confirmation page
    return render(request, 'terminal/logout.html')


def display_view_react(request):
    """
    React version of the shared terminal display.
    Test endpoint for React migration.
    """
    from terminal.data_loader import DataLoader

    # Get current active view from GM console
    active_view = get_state()

    # Load star map data for star system list
    star_map_path = os.path.join(settings.BASE_DIR, 'data', 'galaxy', 'star_map.yaml')
    star_systems_json = '[]'
    try:
        with open(star_map_path, 'r') as f:
            star_map_data = yaml.safe_load(f)
            systems = star_map_data.get('systems', [])

            # Create array of systems for React
            systems_list = []
            for system in systems:
                if system.get('label'):  # Only include labeled systems
                    location_slug = system.get('location_slug', '')
                    has_system_map = False
                    if location_slug:
                        system_map_file = os.path.join(settings.BASE_DIR, 'data', 'galaxy', location_slug, 'system_map.yaml')
                        has_system_map = os.path.exists(system_map_file)

                    systems_list.append({
                        'name': system['name'],
                        'hasSystemMap': has_system_map
                    })
            star_systems_json = json.dumps(systems_list)
    except (FileNotFoundError, Exception):
        pass

    # Load crew and NPC data from campaign directory
    loader = DataLoader()
    crew_data = loader.load_crew()
    crew_json = json.dumps(crew_data)
    npcs_data = loader.load_npcs()
    npcs_json = json.dumps(npcs_data)

    # Load session logs
    sessions_data = loader.load_sessions()
    sessions_json = json.dumps(sessions_data)

    # Load ship status
    ship_data = loader.load_ship_status()
    ship_status_json = json.dumps(ship_data) if ship_data else 'null'

    return render(request, 'terminal/shared_console_react.html', {
        'active_view': active_view,
        'star_systems_json': star_systems_json,
        'crew_json': crew_json,
        'npcs_json': npcs_json,
        'sessions_json': sessions_json,
        'ship_status_json': ship_status_json,
    })


def get_messages_json(request):
    """
    API endpoint to fetch messages as JSON for real-time updates.
    Optionally accepts 'since' parameter to get only new messages.
    Public endpoint - shows broadcast messages only (no login required).
    """
    since_id = request.GET.get('since', None)

    # If user is logged in, get their messages + broadcasts
    # If not logged in (display mode), only get broadcasts
    if request.user.is_authenticated:
        user_messages = Message.objects.filter(
            recipients=request.user
        ) | Message.objects.filter(recipients__isnull=True)
        user_messages = user_messages.distinct()
    else:
        # Public display mode - only broadcast messages
        user_messages = Message.objects.filter(recipients__isnull=True)

    # If 'since' parameter provided, only get messages newer than that ID
    if since_id:
        try:
            user_messages = user_messages.filter(id__gt=int(since_id))
        except (ValueError, TypeError):
            pass

    user_messages = user_messages.order_by('-created_at')[:50]

    # Convert messages to JSON-serializable format
    messages_data = []
    for msg in user_messages:
        messages_data.append({
            'id': msg.id,
            'sender': msg.sender,
            'content': msg.content,
            'priority': msg.priority,
            'created_at': msg.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        })

    return JsonResponse({
        'messages': messages_data,
        'count': len(messages_data)
    })


def build_active_view_payload(state: dict) -> dict:
    """Build the enriched active-view response dict from raw in-memory state."""
    from terminal.data_loader import DataLoader

    response = {
        'location_slug': state.get('location_slug', ''),
        'view_type': state.get('view_type', 'STANDBY'),
        'view_slug': state.get('view_slug', ''),
        'bridge_tab': state.get('bridge_tab', ''),
        'bridge_map_mode': state.get('bridge_map_mode', 'galaxy'),
        'bridge_label': state.get('bridge_label', ''),
        'overlay_location_slug': state.get('overlay_location_slug', ''),
        'overlay_terminal_slug': state.get('overlay_terminal_slug', ''),
        'overlay_doc_slug': state.get('overlay_doc_slug', ''),
        'janus_mode': state.get('janus_mode', 'DISPLAY'),
        'janus_location_path': state.get('janus_location_path', ''),
        'janus_dialog_open': state.get('janus_dialog_open', False),
        'janus_active_channel': state.get('janus_active_channel', 'story'),
        'encounter_level': state.get('encounter_level', 1),
        'encounter_deck_id': state.get('encounter_deck_id', ''),
        'encounter_room_visibility': state.get('encounter_room_visibility', {}),
        'encounter_door_status': state.get('encounter_door_status', {}),
        'encounter_tokens': state.get('encounter_tokens_by_location', {}).get(state.get('location_slug', ''), {}),
        'encounter_active_portraits': list(state.get('encounter_active_portraits', [])),
    }

    # Always include NPC data (portrait overlay needs it without a second request)
    loader_for_npcs = DataLoader()
    npcs = loader_for_npcs.load_npcs()
    response['encounter_npc_data'] = {
        npc['id']: {'id': npc['id'], 'name': npc['name'], 'portrait': npc.get('portrait', '')}
        for npc in npcs
        if npc.get('id')
    }

    # ENCOUNTER view: include location metadata and multi-deck map data
    if state.get('view_type') == 'ENCOUNTER' and state.get('location_slug'):
        loader = DataLoader()
        location = loader.find_location_by_slug(state['location_slug'])
        if location:
            response['location_type'] = location.get('type', 'unknown')
            response['location_name'] = location.get('name', '')
            response['location_data'] = location
            location_path = loader.get_location_path(state['location_slug'])
            if location_path:
                response['location_path'] = location_path
                if len(location_path) >= 1:
                    response['location_data']['system_slug'] = location_path[0]
                if len(location_path) >= 2:
                    response['location_data']['parent_slug'] = location_path[0]

            # For multi-deck maps, load the current deck's map data
            if location.get('directory'):
                from pathlib import Path
                location_dir = Path(location['directory'])
                manifest = loader.load_encounter_manifest(location_dir)
                if manifest:
                    response['encounter_total_decks'] = manifest.get('total_decks', 1)
                    # Get current deck ID (or use default)
                    current_deck_id = state.get('encounter_deck_id', '')
                    if not current_deck_id:
                        # Find default deck or use first deck
                        default_deck = next(
                            (d for d in manifest.get('decks', []) if d.get('default')),
                            manifest['decks'][0] if manifest.get('decks') else None
                        )
                        if default_deck:
                            current_deck_id = default_deck.get('id', '')

                    # Load the specific deck's map data
                    if current_deck_id:
                        deck_data = loader.load_deck_map(location_dir, current_deck_id)
                        if deck_data:
                            # Include the full multi-deck map structure in location_data
                            response['location_data']['map'] = {
                                'is_multi_deck': True,
                                'manifest': manifest,
                                'current_deck': deck_data,
                                'current_deck_id': current_deck_id,
                            }

                        # Find current deck name from manifest
                        for deck in manifest.get('decks', []):
                            if deck.get('id') == current_deck_id:
                                response['encounter_deck_name'] = deck.get('name', '')
                                break

    # Always include ship deck map data so GM console can render it regardless of player view
    loader = DataLoader()
    ship_dir = loader.data_dir / "campaign" / "ship"
    if ship_dir.exists():
        ship_map = loader.load_map(ship_dir)
        if ship_map:
            response['ship_deck_data'] = ship_map
            manifest = ship_map.get('manifest', {})
            response['ship_deck_total_decks'] = manifest.get('total_decks', 1)

    return response


def api_active_view_stream(request):
    """
    SSE endpoint — streams ActiveView state changes to all connected clients.
    Public endpoint — no login required (same pattern as /api/active-view/).
    """
    def event_stream():
        # Send full current state immediately on connect so client is in sync
        initial_payload = build_active_view_payload(get_state())
        yield format_sse(json.dumps(initial_payload, default=str), event='activeview')

        q = broadcaster.listen()
        try:
            while True:
                try:
                    msg = q.get(timeout=30)
                    yield msg
                except queue_module.Empty:
                    yield ': keepalive\n\n'
        finally:
            broadcaster.unlisten(q)

    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response


def get_active_view_json(request):
    """
    API endpoint to get the current active view state.
    Used by the display terminal to detect when GM changes the view.
    Public endpoint - no login required.
    """
    return JsonResponse(build_active_view_payload(get_state()))


def get_star_map_json(request):
    """
    API endpoint to get the star map data from YAML file.
    Returns star systems, routes, and other 3D map data.
    Public endpoint - no login required.
    """
    # Path to star map YAML file
    star_map_path = os.path.join(settings.BASE_DIR, 'data', 'galaxy', 'star_map.yaml')

    try:
        with open(star_map_path, 'r') as f:
            star_map_data = yaml.safe_load(f)

        # Add has_system_map field to each system by checking if system_map.yaml exists
        galaxy_path = os.path.join(settings.BASE_DIR, 'data', 'galaxy')
        for system in star_map_data.get('systems', []):
            location_slug = system.get('location_slug')
            if location_slug:
                system_map_file = os.path.join(galaxy_path, location_slug, 'system_map.yaml')
                system['has_system_map'] = os.path.exists(system_map_file)
            else:
                system['has_system_map'] = False

        return JsonResponse(star_map_data)
    except FileNotFoundError:
        return JsonResponse({
            'error': 'Star map data not found',
            'systems': [],
            'routes': []
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'error': f'Error loading star map: {str(e)}',
            'systems': [],
            'routes': []
        }, status=500)


def get_system_map_json(request, system_slug):
    """
    API endpoint to get solar system visualization data.
    Returns planets, orbits, and structures within a star system.
    Public endpoint - no login required.
    """
    from terminal.data_loader import DataLoader
    from pathlib import Path
    from django.conf import settings
    import yaml

    loader = DataLoader()
    system_map = loader.load_system_map(system_slug)

    if system_map:
        # Enhance each body with facility counts
        bodies = system_map.get('bodies', [])
        for body in bodies:
            location_slug = body.get('location_slug')
            if location_slug:
                # Count surface facilities and orbital stations
                surface_count = 0
                orbital_count = 0

                # Path to planet directory
                planet_dir = Path(settings.BASE_DIR) / 'data' / 'galaxy' / system_slug / location_slug

                if planet_dir.exists():
                    # Check for orbit map
                    orbit_map_file = planet_dir / 'orbit_map.yaml'
                    body['has_orbit_map'] = orbit_map_file.exists()

                    # Check each subdirectory (potential facility)
                    for subdir in planet_dir.iterdir():
                        if subdir.is_dir() and subdir.name not in ['comms', 'map', 'maps']:
                            # Check the facility's location.yaml to determine type
                            facility_yaml = subdir / 'location.yaml'
                            if facility_yaml.exists():
                                try:
                                    with open(facility_yaml, 'r') as f:
                                        facility_data = yaml.safe_load(f)
                                        facility_type = facility_data.get('type', '').lower()

                                        # Orbital stations are type "station" with is_orbital flag
                                        # or have "orbital" in their name/description
                                        is_orbital = facility_data.get('is_orbital', False)

                                        if is_orbital or 'orbital' in facility_type:
                                            orbital_count += 1
                                        else:
                                            # Everything else is surface (base, ship, city, etc.)
                                            surface_count += 1
                                except Exception:
                                    # If we can't read it, assume it's a surface facility
                                    surface_count += 1
                            else:
                                # No location.yaml, assume surface facility
                                surface_count += 1
                else:
                    # Planet directory doesn't exist
                    body['has_orbit_map'] = False

                # Add counts to body data
                body['surface_facility_count'] = surface_count
                body['orbital_station_count'] = orbital_count
            else:
                # No location slug means no facilities and no orbit map
                body['surface_facility_count'] = 0
                body['orbital_station_count'] = 0
                body['has_orbit_map'] = False

        return JsonResponse(system_map)
    else:
        return JsonResponse({
            'error': f'System map not found for {system_slug}',
            'system_slug': system_slug
        }, status=404)


def get_orbit_map_json(request, system_slug, body_slug):
    """
    API endpoint to get orbital visualization for a planet/body.
    Returns satellites, stations, and orbital structures.
    Public endpoint - no login required.
    """
    from terminal.data_loader import DataLoader

    loader = DataLoader()
    orbit_map = loader.load_orbit_map(system_slug, body_slug)

    if orbit_map:
        return JsonResponse(orbit_map)
    else:
        return JsonResponse({
            'error': f'Orbit map not found for {system_slug}/{body_slug}',
            'system_slug': system_slug,
            'body_slug': body_slug
        }, status=404)


@login_required
def gm_console_react(request):
    """
    React version of the GM Console.
    Provides a simpler, standard-widget UI for GM control.
    """
    from terminal.data_loader import DataLoader
    loader = DataLoader()
    ship_data = loader.load_ship_status()
    ship_status_json = json.dumps(ship_data) if ship_data else 'null'
    return render(request, 'terminal/gm_console_react.html', {
        'ship_status_json': ship_status_json,
    })


def api_corporation(request):
    """
    Public endpoint — returns corporation branding data from data/campaign/corporation.yaml.
    GET: /api/corporation/
    """
    from terminal.data_loader import DataLoader
    loader = DataLoader()
    corp_file = loader.data_dir / 'campaign' / 'corporation.yaml'
    if not corp_file.exists():
        return JsonResponse({'error': 'Not found'}, status=404)
    with open(corp_file) as f:
        data = yaml.safe_load(f) or {}
    if data.get('logo'):
        data['logo_url'] = f'/data/{data["logo"]}'
    return JsonResponse(data)


@login_required
def api_locations(request):
    """
    API endpoint to get the location tree for GM Console.
    Returns hierarchical location structure with terminals.
    """
    from terminal.data_loader import load_all_locations

    def transform_location(loc):
        """Transform location data for the React frontend."""
        return {
            'slug': loc.get('slug', ''),
            'name': loc.get('name', ''),
            'type': loc.get('type', ''),
            'status': loc.get('status', ''),
            'description': loc.get('description', ''),
            'has_map': loc.get('has_map', False),
            'terminals': [
                {
                    'slug': t.get('slug', ''),
                    'name': t.get('name', ''),
                    'owner': t.get('owner', ''),
                    'description': t.get('description', '')
                }
                for t in loc.get('terminals', [])
            ],
            'children': [transform_location(child) for child in loc.get('children', [])]
        }

    locations = load_all_locations()
    transformed = [transform_location(loc) for loc in locations]

    return JsonResponse({'locations': transformed})


@login_required
def api_switch_view(request):
    """
    API endpoint to switch the active view.
    POST: { view_type: string, location_slug?: string, view_slug?: string }
    """
    from terminal.data_loader import DataLoader
    import json

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
        from terminal.janus_session import JanusSessionManager
        JanusSessionManager.clear_conversation('story')
    elif new_view_type == 'BRIDGE':
        update_kwargs['janus_active_channel'] = 'bridge'
        # Clear bridge channel conversation on BRIDGE view switch
        from terminal.janus_session import JanusSessionManager
        JanusSessionManager.clear_conversation('bridge')
    elif new_view_type == 'ENCOUNTER' and new_location_slug:
        update_kwargs['janus_active_channel'] = f'encounter-{new_location_slug}'

    # When switching to a new ENCOUNTER location, initialize all rooms as hidden
    if is_new_encounter_location:
        # Clear portrait overlays when switching to a new encounter location
        update_kwargs['encounter_active_portraits'] = []
        loader = DataLoader()
        location = loader.find_location_by_slug(new_location_slug)
        if location and location.get('map'):
            map_data = location['map']
            # Collect all room IDs from all decks and set them to hidden
            all_room_ids = []
            if map_data.get('is_multi_deck'):
                # Multi-deck: load all decks and get room IDs
                manifest = map_data.get('manifest', {})
                if location.get('directory'):
                    from pathlib import Path
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

    new_state = update_state(**update_kwargs)
    broadcaster.announce(build_active_view_payload(new_state))

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
    import json

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    new_state = update_state(
        overlay_location_slug=data.get('location_slug', ''),
        overlay_terminal_slug=data.get('terminal_slug', ''),
    )
    broadcaster.announce(build_active_view_payload(new_state))

    return JsonResponse({
        'success': True,
        'overlay_terminal_slug': new_state['overlay_terminal_slug']
    })


@csrf_exempt
def api_bridge_selection(request):
    """
    Public API endpoint to update the player's current bridge map selection.
    Called by the player terminal when navigating the bridge galaxy/system/orbit map.
    POST: { location_slug?: string, tab?: string }
    """
    import json

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
    new_state = update_state(**kwargs)
    broadcaster.announce(build_active_view_payload(new_state))

    return JsonResponse({'success': True})


@csrf_exempt
def api_set_ship_location(request):
    """GM action: set the ship's current galactic position. Writes to ship.yaml + broadcasts SSE."""
    import json

    from terminal.data_loader import DataLoader

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    location_slug = data.get('location_slug', '')
    loader = DataLoader()
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

    new_state = update_state(
        overlay_location_slug='',
        overlay_terminal_slug='',
    )
    broadcaster.announce(build_active_view_payload(new_state))

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

    new_state = update_state(overlay_doc_slug=slug)
    broadcaster.announce(build_active_view_payload(new_state))

    return JsonResponse({'success': True, 'overlay_doc_slug': slug})


@csrf_exempt
def api_hide_doc(request):
    """
    Public endpoint — hide the document overlay (called by players on dismiss).
    POST: {}
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    new_state = update_state(overlay_doc_slug='')
    broadcaster.announce(build_active_view_payload(new_state))

    return JsonResponse({'success': True})


@login_required
def api_broadcast(request):
    """
    API endpoint to send a broadcast message.
    POST: { sender: string, content: string, priority: string }
    """
    import json

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    content = data.get('content', '').strip()
    if not content:
        return JsonResponse({'error': 'Message content is required'}, status=400)

    message = Message.objects.create(
        sender=data.get('sender', 'JANUS'),
        content=content,
        priority=data.get('priority', 'NORMAL'),
        created_by=request.user
    )

    return JsonResponse({
        'success': True,
        'message_id': message.id
    })


# =============================================================================
# JANUS Terminal API Endpoints
# =============================================================================

def api_janus_conversation(request):
    """
    Get current JANUS conversation (public for terminal display).
    GET: Returns conversation messages and mode.
    """
    from terminal.janus_session import JanusSessionManager

    active_view = get_state()
    conversation = JanusSessionManager.get_conversation()

    # Get the derived location path (from encounter or explicit setting)
    derived_location_path = get_janus_location_path(active_view)

    return JsonResponse({
        'mode': active_view.get('janus_mode', 'DISPLAY'),
        'janus_location_path': active_view.get('janus_location_path') or '',
        'active_location_path': derived_location_path or '',  # What JANUS is actually using
        'messages': conversation,
    })


@csrf_exempt
def api_janus_submit_query(request):
    """
    Player submits query to JANUS (only works in Query mode).
    POST: { query: string }
    Public endpoint - players submit queries from shared terminal.
    CSRF exempt since this is called from unauthenticated player terminals.
    """
    from terminal.janus_session import JanusSessionManager, JanusMessage

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    # Check if in query mode
    active_view = get_state()
    if active_view.get('janus_mode') != 'QUERY':
        return JsonResponse({'error': 'Terminal not in query mode'}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    query = data.get('query', '').strip()
    if not query:
        return JsonResponse({'error': 'Query required'}, status=400)

    # Add player query to conversation
    query_msg = JanusMessage(role='user', content=query)
    JanusSessionManager.add_message(query_msg)

    # Generate AI response with location-specific knowledge
    # Derive location from encounter view or fall back to explicit setting
    location_path = get_janus_location_path(active_view)
    from terminal.janus_ai import get_janus_ai
    ai = get_janus_ai(location_path=location_path)
    conversation = JanusSessionManager.get_conversation()
    response = ai.generate_response(query, conversation)

    # Queue for GM approval
    pending_id = JanusSessionManager.add_pending_response(
        query=query,
        response=response,
        query_id=query_msg.message_id
    )

    return JsonResponse({
        'success': True,
        'query_id': query_msg.message_id,
        'pending_id': pending_id,
    })


@login_required
def api_janus_switch_mode(request):
    """
    Switch JANUS terminal mode (Display/Query).
    POST: { mode: 'DISPLAY' | 'QUERY' }
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    mode = data.get('mode', 'DISPLAY')
    if mode not in ('DISPLAY', 'QUERY'):
        return JsonResponse({'error': 'Invalid mode. Must be DISPLAY or QUERY'}, status=400)

    new_state = update_state(janus_mode=mode)
    broadcaster.announce(build_active_view_payload(new_state))

    return JsonResponse({'success': True, 'mode': mode})


@login_required
def api_janus_set_location(request):
    """
    Set the active JANUS instance location.
    POST: { location_path: string }
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    location_path = data.get('location_path', '')

    new_state = update_state(janus_location_path=location_path)
    broadcaster.announce(build_active_view_payload(new_state))

    return JsonResponse({'success': True, 'location_path': location_path})


@login_required
def api_janus_send_message(request):
    """
    GM sends message directly to JANUS terminal.
    POST: { content: string }
    """
    from terminal.janus_session import JanusSessionManager, JanusMessage

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    content = data.get('content', '').strip()
    if not content:
        return JsonResponse({'error': 'Content required'}, status=400)

    msg = JanusMessage(role='janus', content=content)
    JanusSessionManager.add_message(msg)

    return JsonResponse({'success': True, 'message_id': msg.message_id})


@login_required
def api_janus_generate(request):
    """
    GM prompts AI to generate a JANUS response for review.
    POST: { prompt: string }
    Returns a pending response for GM approval.
    """
    from terminal.janus_session import JanusSessionManager

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    prompt = data.get('prompt', '').strip()
    if not prompt:
        return JsonResponse({'error': 'Prompt required'}, status=400)

    # Get active JANUS location for knowledge context
    # Derive location from encounter view or fall back to explicit setting
    active_view = get_state()
    location_path = get_janus_location_path(active_view)

    # Generate AI response based on GM's prompt with location knowledge
    from terminal.janus_ai import get_janus_ai
    ai = get_janus_ai(location_path=location_path)
    conversation = JanusSessionManager.get_conversation()

    # Create a context message for the AI that includes the GM's prompt
    context_prompt = f"[GM CONTEXT: {prompt}]\n\nGenerate a JANUS response based on this context."
    response = ai.generate_response(context_prompt, conversation)

    # Queue for GM approval (using prompt as the "query" for reference)
    import uuid
    pending_id = JanusSessionManager.add_pending_response(
        query=f"[GM Prompt] {prompt}",
        response=response,
        query_id=str(uuid.uuid4())
    )

    return JsonResponse({
        'success': True,
        'pending_id': pending_id,
        'response': response,
    })


@login_required
def api_janus_pending(request):
    """
    GM gets list of pending AI responses for approval.
    GET: Returns list of pending responses.
    """
    from terminal.janus_session import JanusSessionManager

    pending = JanusSessionManager.get_pending_responses()
    return JsonResponse({'pending': pending})


@login_required
def api_janus_approve(request):
    """
    GM approves a pending response.
    POST: { pending_id: string, modified_content?: string }
    """
    from terminal.janus_session import JanusSessionManager

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    pending_id = data.get('pending_id')
    if not pending_id:
        return JsonResponse({'error': 'pending_id required'}, status=400)

    modified = data.get('modified_content')
    success = JanusSessionManager.approve_response(pending_id, modified)

    if success:
        return JsonResponse({'success': True})
    else:
        return JsonResponse({'error': 'Pending response not found'}, status=404)


@login_required
def api_janus_reject(request):
    """
    GM rejects a pending response.
    POST: { pending_id: string }
    """
    from terminal.janus_session import JanusSessionManager

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    pending_id = data.get('pending_id')
    if not pending_id:
        return JsonResponse({'error': 'pending_id required'}, status=400)

    success = JanusSessionManager.reject_response(pending_id)

    if success:
        return JsonResponse({'success': True})
    else:
        return JsonResponse({'error': 'Pending response not found'}, status=404)


@login_required
def api_janus_clear(request):
    """
    GM clears the JANUS conversation.
    POST: {}
    """
    from terminal.janus_session import JanusSessionManager

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    JanusSessionManager.clear_conversation()
    return JsonResponse({'success': True})


@csrf_exempt
def api_janus_toggle_dialog(request):
    """
    Toggle the JANUS dialog overlay visibility.
    POST: { open?: boolean }
    If open is not specified, toggles the current state.
    Public endpoint - players can open/close dialog from shared terminal.
    CSRF exempt since this is called from unauthenticated player terminals.
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        data = {}

    current = get_state()

    # If 'open' is specified, set to that value; otherwise toggle
    if 'open' in data:
        new_dialog_open = bool(data['open'])
    else:
        new_dialog_open = not current.get('janus_dialog_open', False)

    new_state = update_state(janus_dialog_open=new_dialog_open)
    broadcaster.announce(build_active_view_payload(new_state))

    return JsonResponse({
        'success': True,
        'janus_dialog_open': new_state['janus_dialog_open']
    })


# ==================== Encounter Map API Endpoints ====================

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

    # Don't clear room visibility when switching levels - preserve visibility state
    new_state = update_state(encounter_level=level, encounter_deck_id=deck_id)
    broadcaster.announce(build_active_view_payload(new_state))

    return JsonResponse({
        'success': True,
        'level': level,
        'deck_id': deck_id
    })


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

    current = get_state()
    visibility = dict(current.get('encounter_room_visibility') or {})

    # If visible is specified, use it; otherwise toggle
    if 'visible' in data:
        visibility[room_id] = bool(data['visible'])
    else:
        visibility[room_id] = not visibility.get(room_id, True)

    new_state = update_state(encounter_room_visibility=visibility)
    broadcaster.announce(build_active_view_payload(new_state))

    return JsonResponse({
        'success': True,
        'room_id': room_id,
        'visible': visibility[room_id],
        'room_visibility': visibility
    })


@login_required
def api_encounter_room_visibility(request):
    """
    Get or set room visibility for current level.
    GET: Returns { room_visibility: { room_id: bool, ... } }
    POST: { room_visibility: { room_id: bool, ... } }
    """

    current = get_state()

    if request.method == 'GET':
        return JsonResponse({
            'room_visibility': current.get('encounter_room_visibility') or {}
        })

    if request.method == 'POST':
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        visibility = data.get('room_visibility', {})
        new_state = update_state(encounter_room_visibility=visibility)
        broadcaster.announce(build_active_view_payload(new_state))

        return JsonResponse({
            'success': True,
            'room_visibility': visibility
        })

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

    # Validate door status
    valid_statuses = ['OPEN', 'CLOSED', 'LOCKED', 'SEALED', 'DAMAGED']
    if door_status not in valid_statuses:
        return JsonResponse({
            'error': f'Invalid door_status. Must be one of: {", ".join(valid_statuses)}'
        }, status=400)

    current = get_state()
    door_states = dict(current.get('encounter_door_status') or {})
    door_states[connection_id] = door_status

    new_state = update_state(encounter_door_status=door_states)
    broadcaster.announce(build_active_view_payload(new_state))

    return JsonResponse({
        'success': True,
        'connection_id': connection_id,
        'door_status': door_status,
        'all_door_status': door_states
    })


@csrf_exempt
def api_encounter_place_token(request):
    """
    Place a new token on the encounter map.
    POST: { type: string, name: string, x: int, y: int, image_url?: string, room_id?: string }
    Valid types: player, npc, creature, object
    """
    import uuid

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

    # Validate required fields
    if not token_type or not name or x is None or y is None:
        return JsonResponse({'error': 'type, name, x, and y are required'}, status=400)

    # Validate token type
    valid_types = ['player', 'npc', 'creature', 'object']
    if token_type not in valid_types:
        return JsonResponse({
            'error': f'Invalid type. Must be one of: {", ".join(valid_types)}'
        }, status=400)

    # Validate coordinates are integers
    if not isinstance(x, int) or not isinstance(y, int):
        return JsonResponse({'error': 'x and y must be integers'}, status=400)

    # Generate token ID
    token_id = uuid.uuid4().hex[:8]

    # Create token data
    token_data = {
        'type': token_type,
        'name': name,
        'x': x,
        'y': y,
        'status': [],
        'image_url': image_url,
        'room_id': room_id,
    }

    # Store token
    current = get_state()
    slug = current.get('location_slug', '')
    tokens_by_loc = dict(current.get('encounter_tokens_by_location') or {})
    tokens = dict(tokens_by_loc.get(slug) or {})
    tokens[token_id] = token_data

    tokens_by_loc[slug] = tokens
    new_state = update_state(encounter_tokens_by_location=tokens_by_loc)
    broadcaster.announce(build_active_view_payload(new_state))

    return JsonResponse({
        'success': True,
        'token_id': token_id,
        'tokens': tokens
    })


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

    # Validate coordinates are integers
    if not isinstance(x, int) or not isinstance(y, int):
        return JsonResponse({'error': 'x and y must be integers'}, status=400)

    # Update token
    current = get_state()
    slug = current.get('location_slug', '')
    tokens_by_loc = dict(current.get('encounter_tokens_by_location') or {})
    tokens = dict(tokens_by_loc.get(slug) or {})

    if token_id not in tokens:
        return JsonResponse({'error': 'Token not found'}, status=404)

    tokens[token_id] = dict(tokens[token_id])
    tokens[token_id]['x'] = x
    tokens[token_id]['y'] = y
    tokens[token_id]['room_id'] = room_id

    tokens_by_loc[slug] = tokens
    new_state = update_state(encounter_tokens_by_location=tokens_by_loc)
    broadcaster.announce(build_active_view_payload(new_state))

    return JsonResponse({
        'success': True,
        'token_id': token_id,
        'tokens': tokens
    })


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

    # Remove token
    current = get_state()
    slug = current.get('location_slug', '')
    tokens_by_loc = dict(current.get('encounter_tokens_by_location') or {})
    tokens = dict(tokens_by_loc.get(slug) or {})

    if token_id not in tokens:
        return JsonResponse({'error': 'Token not found'}, status=404)

    del tokens[token_id]

    tokens_by_loc[slug] = tokens
    new_state = update_state(encounter_tokens_by_location=tokens_by_loc)
    broadcaster.announce(build_active_view_payload(new_state))

    return JsonResponse({
        'success': True,
        'tokens': tokens
    })


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

    # Update token status
    current = get_state()
    slug = current.get('location_slug', '')
    tokens_by_loc = dict(current.get('encounter_tokens_by_location') or {})
    tokens = dict(tokens_by_loc.get(slug) or {})

    if token_id not in tokens:
        return JsonResponse({'error': 'Token not found'}, status=404)

    tokens[token_id] = dict(tokens[token_id])
    tokens[token_id]['status'] = status

    tokens_by_loc[slug] = tokens
    new_state = update_state(encounter_tokens_by_location=tokens_by_loc)
    broadcaster.announce(build_active_view_payload(new_state))

    return JsonResponse({
        'success': True,
        'token_id': token_id,
        'tokens': tokens
    })


@csrf_exempt
def api_encounter_clear_tokens(request):
    """
    Clear all tokens from the encounter map.
    POST: {} (empty body)
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    # Clear tokens for current location
    current = get_state()
    slug = current.get('location_slug', '')
    tokens_by_loc = dict(current.get('encounter_tokens_by_location') or {})
    tokens_by_loc[slug] = {}
    new_state = update_state(encounter_tokens_by_location=tokens_by_loc)
    broadcaster.announce(build_active_view_payload(new_state))

    return JsonResponse({
        'success': True,
        'tokens': {}
    })


@login_required
def api_encounter_toggle_portrait(request):
    """
    Toggle an NPC portrait display on the terminal.
    POST: { npc_id: string }
    If npc_id is already in encounter_active_portraits, removes it (dismiss).
    If not, appends it (show).
    """
    import json

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    npc_id = data.get('npc_id', '').strip()
    if not npc_id:
        return JsonResponse({'error': 'npc_id required'}, status=400)

    current = get_state()
    portraits = list(current.get('encounter_active_portraits') or [])

    if npc_id in portraits:
        portraits.remove(npc_id)
    else:
        portraits.append(npc_id)

    new_state = update_state(encounter_active_portraits=portraits)
    broadcaster.announce(build_active_view_payload(new_state))

    return JsonResponse({
        'success': True,
        'active_portraits': portraits,
    })


@csrf_exempt
def api_encounter_token_images(request):
    """
    Get list of available token images from campaign data.
    GET: Returns list of image objects with id, name, type, url, source
    """
    from terminal.data_loader import DataLoader

    if request.method != 'GET':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    loader = DataLoader()
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
    from terminal.data_loader import DataLoader

    loader = DataLoader()

    # Find location by walking hierarchy
    location = loader.find_location_by_slug(location_slug)
    if not location:
        return JsonResponse({'error': 'Location not found'}, status=404)

    map_data = location.get('map')
    if not map_data:
        return JsonResponse({'error': 'No map data for location'}, status=404)

    # Get active view for room visibility and current deck
    active_view = get_state()

    # Handle optional deck_id query param - fall back to active_view encounter_deck_id
    requested_deck_id = request.GET.get('deck_id') or active_view.get('encounter_deck_id', '')

    # If it's a multi-deck map and a specific deck is requested (or stored in active_view)
    if map_data.get('is_multi_deck') and requested_deck_id:
        if location.get('directory'):
            from pathlib import Path
            location_dir = Path(location['directory'])
            deck_data = loader.load_deck_map(location_dir, requested_deck_id)
            if deck_data:
                map_data['current_deck'] = deck_data
                map_data['current_deck_id'] = requested_deck_id

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
    from terminal.data_loader import DataLoader

    loader = DataLoader()

    # Find location by walking hierarchy
    location = loader.find_location_by_slug(location_slug)
    if not location:
        return JsonResponse({'error': 'Location not found'}, status=404)

    map_data = location.get('map')
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

    # Load all decks from manifest
    manifest = map_data.get('manifest', {})
    decks_data = []

    if location.get('directory'):
        from pathlib import Path
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

    # Sort decks by level
    decks_data.sort(key=lambda d: d['level'])

    return JsonResponse({
        'is_multi_deck': True,
        'manifest': manifest,
        'decks': decks_data,
        'room_visibility': active_view.get('encounter_room_visibility') or {},
        'current_deck_id': active_view.get('encounter_deck_id', ''),
    })


def api_ship_status(request):
    """
    API endpoint to get ship status data.
    Merges YAML defaults with ActiveView runtime overrides.
    GET: Returns ship status JSON
    Public endpoint - no login required (terminal needs to read it).
    """
    from terminal.data_loader import DataLoader

    loader = DataLoader()
    ship_data = loader.load_ship_status()

    if not ship_data:
        return JsonResponse({'error': 'Ship data not found'}, status=404)

    return JsonResponse(ship_data)


@login_required
def api_ship_toggle_system(request):
    """
    API endpoint to toggle/update ship system status.
    GM only - updates runtime overrides in ActiveView.
    POST: { system: string, status: string, condition?: number, info?: string }
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    system_name = data.get('system', '').strip()
    status = data.get('status', '').strip()

    # Validate system name
    valid_systems = ['life_support', 'engines', 'weapons', 'comms']
    if system_name not in valid_systems:
        return JsonResponse({
            'error': f'Invalid system. Must be one of: {", ".join(valid_systems)}'
        }, status=400)

    # Validate status
    valid_statuses = ['ONLINE', 'STRESSED', 'DAMAGED', 'CRITICAL', 'OFFLINE']
    if status not in valid_statuses:
        return JsonResponse({
            'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'
        }, status=400)

    # Build update fields
    fields = {'status': status}
    if 'condition' in data:
        fields['condition'] = int(data['condition'])
    if 'info' in data:
        fields['info'] = data['info']

    # Write directly to ship.yaml
    from terminal.data_loader import DataLoader
    loader = DataLoader()
    loader.save_ship_system(system_name, fields)

    # Broadcast updated ship status
    try:
        ship_broadcast_data = loader.load_ship_status()
        if ship_broadcast_data:
            broadcaster.announce_ship_status(ship_broadcast_data)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning('Failed to broadcast ship status via SSE: %s', e)

    return JsonResponse({'success': True, 'system': system_name, 'fields': fields})


@login_required
def api_ship_update_integrity(request):
    """
    API endpoint to update ship hull or armor values.
    GM only - updates runtime overrides in ActiveView.
    POST: { field: "hull" | "armor", current?: number, max?: number }
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    field = data.get('field', '').strip()
    if field not in ('hull', 'armor'):
        return JsonResponse({'error': 'field must be "hull" or "armor"'}, status=400)

    values = {}
    if 'current' in data:
        values['current'] = int(data['current'])
    if 'max' in data:
        values['max'] = int(data['max'])
    if 'info' in data:
        values['info'] = data['info']

    if not values:
        return JsonResponse({'error': 'Provide at least one of current, max, or info'}, status=400)

    # Write directly to ship.yaml
    from terminal.data_loader import DataLoader
    loader = DataLoader()
    loader.save_ship_integrity(field, values)

    # Broadcast updated ship status
    try:
        ship_broadcast_data = loader.load_ship_status()
        if ship_broadcast_data:
            broadcaster.announce_ship_status(ship_broadcast_data)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning('Failed to broadcast ship status via SSE: %s', e)

    return JsonResponse({'success': True, 'field': field, 'values': values})


def api_terminal_data(request, location_slug, terminal_slug):
    """
    Get terminal data including messages for display.
    GET: /api/terminal/<location_slug>/<terminal_slug>/
    """
    from terminal.data_loader import DataLoader

    loader = DataLoader()

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

@login_required
def api_janus_channels(request):
    """
    Get list of all active JANUS channels with message counts and unread indicators.
    GET: Returns list of channels with metadata.
    """
    from terminal.janus_session import JanusSessionManager
    
    channels = JanusSessionManager.get_all_channels()
    channel_data = []
    
    for channel in channels:
        conversation = JanusSessionManager.get_conversation(channel)
        last_read = JanusSessionManager.get_last_read(channel)
        last_read_id = last_read['message_id'] if last_read else None
        unread_count = JanusSessionManager.get_unread_count(channel, last_read_id)
        
        channel_data.append({
            'channel': channel,
            'message_count': len(conversation),
            'unread_count': unread_count,
            'last_message': conversation[-1] if conversation else None,
        })
    
    return JsonResponse({'channels': channel_data})


@csrf_exempt
def api_janus_channel_conversation(request, channel):
    """
    Get conversation for a specific channel (public for player terminals).
    GET: Returns conversation messages for the channel.
    """
    from terminal.janus_session import JanusSessionManager
    
    conversation = JanusSessionManager.get_conversation(channel)
    active_view = get_state()
    
    mode = active_view.get('janus_mode', 'DISPLAY')

    return JsonResponse({
        'channel': channel,
        'mode': mode,
        'messages': conversation,
    })


@csrf_exempt
def api_janus_channel_submit(request, channel):
    """
    Player submits query to a specific JANUS channel.
    POST: { query: string }
    Public endpoint - players submit queries from terminals.
    """
    from terminal.janus_session import JanusSessionManager, JanusMessage
    
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    
    query = data.get('query', '').strip()
    if not query:
        return JsonResponse({'error': 'Query required'}, status=400)
    
    # Add player query to conversation
    query_msg = JanusMessage(role='user', content=query)
    JanusSessionManager.add_message(query_msg, channel)
    
    # Generate AI response
    active_view = get_state()
    location_path = get_janus_location_path(active_view)
    from terminal.janus_ai import get_janus_ai
    ai = get_janus_ai(location_path=location_path)
    conversation = JanusSessionManager.get_conversation(channel)
    response = ai.generate_response(query, conversation)
    
    # Queue for GM approval
    pending_id = JanusSessionManager.add_pending_response(
        query=query,
        response=response,
        query_id=query_msg.message_id,
        channel=channel
    )
    
    return JsonResponse({
        'success': True,
        'query_id': query_msg.message_id,
        'pending_id': pending_id,
    })


@login_required
def api_janus_channel_send(request, channel):
    """
    GM sends message to a specific JANUS channel.
    POST: { content: string }
    """
    from terminal.janus_session import JanusSessionManager, JanusMessage
    
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    
    content = data.get('content', '').strip()
    if not content:
        return JsonResponse({'error': 'Content required'}, status=400)
    
    msg = JanusMessage(role='janus', content=content)
    JanusSessionManager.add_message(msg, channel)
    
    return JsonResponse({
        'success': True,
        'message_id': msg.message_id,
        'channel': channel,
    })


@login_required
def api_janus_channel_mark_read(request, channel):
    """
    Mark all messages in a channel as read by GM.
    POST: No body required.
    """
    from terminal.janus_session import JanusSessionManager
    
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    JanusSessionManager.mark_channel_read(channel, request.user.id)
    
    return JsonResponse({'success': True, 'channel': channel})


@login_required
def api_janus_channel_pending(request, channel):
    """
    Get pending AI responses for a specific channel.
    GET: Returns pending responses awaiting GM approval.
    """
    from terminal.janus_session import JanusSessionManager
    
    pending = JanusSessionManager.get_pending_responses(channel)
    
    return JsonResponse({
        'channel': channel,
        'pending': pending,
        'count': len(pending),
    })


@login_required
def api_janus_channel_approve(request, channel):
    """
    Approve a pending AI response for a specific channel.
    POST: { pending_id: string, modified_content?: string }
    """
    from terminal.janus_session import JanusSessionManager
    
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    
    pending_id = data.get('pending_id')
    modified_content = data.get('modified_content')
    
    if not pending_id:
        return JsonResponse({'error': 'pending_id required'}, status=400)
    
    success = JanusSessionManager.approve_response(pending_id, modified_content, channel)
    
    if success:
        return JsonResponse({'success': True, 'channel': channel})
    else:
        return JsonResponse({'error': 'Pending response not found'}, status=404)


@login_required
def api_janus_channel_reject(request, channel):
    """
    Reject a pending AI response for a specific channel.
    POST: { pending_id: string }
    """
    from terminal.janus_session import JanusSessionManager

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    pending_id = data.get('pending_id')

    if not pending_id:
        return JsonResponse({'error': 'pending_id required'}, status=400)

    success = JanusSessionManager.reject_response(pending_id, channel)

    if success:
        return JsonResponse({'success': True, 'channel': channel})
    else:
        return JsonResponse({'error': 'Pending response not found'}, status=404)


@login_required
def api_janus_channel_generate(request, channel):
    """
    GM prompts AI to generate a JANUS response for a specific channel.
    POST: { prompt: string, context_override?: string }
    Returns a pending response for GM approval.
    """
    from terminal.janus_session import JanusSessionManager

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    prompt = data.get('prompt', '').strip()
    context_override = data.get('context_override', '').strip()

    if not prompt:
        return JsonResponse({'error': 'Prompt required'}, status=400)

    # Determine location context from channel name
    location_path = None
    if channel.startswith('encounter-'):
        location_slug = channel[len('encounter-'):]
        from terminal.data_loader import DataLoader
        loader = DataLoader()
        path_slugs = loader.get_location_path(location_slug)
        if path_slugs:
            location_path = '/'.join(path_slugs)

    # Generate AI response with location context
    from terminal.janus_ai import get_janus_ai
    ai = get_janus_ai(location_path=location_path)
    conversation = JanusSessionManager.get_conversation(channel)

    # Build context prompt
    context_parts = [f"[GM PROMPT: {prompt}]"]
    if context_override:
        context_parts.append(f"[GM CONTEXT OVERRIDE: {context_override}]")
    context_parts.append("\n\nGenerate a JANUS response based on this context.")
    context_prompt = "\n".join(context_parts)

    response = ai.generate_response(context_prompt, conversation)

    # Queue for GM approval
    import uuid
    pending_id = JanusSessionManager.add_pending_response(
        query=f"[GM Prompt] {prompt}",
        response=response,
        query_id=str(uuid.uuid4()),
        channel=channel
    )

    return JsonResponse({
        'success': True,
        'pending_id': pending_id,
        'response': response,
        'channel': channel,
    })


@login_required
def api_janus_channel_clear(request, channel):
    """
    GM clears conversation for a specific channel.
    POST: {}
    """
    from terminal.janus_session import JanusSessionManager

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    JanusSessionManager.clear_conversation(channel)
    return JsonResponse({'success': True, 'channel': channel})


@login_required
def api_crew(request):
    """
    GM endpoint — returns crew roster and all NPCs.
    GET: Returns { crew: [...], npcs: [...] }
    """
    from terminal.data_loader import DataLoader

    loader = DataLoader()
    crew = loader.load_crew()
    npcs = loader.load_npcs()
    return JsonResponse({'crew': crew, 'npcs': npcs})


@login_required
def api_sessions(request):
    """
    GM endpoint — returns session logs from data/campaign/sessions/.
    GET: Returns sessions list sorted newest-first with frontmatter + body.
    """
    from terminal.data_loader import DataLoader

    loader = DataLoader()
    sessions = loader.load_sessions()
    return JsonResponse({'sessions': sessions})


def api_campaign_docs(request):
    """
    GM endpoint — returns list of campaign docs from data/campaign/docs/.
    GET: Returns [{slug, title}] sorted by filename.
    """
    from terminal.data_loader import DataLoader

    loader = DataLoader()
    docs = loader.load_campaign_docs()
    return JsonResponse({'docs': docs})


def api_campaign_doc(request, slug):
    """
    GM endpoint — returns a single campaign doc by slug.
    GET: Returns {slug, title, content} (markdown body, frontmatter stripped).
    """
    from terminal.data_loader import DataLoader

    loader = DataLoader()
    doc = loader.load_campaign_doc(slug)
    if doc is None:
        return JsonResponse({'error': 'Not found'}, status=404)
    return JsonResponse(doc)
