from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import logout
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Message
import yaml
import os
import json
from django.conf import settings


def get_charon_location_path(active_view) -> str:
    """
    Derive CHARON's location context from the active view.

    Priority:
    1. If in ENCOUNTER view with a location, derive path from location_slug
    2. Fall back to explicitly set charon_location_path
    3. Return None if no location context available

    Returns:
        Location path string like "sol/earth/uscss_morrigan" or None
    """
    from terminal.data_loader import DataLoader

    # If in ENCOUNTER view, derive from encounter location
    if active_view.view_type == 'ENCOUNTER' and active_view.location_slug:
        loader = DataLoader()
        path_slugs = loader.get_location_path(active_view.location_slug)
        if path_slugs:
            return '/'.join(path_slugs)

    # Fall back to explicitly set CHARON location
    if active_view.charon_location_path:
        return active_view.charon_location_path

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
    from terminal.models import ActiveView
    from terminal.data_loader import DataLoader

    # Get current active view from GM console
    active_view = ActiveView.get_current()

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

    # Load ship status and merge runtime overrides
    ship_data = loader.load_ship_status()
    if ship_data and ship_data.get('ship'):
        overrides = active_view.ship_system_overrides or {}
        for system_name, override in overrides.items():
            if system_name in ship_data['ship'].get('systems', {}):
                ship_data['ship']['systems'][system_name].update(override)
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


def get_active_view_json(request):
    """
    API endpoint to get the current active view state.
    Used by the display terminal to detect when GM changes the view.
    Public endpoint - no login required.
    """
    from terminal.models import ActiveView
    from terminal.data_loader import DataLoader

    active_view = ActiveView.get_current()

    response = {
        'location_slug': active_view.location_slug or '',
        'view_type': active_view.view_type,
        'view_slug': active_view.view_slug or '',
        'overlay_location_slug': active_view.overlay_location_slug or '',
        'overlay_terminal_slug': active_view.overlay_terminal_slug or '',
        'charon_mode': active_view.charon_mode,
        'charon_location_path': active_view.charon_location_path or '',
        'charon_dialog_open': active_view.charon_dialog_open,
        'charon_active_channel': active_view.charon_active_channel or 'story',
        'encounter_level': active_view.encounter_level,
        'encounter_deck_id': active_view.encounter_deck_id or '',
        'encounter_room_visibility': active_view.encounter_room_visibility or {},
        'encounter_door_status': active_view.encounter_door_status or {},
        'encounter_tokens': active_view.encounter_tokens or {},
        'updated_at': active_view.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
    }

    # For ENCOUNTER view, include location metadata for view rendering
    if active_view.view_type == 'ENCOUNTER' and active_view.location_slug:
        loader = DataLoader()
        location = loader.find_location_by_slug(active_view.location_slug)
        if location:
            response['location_type'] = location.get('type', 'unknown')
            response['location_name'] = location.get('name', '')
            response['location_data'] = location

            # Get hierarchical path for navigation (e.g., ['sol', 'earth'] for Earth)
            location_path = loader.get_location_path(active_view.location_slug)
            if location_path:
                response['location_path'] = location_path
                # For planets/moons, include system_slug for orbit map loading
                if len(location_path) >= 1:
                    response['location_data']['system_slug'] = location_path[0]
                # For planets, the body is at index 1
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
                    current_deck_id = active_view.encounter_deck_id
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

    return JsonResponse(response)


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
    return render(request, 'terminal/gm_console_react.html')


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
    from terminal.models import ActiveView
    from terminal.data_loader import DataLoader
    import json

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    active_view = ActiveView.get_current()
    new_view_type = data.get('view_type', 'STANDBY')
    new_location_slug = data.get('location_slug', '')

    # Check if we're switching to a different ENCOUNTER location
    is_new_encounter_location = (
        new_view_type == 'ENCOUNTER' and
        new_location_slug and
        (active_view.location_slug != new_location_slug or active_view.view_type != 'ENCOUNTER')
    )

    active_view.view_type = new_view_type
    active_view.location_slug = new_location_slug
    active_view.view_slug = data.get('view_slug', '')
    # Clear overlay when switching views
    active_view.overlay_location_slug = ''
    active_view.overlay_terminal_slug = ''

    # Auto-set CHARON channel based on view type
    if new_view_type == 'CHARON_TERMINAL':
        active_view.charon_active_channel = 'story'
        # Clear story channel conversation on CHARON_TERMINAL view switch
        from terminal.charon_session import CharonSessionManager
        CharonSessionManager.clear_conversation('story')
    elif new_view_type == 'BRIDGE':
        active_view.charon_active_channel = 'bridge'
        # Clear bridge channel conversation on BRIDGE view switch
        from terminal.charon_session import CharonSessionManager
        CharonSessionManager.clear_conversation('bridge')
    elif new_view_type == 'ENCOUNTER' and new_location_slug:
        active_view.charon_active_channel = f'encounter-{new_location_slug}'

    # When switching to a new ENCOUNTER location, initialize all rooms as hidden
    if is_new_encounter_location:
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
            active_view.encounter_room_visibility = {room_id: False for room_id in all_room_ids}

            # Set default deck level and ID
            if map_data.get('is_multi_deck'):
                manifest = map_data.get('manifest', {})
                decks = manifest.get('decks', [])
                # Find the default deck, or use the first one
                default_deck = next((d for d in decks if d.get('default')), decks[0] if decks else None)
                if default_deck:
                    active_view.encounter_level = default_deck.get('level', 1)
                    active_view.encounter_deck_id = default_deck.get('id', '')
                else:
                    active_view.encounter_level = 1
                    active_view.encounter_deck_id = ''
            else:
                # Single deck map
                active_view.encounter_level = 1
                active_view.encounter_deck_id = map_data.get('deck_id', '')

    active_view.updated_by = request.user
    active_view.save()

    return JsonResponse({
        'success': True,
        'view_type': active_view.view_type,
        'location_slug': active_view.location_slug
    })


