# terminal/active_view_store.py
import copy
import threading

_lock = threading.Lock()

_state: dict = {
    'view_type': 'STANDBY',
    'location_slug': '',
    'view_slug': '',
    'bridge_tab': '',
    'bridge_map_mode': 'galaxy',
    'bridge_label': '',
    'overlay_location_slug': '',
    'overlay_terminal_slug': '',
    'overlay_doc_slug': '',
    'janus_mode': 'DISPLAY',
    'janus_location_path': '',
    'janus_dialog_open': False,
    'janus_active_channel': 'story',
    'encounter_level': 1,
    'encounter_deck_id': '',
    'encounter_room_visibility': {},
    # Phase 21 plan 21-04: door id format is canonical `Door.id`, derived by
    # `doorNormalizer` from the authored YAML's explicit `id:` field. The
    # YAML migration preserved the legacy `${room.id}_door_${index}` form so
    # any pre-21-04 in-memory entries continue to resolve without explicit
    # migration. Door status is in-process only (no DB persistence after the
    # ActiveView model deletion in migration 0017), so a fresh process starts
    # empty regardless.
    'encounter_door_status': {},
    'encounter_tokens_by_location': {},
    'encounter_active_portraits': [],
}


def get_state() -> dict:
    with _lock:
        return copy.deepcopy(_state)


def update_state(**kwargs) -> dict:
    with _lock:
        _state.update(kwargs)
        return dict(_state)
