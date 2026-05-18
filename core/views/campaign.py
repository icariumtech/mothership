from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from core.models import Message
import json
import yaml
import os
from django.conf import settings
from core.data_loader import get_loader
from core.active_view_store import get_state
from core.sse_broadcaster import broadcaster, format_sse
from .active_view import sync_state


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




def api_standby(request):
    """
    Public endpoint — returns standby screen config from data/campaign/standby.yaml.
    Falls back to JANUS defaults if the file is missing.
    GET: /api/standby/
    """
    loader = get_loader()
    standby_file = loader.data_dir / 'campaign' / 'standby.yaml'
    if not standby_file.exists():
        return JsonResponse({'title': 'JANUS', 'subtitle': ''})
    with open(standby_file) as f:
        data = yaml.safe_load(f) or {}
    return JsonResponse({
        'title': data.get('title', 'JANUS'),
        'subtitle': data.get('subtitle', ''),
    })


def api_corporation(request):
    """
    Public endpoint — returns corporation branding data from data/campaign/corporation.yaml.
    GET: /api/corporation/
    """
    loader = get_loader()
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

    locations = get_loader().load_all_locations()
    transformed = [transform_location(loc) for loc in locations]

    return JsonResponse({'locations': transformed})




@login_required
def api_broadcast(request):
    """
    API endpoint to send a broadcast message.
    POST: { sender: string, content: string, priority: string }
    """

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



@login_required
def api_crew(request):
    """
    GM endpoint — returns crew roster and all NPCs.
    GET: Returns { crew: [...], npcs: [...] }
    """

    loader = get_loader()
    crew = loader.load_crew()
    npcs = loader.load_npcs()
    return JsonResponse({'crew': crew, 'npcs': npcs})




@login_required
def api_sessions(request):
    """
    GM endpoint — returns session logs from data/campaign/sessions/.
    GET: Returns sessions list sorted newest-first with frontmatter + body.
    """

    loader = get_loader()
    sessions = loader.load_sessions()
    return JsonResponse({'sessions': sessions})




def api_campaign_docs(request):
    """
    GM endpoint — returns list of campaign docs from data/campaign/docs/.
    GET: Returns [{slug, title}] sorted by filename.
    """

    loader = get_loader()
    docs = loader.load_campaign_docs()
    return JsonResponse({'docs': docs})




def api_campaign_doc(request, slug):
    """
    GM endpoint — returns a single campaign doc by slug.
    GET: Returns {slug, title, content} (markdown body, frontmatter stripped).
    """

    loader = get_loader()
    doc = loader.load_campaign_doc(slug)
    if doc is None:
        return JsonResponse({'error': 'Not found'}, status=404)
    return JsonResponse(doc)
