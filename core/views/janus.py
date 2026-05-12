from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
import json
from core.data_loader import get_loader
from core.active_view_store import get_state
from core.janus_session import JanusSessionManager, JanusMessage
from core.janus_ai import get_janus_ai
from .active_view import sync_state


def get_janus_location_path(active_view) -> str:
    """
    Derive JANUS's location context from the active view.

    Priority:
    1. If in ENCOUNTER view with a location, derive path from location_slug
    2. Fall back to explicitly set janus_location_path
    3. Return None if no location context available

    Accepts either a dict (from get_state()) or an ORM object.

    Returns:
        Location path string like "sol/earth/uscss_morrigan" or None
    """

    # Support both dict and ORM object
    if isinstance(active_view, dict):
        view_type = active_view.get('view_type', '')
        location_slug = active_view.get('location_slug', '')
        janus_location_path = active_view.get('janus_location_path', '')
    else:
        view_type = active_view.view_type
        location_slug = active_view.location_slug
        janus_location_path = active_view.janus_location_path

    # If in ENCOUNTER view, derive from encounter location
    if view_type == 'ENCOUNTER' and location_slug:
        loader = get_loader()
        path_slugs = loader.get_location_path(location_slug)
        if path_slugs:
            return '/'.join(path_slugs)

    # Fall back to explicitly set JANUS location
    if janus_location_path:
        return janus_location_path

    return None




def api_janus_conversation(request):
    """
    Get current JANUS conversation (public for terminal display).
    GET: Returns conversation messages and mode.
    """

    active_view = get_state()
    conversation = JanusSessionManager.get_conversation()

    # Get the derived location path (from encounter or explicit setting)
    derived_location_path = get_janus_location_path(active_view)

    return JsonResponse({
        'mode': active_view.get('janus_mode', 'DISPLAY'),
        'janus_location_path': active_view.get('janus_location_path') or '',
        'active_location_path': derived_location_path or '',  # What JANUS is actually using
        'messages': conversation,
    })




@csrf_exempt
def api_janus_submit_query(request):
    """
    Player submits query to JANUS (only works in Query mode).
    POST: { query: string }
    Public endpoint - players submit queries from shared terminal.
    CSRF exempt since this is called from unauthenticated player terminals.
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    # Check if in query mode
    active_view = get_state()
    if active_view.get('janus_mode') != 'QUERY':
        return JsonResponse({'error': 'Terminal not in query mode'}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    query = data.get('query', '').strip()
    if not query:
        return JsonResponse({'error': 'Query required'}, status=400)

    # Add player query to conversation
    query_msg = JanusMessage(role='user', content=query)
    JanusSessionManager.add_message(query_msg)

    # Generate AI response with location-specific knowledge
    # Derive location from encounter view or fall back to explicit setting
    location_path = get_janus_location_path(active_view)
    ai = get_janus_ai(location_path=location_path)
    conversation = JanusSessionManager.get_conversation()
    response = ai.generate_response(query, conversation)

    # Queue for GM approval
    pending_id = JanusSessionManager.add_pending_response(
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
def api_janus_switch_mode(request):
    """
    Switch JANUS terminal mode (Display/Query).
    POST: { mode: 'DISPLAY' | 'QUERY' }
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    mode = data.get('mode', 'DISPLAY')
    if mode not in ('DISPLAY', 'QUERY'):
        return JsonResponse({'error': 'Invalid mode. Must be DISPLAY or QUERY'}, status=400)

    new_state = sync_state(janus_mode=mode)

    return JsonResponse({'success': True, 'mode': mode})




@login_required
def api_janus_set_location(request):
    """
    Set the active JANUS instance location.
    POST: { location_path: string }
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    location_path = data.get('location_path', '')

    new_state = sync_state(janus_location_path=location_path)

    return JsonResponse({'success': True, 'location_path': location_path})




@login_required
def api_janus_send_message(request):
    """
    GM sends message directly to JANUS terminal.
    POST: { content: string }
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    content = data.get('content', '').strip()
    if not content:
        return JsonResponse({'error': 'Content required'}, status=400)

    msg = JanusMessage(role='janus', content=content)
    JanusSessionManager.add_message(msg)

    return JsonResponse({'success': True, 'message_id': msg.message_id})




