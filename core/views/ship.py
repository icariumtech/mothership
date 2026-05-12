from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
import json
from core.data_loader import get_loader
from core.sse_broadcaster import broadcaster


def api_ship_status(request):
    """
    API endpoint to get ship status data.
    Merges YAML defaults with ActiveView runtime overrides.
    GET: Returns ship status JSON
    Public endpoint - no login required (terminal needs to read it).
    """

    loader = get_loader()
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

    # Validate system name against what's actually in ship.yaml
    _ship = get_loader().load_ship_status() or {}
    valid_systems = list((_ship.get('systems') or {}).keys())
    if system_name not in valid_systems:
        return JsonResponse({
            'error': f'Invalid system. Must be one of: {", ".join(valid_systems)}'
        }, status=400)

    # Build update fields — status is optional
    fields = {}
    if status:
        valid_statuses = ['ONLINE', 'STRESSED', 'DAMAGED', 'CRITICAL', 'OFFLINE']
        if status not in valid_statuses:
            return JsonResponse({
                'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'
            }, status=400)
        fields['status'] = status
    if 'condition' in data:
        fields['condition'] = int(data['condition'])
    if 'warnings' in data:
        fields['warnings'] = data['warnings']

    # Write directly to ship.yaml
    loader = get_loader()
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
def api_ship_update_fault(request):
    """
    API endpoint to toggle a fault indicator on a ship system.
    GM only.
    POST: { system: string, index: number, active: bool }
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    system_name = data.get('system', '').strip()
    index = data.get('index', -1)
    active = bool(data.get('active', False))

    if not system_name:
        return JsonResponse({'error': 'system is required'}, status=400)

    loader = get_loader()
    loader.save_system_fault_indicator(system_name, int(index), active)

    try:
        ship_broadcast_data = loader.load_ship_status()
        if ship_broadcast_data:
            broadcaster.announce_ship_status(ship_broadcast_data)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning('Failed to broadcast ship status via SSE: %s', e)

    return JsonResponse({'ok': True})




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
    loader = get_loader()
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




@csrf_exempt
def api_ship_update_stat(request):
    """
    API endpoint to update a ship stat (thrusters, battle, systems).
    POST: { stat: string, value: int }
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    stat = data.get('stat', '').strip()
    valid_stats = ['thrusters', 'battle', 'systems']
    if stat not in valid_stats:
        return JsonResponse({'error': f'Invalid stat. Must be one of: {", ".join(valid_stats)}'}, status=400)

    value = data.get('value')
    if not isinstance(value, int):
        return JsonResponse({'error': 'value must be an integer'}, status=400)

    loader = get_loader()
    loader.save_ship_stat(stat, value)

    try:
        ship_broadcast_data = loader.load_ship_status()
        if ship_broadcast_data:
            broadcaster.announce_ship_status(ship_broadcast_data)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning('Failed to broadcast ship status via SSE: %s', e)

    return JsonResponse({'success': True, 'stat': stat, 'value': value})




@login_required
def api_ship_update_resource(request):
    """
    API endpoint to update ship resource values.
    GM only - updates resource fields in ship.yaml.
    POST: { resource: "fuel"|"food"|"o2"|"cryopods"|"escape_pods", current?: number, max?: number, occupied?: number, available?: number, total?: number }
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    resource = data.get('resource', '').strip()
    _ship = get_loader().load_ship_status() or {}
    valid_resources = list((_ship.get('resources') or {}).keys())
    if resource not in valid_resources:
        return JsonResponse({
            'error': f'Invalid resource. Must be one of: {", ".join(valid_resources)}'
        }, status=400)

    values = {}
    for key in ('current', 'max'):
        if key in data:
            values[key] = int(data[key])
    if 'info' in data:
        values['info'] = data['info']

    if not values:
        return JsonResponse({'error': 'Provide at least one value field'}, status=400)

    loader = get_loader()
    loader.save_ship_resource(resource, values)

    # Broadcast updated ship status
    try:
        ship_broadcast_data = loader.load_ship_status()
        if ship_broadcast_data:
            broadcaster.announce_ship_status(ship_broadcast_data)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning('Failed to broadcast ship status via SSE: %s', e)

    return JsonResponse({'success': True, 'resource': resource, 'values': values})




@login_required
def api_ship_update_cargo(request):
    """
    API endpoint to add or remove cargo items.
    Accessible to any logged-in user (players and GM).
    POST: { action: "add", item: "string" }
          { action: "remove", index: number }
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    action = data.get('action', '').strip()
    if action not in ('add', 'remove'):
        return JsonResponse({'error': 'action must be "add" or "remove"'}, status=400)

    loader = get_loader()
    ship_data = loader.load_ship_status() or {}
    cargo = ship_data.get('cargo', {}) or {}
    items = list(cargo.get('items', []))

    if action == 'add':
        item = data.get('item', '').strip()
        if not item:
            return JsonResponse({'error': 'item is required for add'}, status=400)
        items.append(item)
    elif action == 'remove':
        index = data.get('index')
        if index is None or not isinstance(index, int) or index < 0 or index >= len(items):
            return JsonResponse({'error': 'Invalid index'}, status=400)
        items.pop(index)

    loader.save_ship_cargo(items)

    # Broadcast updated ship status
    try:
        ship_broadcast_data = loader.load_ship_status()
        if ship_broadcast_data:
            broadcaster.announce_ship_status(ship_broadcast_data)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning('Failed to broadcast ship status via SSE: %s', e)

    return JsonResponse({'success': True, 'items': items})




