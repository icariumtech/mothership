from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import logout
from django.http import JsonResponse
import json
from django.conf import settings
from core.data_loader import get_loader
from core.active_view_store import get_state
from .active_view import build_active_view_payload


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
    loader = get_loader()
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




@login_required
def gm_console_react(request):
    """
    React version of the GM Console.
    Provides a simpler, standard-widget UI for GM control.
    """
    loader = get_loader()
    ship_data = loader.load_ship_status()
    ship_status_json = json.dumps(ship_data) if ship_data else 'null'
    return render(request, 'terminal/gm_console_react.html', {
        'ship_status_json': ship_status_json,
    })


