from django.http import JsonResponse, FileResponse, Http404
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from core.models import Message
import json
import logging
import yaml
import os
import mimetypes
import pathlib
from django.conf import settings
from core.data_loader import get_loader
from core.active_view_store import get_state
from core.sse_broadcaster import broadcaster, format_sse
from .active_view import sync_state

logger = logging.getLogger(__name__)


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
def api_personnel(request):
    """
    Player endpoint — returns crew and only the NPCs the players have met.
    An NPC is "met" when its YAML has `met: true`; absent/false stays hidden.
    GET: Returns { crew: [...], npcs: [...] }
    """
    loader = get_loader()
    crew = loader.load_crew()
    npcs = [npc for npc in loader.load_npcs() if npc.get('met') is True]
    return JsonResponse({'crew': crew, 'npcs': npcs})


@csrf_exempt
@login_required
def api_gm_toggle_npc_met(request):
    """
    GM endpoint — mark whether the players have met an NPC.

    POST /api/gm/npc/toggle-met/  body: { npc_id, met? }
    When `met` is omitted the current value is flipped. Persists the `met`
    field into the NPC's YAML file and broadcasts a data-changed event so
    connected player terminals refresh their Personnel section.

    Returns: 200 { npc_id, met } · 400 invalid · 404 unknown npc · 405 non-POST
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        body = json.loads(request.body or '{}')
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)

    npc_id = str(body.get('npc_id', '')).strip()
    # Reject path traversal — npc_id is used to build a filename
    if not npc_id or any(c in npc_id for c in ('/', '\\', '..')):
        return JsonResponse({'error': 'Invalid npc_id'}, status=400)

    npc_path = pathlib.Path(settings.DATA_DIR) / 'campaign' / 'npcs' / f'{npc_id}.yaml'
    if not npc_path.is_file():
        return JsonResponse({'error': f'NPC not found: {npc_id}'}, status=404)

    try:
        with open(npc_path) as f:
            data = yaml.safe_load(f) or {}
    except (OSError, yaml.YAMLError) as e:
        return JsonResponse({'error': f'Could not read NPC file: {e}'}, status=400)

    requested = body.get('met')
    if requested is None:
        new_met = not bool(data.get('met'))
    else:
        new_met = requested if isinstance(requested, bool) else str(requested).lower() in ('true', '1', 'yes')

    data['met'] = new_met
    try:
        with open(npc_path, 'w') as f:
            yaml.safe_dump(data, f, sort_keys=False, allow_unicode=True)
    except OSError as e:
        return JsonResponse({'error': f'Could not write NPC file: {e}'}, status=500)

    try:
        broadcaster.announce_generic('data-changed', {
            'path': f'campaign/npcs/{npc_id}.yaml', 'action': 'npc-met', 'met': new_met,
        })
    except Exception as e:
        logger.warning('SSE broadcast failed after npc-met toggle: %s', e)

    return JsonResponse({'npc_id': npc_id, 'met': new_met})




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


_ALLOWED_IMAGE_EXTS = frozenset({'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'})


def serve_data_file(request, filepath):
    """Serve image files from the data directory at /data/<filepath>."""
    suffix = pathlib.Path(filepath).suffix.lower()
    if suffix not in _ALLOWED_IMAGE_EXTS:
        raise Http404
    loader = get_loader()
    full_path = (loader.data_dir / filepath).resolve()
    if not str(full_path).startswith(str(loader.data_dir.resolve())):
        raise Http404
    if not full_path.exists():
        raise Http404
    content_type, _ = mimetypes.guess_type(str(full_path))
    return FileResponse(open(full_path, 'rb'), content_type=content_type or 'application/octet-stream')
