# terminal/active_view_store.py
import threading

_lock = threading.Lock()

_state: dict = {
    'view_type': 'STANDBY',
    'location_slug': '',
    'view_slug': '',
    'overlay_location_slug': '',
    'overlay_terminal_slug': '',
    'charon_mode': 'DISPLAY',
    'charon_location_path': '',
    'charon_dialog_open': False,
    'charon_active_channel': 'story',
    'encounter_level': 1,
    'encounter_deck_id': '',
    'encounter_room_visibility': {},
    'encounter_door_status': {},
    'encounter_tokens': {},
    'encounter_active_portraits': [],
    'ship_system_overrides': {},
}


def get_state() -> dict:
    with _lock:
        return dict(_state)


def update_state(**kwargs) -> dict:
    with _lock:
        _state.update(kwargs)
        return dict(_state)
