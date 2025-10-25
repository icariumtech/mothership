from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import logout
from django.contrib import messages as django_messages
from django.http import JsonResponse
from .models import Message


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
    GM interface for sending messages to players.
    """
    if request.method == 'POST':
        sender = request.POST.get('sender', 'MU-TH-UR 6000')
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

    recent_messages = Message.objects.all()[:20]

    return render(request, 'terminal/gm_console.html', {
        'recent_messages': recent_messages
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


@login_required
def get_messages_json(request):
    """
    API endpoint to fetch messages as JSON for real-time updates.
    Optionally accepts 'since' parameter to get only new messages.
    """
    since_id = request.GET.get('since', None)

    # Get messages for this user (or all messages if none specified)
    user_messages = Message.objects.filter(
        recipients=request.user
    ) | Message.objects.filter(recipients__isnull=True)

    user_messages = user_messages.distinct()

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
