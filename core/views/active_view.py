from django.http import JsonResponse, StreamingHttpResponse
import queue as queue_module
import json
from pathlib import Path
from django.conf import settings
from core.active_view_store import get_state, update_state
from core.sse_broadcaster import broadcaster, format_sse
from core.data_loader import get_loader


def build_active_view_payload(state: dict) -> dict:
    """Build the enriched active-view response dict from raw in-memory state."""

    response = {
        'location_slug': state.get('location_slug', ''),
        'view_type': state.get('view_type', 'STANDBY'),
        'view_slug': state.get('view_slug', ''),
        'bridge_tab': state.get('bridge_tab', ''),
        'bridge_map_mode': state.get('bridge_map_mode', 'galaxy'),
        'bridge_label': state.get('bridge_label', ''),
        'overlay_location_slug': state.get('overlay_location_slug', ''),
        'overlay_terminal_slug': state.get('overlay_terminal_slug', ''),
        'overlay_doc_slug': state.get('overlay_doc_slug', ''),
        'janus_mode': state.get('janus_mode', 'DISPLAY'),
        'janus_location_path': state.get('janus_location_path', ''),
        'janus_dialog_open': state.get('janus_dialog_open', False),
        'janus_active_channel': state.get('janus_active_channel', 'story'),
        'encounter_level': state.get('encounter_level', 1),
        'encounter_deck_id': state.get('encounter_deck_id', ''),
        'encounter_room_visibility': state.get('encounter_room_visibility', {}),
        'encounter_door_status': state.get('encounter_door_status', {}),
        'encounter_tokens': state.get('encounter_tokens_by_location', {}).get(state.get('location_slug', ''), {}),
        'encounter_active_portraits': list(state.get('encounter_active_portraits', [])),
    }

    # Always include NPC data (portrait overlay needs it without a second request)
    loader_for_npcs = get_loader()
    npcs = loader_for_npcs.load_npcs()
    response['encounter_npc_data'] = {
        npc['id']: {'id': npc['id'], 'name': npc['name'], 'portrait': npc.get('portrait', '')}
        for npc in npcs
        if npc.get('id')
    }

    # ENCOUNTER view: include location metadata and multi-deck map data
    if state.get('view_type') == 'ENCOUNTER' and state.get('location_slug'):
        loader = get_loader()
        location = loader.find_location_by_slug(state['location_slug'])
        if location:
            response['location_type'] = location.get('type', 'unknown')
            response['location_name'] = location.get('name', '')
            response['location_data'] = location
            location_path = loader.get_location_path(state['location_slug'])
            if location_path:
                response['location_path'] = location_path
                if len(location_path) >= 1:
                    response['location_data']['system_slug'] = location_path[0]
                if len(location_path) >= 2:
                    response['location_data']['parent_slug'] = location_path[1]

            # For multi-deck maps, load the current deck's map data
            if location.get('directory'):
                location_dir = Path(location['directory'])
                deckplan = loader.load_deckplan(location_dir)
                if deckplan and deckplan.get('decks'):
                    decks = deckplan['decks']
                    response['encounter_total_decks'] = deckplan['total_decks']
                    # Get current deck ID (or use default)
                    current_deck_id = state.get('encounter_deck_id', '')
                    if not current_deck_id:
                        # Find default deck or use first deck
                        default_deck = next(
                            (d for d in decks if d.get('default')),
                            decks[0] if decks else None
                        )
                        if default_deck:
                            current_deck_id = default_deck.get('id', '')

                    # Build manifest-compatible structure for the frontend
                    manifest = {
                        'name': deckplan.get('name', location.get('name', '')),
                        'facility_type': deckplan.get('facility_type', location.get('type', '')),
                        'total_decks': deckplan['total_decks'],
                        'decks': [
                            {'id': d['id'], 'name': d.get('name', d['id']),
                             'level': d.get('level', 1), 'default': d.get('default', False)}
                            for d in decks
                        ],
                        'hull': deckplan.get('hull'),
                    }

                    if current_deck_id:
                        # Find deck data inline from deckplan (rooms already loaded)
                        current_deck = next(
                            (d for d in decks if d.get('id') == current_deck_id), None
                        )
                        if current_deck:
                            response['location_data']['map'] = {
                                'is_multi_deck': True,
                                'manifest': manifest,
                                'current_deck': current_deck,
                                'current_deck_id': current_deck_id,
                            }
                            response['encounter_deck_name'] = current_deck.get('name', '')

    # Always include ship deck map data so GM console can render it regardless of player view
    loader = get_loader()
    ship_dir = loader.data_dir / "campaign" / "ship"
    if ship_dir.exists():
        deckplan = loader.load_deckplan(ship_dir)
        if deckplan and deckplan.get('decks'):
            decks = deckplan['decks']
            # Find default deck or use first
            default_deck = next(
                (d for d in decks if d.get('default')),
                decks[0] if decks else None
            )
            if default_deck:
                # Build MultiDeckMapData shape expected by EncounterMapDisplay
                manifest = {
                    'name': 'USCSS Morrigan',
                    'facility_type': 'ship',
                    'total_decks': deckplan['total_decks'],
                    'decks': [
                        {'id': d['id'], 'name': d['name'], 'level': d.get('level', 1),
                         'default': d.get('default', False)}
                        for d in decks
                    ],
                    'hull': deckplan.get('hull'),
                }
                current_deck = {**default_deck, 'deck_id': default_deck['id']}
                response['ship_deck_data'] = {
                    'is_multi_deck': True,
                    'manifest': manifest,
                    'current_deck': current_deck,
                    'current_deck_id': default_deck['id'],
                    'slug': 'deckplan',
                }
                response['ship_deck_total_decks'] = deckplan['total_decks']

    return response




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