@login_required
def api_show_terminal(request):
    """
    API endpoint to show a terminal overlay.
    POST: { location_slug: string, terminal_slug: string }
    """
    from terminal.models import ActiveView
    import json

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    active_view = ActiveView.get_current()
    active_view.overlay_location_slug = data.get('location_slug', '')
    active_view.overlay_terminal_slug = data.get('terminal_slug', '')
    active_view.updated_by = request.user
    active_view.save()

    return JsonResponse({
        'success': True,
        'overlay_terminal_slug': active_view.overlay_terminal_slug
    })


@csrf_exempt
def api_hide_terminal(request):
    """
    Public API endpoint to hide the terminal overlay.
    Called by players when they dismiss the terminal dialog.
    POST: {}
    """
    from terminal.models import ActiveView

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    active_view = ActiveView.get_current()
    active_view.overlay_location_slug = ''
    active_view.overlay_terminal_slug = ''
    active_view.save()

    return JsonResponse({
        'success': True
    })


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
        sender=data.get('sender', 'CHARON'),
        content=content,
        priority=data.get('priority', 'NORMAL'),
        created_by=request.user
    )

    return JsonResponse({
        'success': True,
        'message_id': message.id
    })


# =============================================================================
# CHARON Terminal API Endpoints
# =============================================================================

def api_charon_conversation(request):
    """
    Get current CHARON conversation (public for terminal display).
    GET: Returns conversation messages and mode.
    """
    from terminal.models import ActiveView
    from terminal.charon_session import CharonSessionManager

    active_view = ActiveView.get_current()
    conversation = CharonSessionManager.get_conversation()

    # Get the derived location path (from encounter or explicit setting)
    derived_location_path = get_charon_location_path(active_view)

    return JsonResponse({
        'mode': active_view.charon_mode,
        'charon_location_path': active_view.charon_location_path or '',
        'active_location_path': derived_location_path or '',  # What CHARON is actually using
        'messages': conversation,
        'updated_at': active_view.updated_at.isoformat(),
    })


