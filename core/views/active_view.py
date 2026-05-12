from django.http import JsonResponse, StreamingHttpResponse
import queue as queue_module
import json
from django.conf import settings
from core.active_view_store import get_state, update_state
from core.sse_broadcaster import broadcaster, format_sse
from core.data_loader import get_loader

_builder = None


def _get_builder():
    global _builder
    if _builder is None:
        from core.payload_builder import PayloadBuilder
        _builder = PayloadBuilder(get_loader())
    return _builder


def build_active_view_payload(state: dict) -> dict:
    """Build the enriched active-view response dict from raw in-memory state."""
    return _get_builder().build(state)




def sync_state(**kwargs) -> dict:
    """Update active view state and broadcast the enriched payload to all SSE clients."""
    new_state = update_state(**kwargs)
    payload = build_active_view_payload(new_state)
    broadcaster.announce(payload)
    return new_state




def api_active_view_stream(request):
    """
    SSE endpoint — streams ActiveView state changes to all connected clients.
    Public endpoint — no login required (same pattern as /api/active-view/).
    """
    def event_stream():
        # Send full current state immediately on connect so client is in sync
        initial_payload = build_active_view_payload(get_state())
        yield format_sse(json.dumps(initial_payload, default=str), event='activeview')

        q = broadcaster.listen()
        try:
            while True:
                try:
                    msg = q.get(timeout=30)
                    yield msg
                except queue_module.Empty:
                    yield ': keepalive\n\n'
        finally:
            broadcaster.unlisten(q)

    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response




def get_active_view_json(request):
    """
    API endpoint to get the current active view state.
    Used by the display terminal to detect when GM changes the view.
    Public endpoint - no login required.
    """
    return JsonResponse(build_active_view_payload(get_state()))


