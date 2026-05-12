from django.http import JsonResponse
import os
import yaml
from django.conf import settings
from core.data_loader import get_loader


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
    from pathlib import Path
    from django.conf import settings
    import yaml

    loader = get_loader()
    system_map = loader.load_system_map(system_slug)

    if system_map:
        # Count facilities per body from the assembled location tree
        from collections import defaultdict
        surface_counts = defaultdict(int)
        orbital_counts = defaultdict(int)
        for loc in loader.load_all_locations():
            if loc.get('system_slug') == system_slug:
                body = loc.get('body_slug')
                if body:
                    if loc.get('parent_type') == 'orbit':
                        orbital_counts[body] += 1
                    else:
                        surface_counts[body] += 1

        # Enhance each body with facility counts and orbit map presence
        bodies = system_map.get('bodies', [])
        for body in bodies:
            location_slug = body.get('location_slug')
            if location_slug:
                planet_dir = Path(settings.BASE_DIR) / 'data' / 'galaxy' / system_slug / location_slug
                orbit_map_file = planet_dir / 'orbit_map.yaml'
                body['has_orbit_map'] = orbit_map_file.exists()
                body['surface_facility_count'] = surface_counts.get(location_slug, 0)
                body['orbital_station_count'] = orbital_counts.get(location_slug, 0)
            else:
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

    loader = get_loader()
    orbit_map = loader.load_orbit_map(system_slug, body_slug)

    if orbit_map:
        return JsonResponse(orbit_map)
    else:
        return JsonResponse({
            'error': f'Orbit map not found for {system_slug}/{body_slug}',
            'system_slug': system_slug,
            'body_slug': body_slug
        }, status=404)