@login_required
def api_ship_reactor_power(request):
    """
    API endpoint for players to adjust reactor power allocation.
    POST: { system: string, amount: int }
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    system_name = data.get('system', '').strip()
    amount = data.get('amount')

    if not system_name:
        return JsonResponse({'error': 'system is required'}, status=400)
    if amount is None or not isinstance(amount, int) or amount < 0:
        return JsonResponse({'error': 'amount must be a non-negative integer'}, status=400)

    loader = get_loader()
    ship_data = loader.load_ship_status() or {}
    all_systems = ship_data.get('systems', {})
    reactor = all_systems.get('reactor', {})
    power_capacity = reactor.get('power_capacity', 0)

    valid_systems = [k for k in all_systems.keys() if k != 'reactor']
    if system_name not in valid_systems:
        return JsonResponse({'error': f'System "{system_name}" not a valid ship system'}, status=400)

    sys_power = all_systems[system_name].get('power') or {}
    sys_max = sys_power.get('max', 99)
    if amount > sys_max:
        return JsonResponse({'error': f'Amount exceeds system max ({amount} > {sys_max})'}, status=400)

    current_total = sum((all_systems[k].get('power') or {}).get('allocated', 0) for k in valid_systems)
    old_amount = sys_power.get('allocated', 0)
    new_total = current_total - old_amount + amount

    if new_total > power_capacity:
        return JsonResponse({
            'error': f'Allocation would exceed capacity ({new_total} > {power_capacity})'
        }, status=400)

    loader.save_system_power(system_name, amount)

    try:
        ship_broadcast_data = loader.load_ship_status()
        if ship_broadcast_data:
            broadcaster.announce_ship_status(ship_broadcast_data)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning('Failed to broadcast ship status via SSE: %s', e)

    return JsonResponse({'success': True, 'power_grid': power_grid})




@login_required
def api_ship_reactor_action(request):
    """
    API endpoint for players to trigger emergency reactor actions.
    POST: { action: "emergency_shutdown" | "cold_start" | "vent_plasma" }
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    action = data.get('action', '').strip()
    valid_actions = ('emergency_shutdown', 'cold_start', 'vent_plasma')
    if action not in valid_actions:
        return JsonResponse({'error': f'action must be one of: {", ".join(valid_actions)}'}, status=400)

    loader = get_loader()
    ship_data = loader.load_ship_status() or {}
    reactor = ship_data.get('systems', {}).get('reactor', {})
    current_status = reactor.get('status', 'OFFLINE')

    if action == 'emergency_shutdown':
        if current_status == 'OFFLINE':
            return JsonResponse({'error': 'Reactor is already offline'}, status=400)
        # Zero all non-reactor power allocations atomically with reactor shutdown
        all_systems = ship_data.setdefault('systems', {})
        for sys_key, sys_data in all_systems.items():
            if sys_key != 'reactor' and isinstance(sys_data, dict):
                power = sys_data.get('power')
                if power and isinstance(power, dict):
                    power['allocated'] = 0
        all_systems.setdefault('reactor', {}).update({'status': 'OFFLINE', 'condition': 0})
        loader._save_ship_yaml(ship_data)
        fields = {'status': 'OFFLINE', 'condition': 0}
    elif action == 'cold_start':
        if current_status != 'OFFLINE':
            return JsonResponse({'error': 'Cold start only available when reactor is offline'}, status=400)
        fields = {'status': 'ONLINE', 'condition': 30}
        loader.save_ship_system('reactor', fields)
    elif action == 'vent_plasma':
        if current_status != 'CRITICAL':
            return JsonResponse({'error': 'Plasma vent only available in critical state'}, status=400)
        fields = {'status': 'STRESSED', 'condition': 50, 'warnings': ['Plasma vented — core stabilizing']}
        loader.save_ship_system('reactor', fields)

    try:
        ship_broadcast_data = loader.load_ship_status()
        if ship_broadcast_data:
            broadcaster.announce_ship_status(ship_broadcast_data)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning('Failed to broadcast ship status via SSE: %s', e)

    return JsonResponse({'success': True, 'action': action, 'fields': fields})