@login_required
def api_janus_generate(request):
    """
    GM prompts AI to generate a JANUS response for review.
    POST: { prompt: string }
    Returns a pending response for GM approval.
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    prompt = data.get('prompt', '').strip()
    if not prompt:
        return JsonResponse({'error': 'Prompt required'}, status=400)

    # Get active JANUS location for knowledge context
    # Derive location from encounter view or fall back to explicit setting
    active_view = get_state()
    location_path = get_janus_location_path(active_view)

    # Generate AI response based on GM's prompt with location knowledge
    ai = get_janus_ai(location_path=location_path)
    conversation = JanusSessionManager.get_conversation()

    # Create a context message for the AI that includes the GM's prompt
    context_prompt = f"[GM CONTEXT: {prompt}]\n\nGenerate a JANUS response based on this context."
    response = ai.generate_response(context_prompt, conversation)

    # Queue for GM approval (using prompt as the "query" for reference)
    import uuid
    pending_id = JanusSessionManager.add_pending_response(
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
def api_janus_pending(request):
    """
    GM gets list of pending AI responses for approval.
    GET: Returns list of pending responses.
    """

    pending = JanusSessionManager.get_pending_responses()
    return JsonResponse({'pending': pending})




@login_required
def api_janus_approve(request):
    """
    GM approves a pending response.
    POST: { pending_id: string, modified_content?: string }
    """

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
    success = JanusSessionManager.approve_response(pending_id, modified)

    if success:
        return JsonResponse({'success': True})
    else:
        return JsonResponse({'error': 'Pending response not found'}, status=404)




@login_required
def api_janus_reject(request):
    """
    GM rejects a pending response.
    POST: { pending_id: string }
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    pending_id = data.get('pending_id')
    if not pending_id:
        return JsonResponse({'error': 'pending_id required'}, status=400)

    success = JanusSessionManager.reject_response(pending_id)

    if success:
        return JsonResponse({'success': True})
    else:
        return JsonResponse({'error': 'Pending response not found'}, status=404)




@login_required
def api_janus_clear(request):
    """
    GM clears the JANUS conversation.
    POST: {}
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    JanusSessionManager.clear_conversation()
    return JsonResponse({'success': True})




@csrf_exempt
def api_janus_toggle_dialog(request):
    """
    Toggle the JANUS dialog overlay visibility.
    POST: { open?: boolean }
    If open is not specified, toggles the current state.
    Public endpoint - players can open/close dialog from shared terminal.
    CSRF exempt since this is called from unauthenticated player terminals.
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        data = {}

    current = get_state()

    # If 'open' is specified, set to that value; otherwise toggle
    if 'open' in data:
        new_dialog_open = bool(data['open'])
    else:
        new_dialog_open = not current.get('janus_dialog_open', False)

    new_state = sync_state(janus_dialog_open=new_dialog_open)

    return JsonResponse({
        'success': True,
        'janus_dialog_open': new_state['janus_dialog_open']
    })


# ==================== Encounter Map API Endpoints ====================



@login_required
def api_janus_channels(request):
    """
    Get list of all active JANUS channels with message counts and unread indicators.
    GET: Returns list of channels with metadata.
    """
    
    channels = JanusSessionManager.get_all_channels()
    channel_data = []
    
    for channel in channels:
        conversation = JanusSessionManager.get_conversation(channel)
        last_read = JanusSessionManager.get_last_read(channel)
        last_read_id = last_read['message_id'] if last_read else None
        unread_count = JanusSessionManager.get_unread_count(channel, last_read_id)
        
        channel_data.append({
            'channel': channel,
            'message_count': len(conversation),
            'unread_count': unread_count,
            'last_message': conversation[-1] if conversation else None,
        })
    
    return JsonResponse({'channels': channel_data})




@csrf_exempt
def api_janus_channel_conversation(request, channel):
    """
    Get conversation for a specific channel (public for player terminals).
    GET: Returns conversation messages for the channel.
    """
    
    conversation = JanusSessionManager.get_conversation(channel)
    active_view = get_state()
    
    mode = active_view.get('janus_mode', 'DISPLAY')

    return JsonResponse({
        'channel': channel,
        'mode': mode,
        'messages': conversation,
    })




