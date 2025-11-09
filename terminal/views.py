from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import logout
from django.contrib import messages as django_messages
from django.http import JsonResponse
from .models import Message


def find_location_recursive(locations, slug):
    """
    Recursively search for a location by slug in a nested location structure.
    """
    for location in locations:
        if location['slug'] == slug:
            return location
        if location.get('children'):
            found = find_location_recursive(location['children'], slug)
            if found:
                return found
    return None


@login_required
def terminal_view(request):
    """
    Display terminal messages for players.
    Shows messages in retro computer terminal style.
    """
    # Get messages for this user (or all messages if none specified)
    user_messages = Message.objects.filter(
        recipients=request.user
    ) | Message.objects.filter(recipients__isnull=True)

    user_messages = user_messages.distinct().order_by('-created_at')[:50]

    return render(request, 'terminal/terminal.html', {
        'messages': user_messages
    })


@login_required
def gm_console(request):
    """
    GM interface for sending messages to players and managing active view.
    """
    from terminal.data_loader import load_all_locations
    from terminal.models import ActiveView

    # Handle terminal overlay (Show button)
    if request.method == 'POST' and 'show_terminal' in request.POST:
        active_view = ActiveView.get_current()
        active_view.overlay_location_slug = request.POST.get('location_slug', '')
        active_view.overlay_terminal_slug = request.POST.get('terminal_slug', '')
        active_view.updated_by = request.user
        active_view.save()

        django_messages.success(request, f'Showing terminal overlay: {active_view.overlay_terminal_slug}')
        return redirect('gm_console')

    # Handle view switching POST (Display button)
    if request.method == 'POST' and 'switch_view' in request.POST:
        active_view = ActiveView.get_current()
        active_view.location_slug = request.POST.get('location_slug', '')
        active_view.view_type = request.POST.get('view_type', 'MESSAGES')
        active_view.view_slug = request.POST.get('view_slug', '')
        active_view.updated_by = request.user
        active_view.save()

        django_messages.success(request, f'Active view switched to {active_view.get_view_type_display()}')
        return redirect('gm_console')

    # Handle broadcast message POST
    if request.method == 'POST' and 'send_message' in request.POST:
        sender = request.POST.get('sender', 'CHARON')
        content = request.POST.get('content')
        priority = request.POST.get('priority', 'NORMAL')

        if content:
            message = Message.objects.create(
                sender=sender,
                content=content,
                priority=priority,
                created_by=request.user
            )

            # For now, broadcast to all players (no specific recipients)
            # We'll add recipient selection later

            django_messages.success(request, 'Message sent to all players!')
            return redirect('gm_console')

    # Load all campaign data
    locations = load_all_locations()

    # Get current active view
    active_view = ActiveView.get_current()

    recent_messages = Message.objects.all()[:20]

    return render(request, 'terminal/gm_console.html', {
        'recent_messages': recent_messages,
        'locations': locations,
        'active_view': active_view,
    })


def logout_view(request):
    """
    Custom logout view that handles both GET and POST.
    """
    if request.method == 'POST':
        logout(request)
        return redirect('login')

    # For GET requests, show a confirmation page
    return render(request, 'terminal/logout.html')


def display_view(request):
    """
    Public display view for shared table monitor.
    No login required - read-only kiosk mode.
    Displays content based on GM's active view selection.
    """
    from terminal.models import ActiveView
    from terminal.data_loader import load_all_locations, load_location

    # Get current active view from GM console
    active_view = ActiveView.get_current()

    # Get all broadcast messages (no specific recipients)
    all_messages = Message.objects.filter(
        recipients__isnull=True
    ).order_by('-created_at')[:50]

    # Count messages per sender for sidebar, sorted by most recent message
    from django.db.models import Count, Max
    senders = {}
    sender_counts = Message.objects.filter(
        recipients__isnull=True
    ).values('sender').annotate(
        count=Count('id'),
        latest=Max('created_at')
    ).order_by('-latest')  # Sort by most recent message first

    for item in sender_counts:
        senders[item['sender']] = item['count']

    # Get first sender for initial display (though we won't auto-select)
    first_sender = list(senders.keys())[0] if senders else ''

    # Load location data if active view has a location
    location_data = None
    if active_view.location_slug:
        # Load all locations recursively to find the selected one
        all_locations = load_all_locations()
        location_data = find_location_recursive(all_locations, active_view.location_slug)

    return render(request, 'terminal/display_inbox.html', {
        'messages': all_messages,
        'senders': senders,
        'first_sender': first_sender,
        'active_view': active_view,
        'location_data': location_data,
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
