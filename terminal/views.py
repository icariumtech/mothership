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

    return render(request, 'terminal/shared_console_react.html', {
        'active_view': active_view,
        'star_systems_json': star_systems_json,
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
    import json

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    active_view = ActiveView.get_current()
    active_view.view_type = data.get('view_type', 'STANDBY')
    active_view.location_slug = data.get('location_slug', '')
    active_view.view_slug = data.get('view_slug', '')
    # Clear overlay when switching views
    active_view.overlay_location_slug = ''
    active_view.overlay_terminal_slug = ''
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

    return JsonResponse({
        'mode': active_view.charon_mode,
        'charon_location_path': active_view.charon_location_path or '',
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
    from terminal.charon_ai import CharonAI

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
    location_path = active_view.charon_location_path or None
    ai = CharonAI(location_path=location_path)
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
    from terminal.charon_ai import CharonAI

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
    from terminal.models import ActiveView
    active_view = ActiveView.get_current()
    location_path = active_view.charon_location_path or None

    # Generate AI response based on GM's prompt with location knowledge
    ai = CharonAI(location_path=location_path)
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