@csrf_exempt
def api_charon_submit_query(request):
    """
    Player submits query to CHARON (only works in Query mode).
    POST: { query: string }
    Public endpoint - players submit queries from shared terminal.
    CSRF exempt since this is called from unauthenticated player terminals.
    """
    from terminal.models import ActiveView
    from terminal.charon_session import CharonSessionManager, CharonMessage

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    # Check if in query mode
    active_view = ActiveView.get_current()
    if active_view.charon_mode != 'QUERY':
        return JsonResponse({'error': 'Terminal not in query mode'}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    query = data.get('query', '').strip()
    if not query:
        return JsonResponse({'error': 'Query required'}, status=400)

    # Add player query to conversation
    query_msg = CharonMessage(role='user', content=query)
    CharonSessionManager.add_message(query_msg)

    # Generate AI response with location-specific knowledge
    # Derive location from encounter view or fall back to explicit setting
    location_path = get_charon_location_path(active_view)
    from terminal.charon_ai import get_charon_ai
    ai = get_charon_ai(location_path=location_path)
    conversation = CharonSessionManager.get_conversation()
    response = ai.generate_response(query, conversation)

    # Queue for GM approval
    pending_id = CharonSessionManager.add_pending_response(
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
def api_charon_switch_mode(request):
    """
    Switch CHARON terminal mode (Display/Query).
    POST: { mode: 'DISPLAY' | 'QUERY' }
    """
    from terminal.models import ActiveView

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    mode = data.get('mode', 'DISPLAY')
    if mode not in ('DISPLAY', 'QUERY'):
        return JsonResponse({'error': 'Invalid mode. Must be DISPLAY or QUERY'}, status=400)

    active_view = ActiveView.get_current()
    active_view.charon_mode = mode
    active_view.updated_by = request.user
    active_view.save()

    return JsonResponse({'success': True, 'mode': mode})


@login_required
def api_charon_set_location(request):
    """
    Set the active CHARON instance location.
    POST: { location_path: string }
    """
    from terminal.models import ActiveView

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    location_path = data.get('location_path', '')

    active_view = ActiveView.get_current()
    active_view.charon_location_path = location_path
    active_view.updated_by = request.user
    active_view.save()

    return JsonResponse({'success': True, 'location_path': location_path})


@login_required
def api_charon_send_message(request):
    """
    GM sends message directly to CHARON terminal.
    POST: { content: string }
    """
    from terminal.charon_session import CharonSessionManager, CharonMessage

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    content = data.get('content', '').strip()
    if not content:
        return JsonResponse({'error': 'Content required'}, status=400)

    msg = CharonMessage(role='charon', content=content)
    CharonSessionManager.add_message(msg)

    return JsonResponse({'success': True, 'message_id': msg.message_id})


@login_required
def api_charon_generate(request):
    """
    GM prompts AI to generate a CHARON response for review.
    POST: { prompt: string }
    Returns a pending response for GM approval.
    """
    from terminal.charon_session import CharonSessionManager

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    prompt = data.get('prompt', '').strip()
    if not prompt:
        return JsonResponse({'error': 'Prompt required'}, status=400)

    # Get active CHARON location for knowledge context
    # Derive location from encounter view or fall back to explicit setting
    from terminal.models import ActiveView
    active_view = ActiveView.get_current()
    location_path = get_charon_location_path(active_view)

    # Generate AI response based on GM's prompt with location knowledge
    from terminal.charon_ai import get_charon_ai
    ai = get_charon_ai(location_path=location_path)
    conversation = CharonSessionManager.get_conversation()

    # Create a context message for the AI that includes the GM's prompt
    context_prompt = f"[GM CONTEXT: {prompt}]\n\nGenerate a CHARON response based on this context."
    response = ai.generate_response(context_prompt, conversation)

    # Queue for GM approval (using prompt as the "query" for reference)
    import uuid
    pending_id = CharonSessionManager.add_pending_response(
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
def api_charon_pending(request):
    """
    GM gets list of pending AI responses for approval.
    GET: Returns list of pending responses.
    """
    from terminal.charon_session import CharonSessionManager

    pending = CharonSessionManager.get_pending_responses()
    return JsonResponse({'pending': pending})


@login_required
def api_charon_approve(request):
    """
    GM approves a pending response.
    POST: { pending_id: string, modified_content?: string }
    """
    from terminal.charon_session import CharonSessionManager

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
    success = CharonSessionManager.approve_response(pending_id, modified)

    if success:
        return JsonResponse({'success': True})
    else:
        return JsonResponse({'error': 'Pending response not found'}, status=404)


@login_required
def api_charon_reject(request):
    """
    GM rejects a pending response.
    POST: { pending_id: string }
    """
    from terminal.charon_session import CharonSessionManager

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    pending_id = data.get('pending_id')
    if not pending_id:
        return JsonResponse({'error': 'pending_id required'}, status=400)

    success = CharonSessionManager.reject_response(pending_id)

    if success:
        return JsonResponse({'success': True})
    else:
        return JsonResponse({'error': 'Pending response not found'}, status=404)


@login_required
def api_charon_clear(request):
    """
    GM clears the CHARON conversation.
    POST: {}
    """
    from terminal.charon_session import CharonSessionManager

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    CharonSessionManager.clear_conversation()
    return JsonResponse({'success': True})


@csrf_exempt
def api_charon_toggle_dialog(request):
    """
    Toggle the CHARON dialog overlay visibility.
    POST: { open?: boolean }
    If open is not specified, toggles the current state.
    Public endpoint - players can open/close dialog from shared terminal.
    CSRF exempt since this is called from unauthenticated player terminals.
    """
    from terminal.models import ActiveView

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        data = {}

    active_view = ActiveView.get_current()

    # If 'open' is specified, set to that value; otherwise toggle
    if 'open' in data:
        active_view.charon_dialog_open = bool(data['open'])
    else:
        active_view.charon_dialog_open = not active_view.charon_dialog_open

    # Only set updated_by if user is authenticated
    if request.user.is_authenticated:
        active_view.updated_by = request.user
    active_view.save()

    return JsonResponse({
        'success': True,
        'charon_dialog_open': active_view.charon_dialog_open
    })


# ==================== Encounter Map API Endpoints ====================

@login_required
def api_encounter_switch_level(request):
    """
    Switch the current encounter deck/level.
    POST: { level: number, deck_id: string }
    """
    from terminal.models import ActiveView

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    level = data.get('level', 1)
    deck_id = data.get('deck_id', '')

    active_view = ActiveView.get_current()
    active_view.encounter_level = level
    active_view.encounter_deck_id = deck_id
    # Don't clear room visibility when switching levels - preserve visibility state
    active_view.updated_by = request.user
    active_view.save()

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
    from terminal.models import ActiveView

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    room_id = data.get('room_id')
    if not room_id:
        return JsonResponse({'error': 'room_id required'}, status=400)

    active_view = ActiveView.get_current()
    visibility = active_view.encounter_room_visibility or {}

    # If visible is specified, use it; otherwise toggle
    if 'visible' in data:
        visibility[room_id] = bool(data['visible'])
    else:
        visibility[room_id] = not visibility.get(room_id, True)

    active_view.encounter_room_visibility = visibility
    active_view.updated_by = request.user
    active_view.save()

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
    from terminal.models import ActiveView

    active_view = ActiveView.get_current()

    if request.method == 'GET':
        return JsonResponse({
            'room_visibility': active_view.encounter_room_visibility or {}
        })

    if request.method == 'POST':
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        visibility = data.get('room_visibility', {})
        active_view.encounter_room_visibility = visibility
        active_view.updated_by = request.user
        active_view.save()

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
    from terminal.models import ActiveView

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

    active_view = ActiveView.get_current()
    door_states = active_view.encounter_door_status or {}
    door_states[connection_id] = door_status

    active_view.encounter_door_status = door_states
    active_view.updated_by = request.user
    active_view.save()

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
    from terminal.models import ActiveView
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
    active_view = ActiveView.get_current()
    tokens = active_view.encounter_tokens or {}
    tokens[token_id] = token_data

    active_view.encounter_tokens = tokens
    active_view.save()

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
    from terminal.models import ActiveView

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
    active_view = ActiveView.get_current()
    tokens = active_view.encounter_tokens or {}

    if token_id not in tokens:
        return JsonResponse({'error': 'Token not found'}, status=404)

    tokens[token_id]['x'] = x
    tokens[token_id]['y'] = y
    tokens[token_id]['room_id'] = room_id

    active_view.encounter_tokens = tokens
    active_view.save()

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
    from terminal.models import ActiveView

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
    active_view = ActiveView.get_current()
    tokens = active_view.encounter_tokens or {}

    if token_id not in tokens:
        return JsonResponse({'error': 'Token not found'}, status=404)

    del tokens[token_id]

    active_view.encounter_tokens = tokens
    active_view.save()

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
    from terminal.models import ActiveView

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
    active_view = ActiveView.get_current()
    tokens = active_view.encounter_tokens or {}

    if token_id not in tokens:
        return JsonResponse({'error': 'Token not found'}, status=404)

    tokens[token_id]['status'] = status

    active_view.encounter_tokens = tokens
    active_view.save()

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
    from terminal.models import ActiveView

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    # Clear all tokens
    active_view = ActiveView.get_current()
    active_view.encounter_tokens = {}
    active_view.save()

    return JsonResponse({
        'success': True,
        'tokens': {}
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
    from terminal.models import ActiveView

    loader = DataLoader()

    # Find location by walking hierarchy
    location = loader.find_location_by_slug(location_slug)
    if not location:
        return JsonResponse({'error': 'Location not found'}, status=404)

    map_data = location.get('map')
    if not map_data:
        return JsonResponse({'error': 'No map data for location'}, status=404)

    # Get active view for room visibility and current deck
    active_view = ActiveView.get_current()

    # Handle optional deck_id query param - fall back to active_view.encounter_deck_id
    requested_deck_id = request.GET.get('deck_id') or active_view.encounter_deck_id

    # If it's a multi-deck map and a specific deck is requested (or stored in active_view)
    if map_data.get('is_multi_deck') and requested_deck_id:
        # Get the full location path to load the specific deck
        location_path = loader.get_location_path(location_slug)
        if location_path:
            location_dir = loader.systems_dir
            for slug in location_path:
                location_dir = location_dir / slug

            deck_data = loader.load_deck_map(location_dir, requested_deck_id)
            if deck_data:
                map_data['current_deck'] = deck_data
                map_data['current_deck_id'] = requested_deck_id

    # Add room visibility state
    map_data['room_visibility'] = active_view.encounter_room_visibility or {}
    map_data['encounter_level'] = active_view.encounter_level
    map_data['encounter_deck_id'] = active_view.encounter_deck_id

    return JsonResponse(map_data)


def api_encounter_all_decks(request, location_slug):
    """
    Get all decks' data for a multi-deck location.
    Used by GM console to show rooms across all levels.
    GET: /api/encounter-map/<location_slug>/all-decks/
    """
    from terminal.data_loader import DataLoader
    from terminal.models import ActiveView

    loader = DataLoader()

    # Find location by walking hierarchy
    location = loader.find_location_by_slug(location_slug)
    if not location:
        return JsonResponse({'error': 'Location not found'}, status=404)

    map_data = location.get('map')
    if not map_data:
        return JsonResponse({'error': 'No map data for location'}, status=404)

    # Get active view for room visibility
    active_view = ActiveView.get_current()

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
            'room_visibility': active_view.encounter_room_visibility or {},
        })

    # Load all decks from manifest
    manifest = map_data.get('manifest', {})
    decks_data = []

    location_path = loader.get_location_path(location_slug)
    if location_path:
        location_dir = loader.systems_dir
        for slug in location_path:
            location_dir = location_dir / slug

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
        'room_visibility': active_view.encounter_room_visibility or {},
        'current_deck_id': active_view.encounter_deck_id,
    })


def api_ship_status(request):
    """
    API endpoint to get ship status data.
    Merges YAML defaults with ActiveView runtime overrides.
    GET: Returns ship status JSON
    Public endpoint - no login required (terminal needs to read it).
    """
    from terminal.data_loader import DataLoader
    from terminal.models import ActiveView

    loader = DataLoader()
    ship_data = loader.load_ship_status()

    if not ship_data:
        return JsonResponse({'error': 'Ship data not found'}, status=404)

    # Merge runtime overrides from ActiveView
    active_view = ActiveView.get_current()
    if ship_data and ship_data.get('ship'):
        overrides = active_view.ship_system_overrides or {}
        for system_name, override in overrides.items():
            if system_name in ship_data['ship'].get('systems', {}):
                ship_data['ship']['systems'][system_name].update(override)

    return JsonResponse(ship_data)


@login_required
def api_ship_toggle_system(request):
    """
    API endpoint to toggle/update ship system status.
    GM only - updates runtime overrides in ActiveView.
    POST: { system: string, status: string, condition?: number, info?: string }
    """
    from terminal.models import ActiveView

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

    # Build override object
    override = {'status': status}
    if 'condition' in data:
        override['condition'] = int(data['condition'])
    if 'info' in data:
        override['info'] = data['info']

    # Store override in ActiveView
    active_view = ActiveView.get_current()
    overrides = active_view.ship_system_overrides or {}
    overrides[system_name] = override
    active_view.ship_system_overrides = overrides
    active_view.updated_by = request.user
    active_view.save()

    return JsonResponse({
        'success': True,
        'system': system_name,
        'override': override
    })


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

    inbox = [format_message(m) for m in terminal.get('inbox', [])]
    sent = [format_message(m) for m in terminal.get('sent', [])]

    return JsonResponse({
        'slug': terminal.get('slug'),
        'owner': terminal.get('owner', ''),
        'terminal_id': terminal.get('terminal_id', ''),
        'access_level': terminal.get('access_level', 'PUBLIC'),
        'description': terminal.get('description', ''),
        'location_name': location.get('name', ''),
        'inbox': inbox,
        'sent': sent,
    })


# =============================================================================
# CHARON Channel Management (Multi-Channel Support)
# =============================================================================

@login_required
def api_charon_channels(request):
    """
    Get list of all active CHARON channels with message counts and unread indicators.
    GET: Returns list of channels with metadata.
    """
    from terminal.charon_session import CharonSessionManager
    
    channels = CharonSessionManager.get_all_channels()
    channel_data = []
    
    for channel in channels:
        conversation = CharonSessionManager.get_conversation(channel)
        last_read = CharonSessionManager.get_last_read(channel)
        last_read_id = last_read['message_id'] if last_read else None
        unread_count = CharonSessionManager.get_unread_count(channel, last_read_id)
        
        channel_data.append({
            'channel': channel,
            'message_count': len(conversation),
            'unread_count': unread_count,
            'last_message': conversation[-1] if conversation else None,
        })
    
    return JsonResponse({'channels': channel_data})


@csrf_exempt
def api_charon_channel_conversation(request, channel):
    """
    Get conversation for a specific channel (public for player terminals).
    GET: Returns conversation messages for the channel.
    """
    from terminal.charon_session import CharonSessionManager
    from terminal.models import ActiveView
    
    conversation = CharonSessionManager.get_conversation(channel)
    active_view = ActiveView.get_current()
    
    mode = active_view.charon_mode
    
    return JsonResponse({
        'channel': channel,
        'mode': mode,
        'messages': conversation,
    })


@csrf_exempt
def api_charon_channel_submit(request, channel):
    """
    Player submits query to a specific CHARON channel.
    POST: { query: string }
    Public endpoint - players submit queries from terminals.
    """
    from terminal.charon_session import CharonSessionManager, CharonMessage
    from terminal.models import ActiveView
    
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
    query_msg = CharonMessage(role='user', content=query)
    CharonSessionManager.add_message(query_msg, channel)
    
    # Generate AI response
    active_view = ActiveView.get_current()
    location_path = get_charon_location_path(active_view)
    from terminal.charon_ai import get_charon_ai
    ai = get_charon_ai(location_path=location_path)
    conversation = CharonSessionManager.get_conversation(channel)
    response = ai.generate_response(query, conversation)
    
    # Queue for GM approval
    pending_id = CharonSessionManager.add_pending_response(
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
def api_charon_channel_send(request, channel):
    """
    GM sends message to a specific CHARON channel.
    POST: { content: string }
    """
    from terminal.charon_session import CharonSessionManager, CharonMessage
    
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    
    content = data.get('content', '').strip()
    if not content:
        return JsonResponse({'error': 'Content required'}, status=400)
    
    msg = CharonMessage(role='charon', content=content)
    CharonSessionManager.add_message(msg, channel)
    
    return JsonResponse({
        'success': True,
        'message_id': msg.message_id,
        'channel': channel,
    })


@login_required
def api_charon_channel_mark_read(request, channel):
    """
    Mark all messages in a channel as read by GM.
    POST: No body required.
    """
    from terminal.charon_session import CharonSessionManager
    
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    CharonSessionManager.mark_channel_read(channel, request.user.id)
    
    return JsonResponse({'success': True, 'channel': channel})


@login_required
def api_charon_channel_pending(request, channel):
    """
    Get pending AI responses for a specific channel.
    GET: Returns pending responses awaiting GM approval.
    """
    from terminal.charon_session import CharonSessionManager
    
    pending = CharonSessionManager.get_pending_responses(channel)
    
    return JsonResponse({
        'channel': channel,
        'pending': pending,
        'count': len(pending),
    })


@login_required
def api_charon_channel_approve(request, channel):
    """
    Approve a pending AI response for a specific channel.
    POST: { pending_id: string, modified_content?: string }
    """
    from terminal.charon_session import CharonSessionManager
    
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
    
    success = CharonSessionManager.approve_response(pending_id, modified_content, channel)
    
    if success:
        return JsonResponse({'success': True, 'channel': channel})
    else:
        return JsonResponse({'error': 'Pending response not found'}, status=404)


@login_required
def api_charon_channel_reject(request, channel):
    """
    Reject a pending AI response for a specific channel.
    POST: { pending_id: string }
    """
    from terminal.charon_session import CharonSessionManager

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    pending_id = data.get('pending_id')

    if not pending_id:
        return JsonResponse({'error': 'pending_id required'}, status=400)

    success = CharonSessionManager.reject_response(pending_id, channel)

    if success:
        return JsonResponse({'success': True, 'channel': channel})
    else:
        return JsonResponse({'error': 'Pending response not found'}, status=404)


@login_required
def api_charon_channel_generate(request, channel):
    """
    GM prompts AI to generate a CHARON response for a specific channel.
    POST: { prompt: string, context_override?: string }
    Returns a pending response for GM approval.
    """
    from terminal.charon_session import CharonSessionManager

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
    from terminal.charon_ai import get_charon_ai
    ai = get_charon_ai(location_path=location_path)
    conversation = CharonSessionManager.get_conversation(channel)

    # Build context prompt
    context_parts = [f"[GM PROMPT: {prompt}]"]
    if context_override:
        context_parts.append(f"[GM CONTEXT OVERRIDE: {context_override}]")
    context_parts.append("\n\nGenerate a CHARON response based on this context.")
    context_prompt = "\n".join(context_parts)

    response = ai.generate_response(context_prompt, conversation)

    # Queue for GM approval
    import uuid
    pending_id = CharonSessionManager.add_pending_response(
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
def api_charon_channel_clear(request, channel):
    """
    GM clears conversation for a specific channel.
    POST: {}
    """
    from terminal.charon_session import CharonSessionManager

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    CharonSessionManager.clear_conversation(channel)
    return JsonResponse({'success': True, 'channel': channel})