@csrf_exempt
def api_janus_channel_submit(request, channel):
    """
    Player submits query to a specific JANUS channel.
    POST: { query: string }
    Public endpoint - players submit queries from terminals.
    """
    
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
    query_msg = JanusMessage(role='user', content=query)
    JanusSessionManager.add_message(query_msg, channel)
    
    # Generate AI response
    active_view = get_state()
    location_path = get_janus_location_path(active_view)
    ai = get_janus_ai(location_path=location_path)
    conversation = JanusSessionManager.get_conversation(channel)
    response = ai.generate_response(query, conversation)
    
    # Queue for GM approval
    pending_id = JanusSessionManager.add_pending_response(
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
def api_janus_channel_send(request, channel):
    """
    GM sends message to a specific JANUS channel.
    POST: { content: string }
    """
    
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    
    content = data.get('content', '').strip()
    if not content:
        return JsonResponse({'error': 'Content required'}, status=400)
    
    msg = JanusMessage(role='janus', content=content)
    JanusSessionManager.add_message(msg, channel)
    
    return JsonResponse({
        'success': True,
        'message_id': msg.message_id,
        'channel': channel,
    })




@login_required
def api_janus_channel_mark_read(request, channel):
    """
    Mark all messages in a channel as read by GM.
    POST: No body required.
    """
    
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    JanusSessionManager.mark_channel_read(channel, request.user.id)
    
    return JsonResponse({'success': True, 'channel': channel})




@login_required
def api_janus_channel_pending(request, channel):
    """
    Get pending AI responses for a specific channel.
    GET: Returns pending responses awaiting GM approval.
    """
    
    pending = JanusSessionManager.get_pending_responses(channel)
    
    return JsonResponse({
        'channel': channel,
        'pending': pending,
        'count': len(pending),
    })




@login_required
def api_janus_channel_approve(request, channel):
    """
    Approve a pending AI response for a specific channel.
    POST: { pending_id: string, modified_content?: string }
    """
    
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
    
    success = JanusSessionManager.approve_response(pending_id, modified_content, channel)
    
    if success:
        return JsonResponse({'success': True, 'channel': channel})
    else:
        return JsonResponse({'error': 'Pending response not found'}, status=404)




@login_required
def api_janus_channel_reject(request, channel):
    """
    Reject a pending AI response for a specific channel.
    POST: { pending_id: string }
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    pending_id = data.get('pending_id')

    if not pending_id:
        return JsonResponse({'error': 'pending_id required'}, status=400)

    success = JanusSessionManager.reject_response(pending_id, channel)

    if success:
        return JsonResponse({'success': True, 'channel': channel})
    else:
        return JsonResponse({'error': 'Pending response not found'}, status=404)




@login_required
def api_janus_channel_generate(request, channel):
    """
    GM prompts AI to generate a JANUS response for a specific channel.
    POST: { prompt: string, context_override?: string }
    Returns a pending response for GM approval.
    """

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
        loader = get_loader()
        path_slugs = loader.get_location_path(location_slug)
        if path_slugs:
            location_path = '/'.join(path_slugs)

    # Generate AI response with location context
    ai = get_janus_ai(location_path=location_path)
    conversation = JanusSessionManager.get_conversation(channel)

    # Build context prompt
    context_parts = [f"[GM PROMPT: {prompt}]"]
    if context_override:
        context_parts.append(f"[GM CONTEXT OVERRIDE: {context_override}]")
    context_parts.append("\n\nGenerate a JANUS response based on this context.")
    context_prompt = "\n".join(context_parts)

    response = ai.generate_response(context_prompt, conversation)

    # Queue for GM approval
    import uuid
    pending_id = JanusSessionManager.add_pending_response(
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
def api_janus_channel_clear(request, channel):
    """
    GM clears conversation for a specific channel.
    POST: {}
    """

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    JanusSessionManager.clear_conversation(channel)
    return JsonResponse({'success': True, 'channel': channel})


