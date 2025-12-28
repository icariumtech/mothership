from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import logout
from django.http import JsonResponse
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

    active_view = ActiveView.get_current()

    return JsonResponse({
        'location_slug': active_view.location_slug or '',
        'view_type': active_view.view_type,
        'view_slug': active_view.view_slug or '',
        'overlay_location_slug': active_view.overlay_location_slug or '',
        'overlay_terminal_slug': active_view.overlay_terminal_slug or '',
        'updated_at': active_view.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
    })


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
