# terminal/active_view_store.py
import copy
import json
import os
import sys
import tempfile
import threading
from pathlib import Path

_lock = threading.Lock()

_DEFAULT_STATE: dict = {
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
    # migration.
    'encounter_door_status': {},
    'encounter_tokens_by_location': {},
    'encounter_active_portraits': [],
}

# State persists to disk so it survives gunicorn worker recycles
# (max_requests in docker/gunicorn.conf.py) and container restarts.
_BASE_DIR = Path(__file__).resolve().parent.parent
_STATE_PATH = Path(os.environ.get('JANUS_STATE_PATH', _BASE_DIR / 'var' / 'active_view.json'))


def _load_from_disk() -> dict:
    state = copy.deepcopy(_DEFAULT_STATE)
    try:
        with _STATE_PATH.open('r', encoding='utf-8') as f:
            stored = json.load(f)
        if isinstance(stored, dict):
            # Merge stored values over defaults so newly-added keys still get
            # their default when the on-disk file predates them.
            for key in _DEFAULT_STATE:
                if key in stored:
                    state[key] = stored[key]
    except FileNotFoundError:
        pass
    except (OSError, ValueError) as exc:
        print(f'active_view_store: failed to load {_STATE_PATH}: {exc}', file=sys.stderr)
    return state


def _write_to_disk(state: dict) -> None:
    try:
        _STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        # Atomic write: tmp file in the same dir, then rename.
        fd, tmp_path = tempfile.mkstemp(
            prefix='.active_view.', suffix='.json', dir=str(_STATE_PATH.parent)
        )
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                json.dump(state, f, default=str)
            os.replace(tmp_path, _STATE_PATH)
        except Exception:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise
    except OSError as exc:
        print(f'active_view_store: failed to persist {_STATE_PATH}: {exc}', file=sys.stderr)


_state: dict = _load_from_disk()


def get_state() -> dict:
    with _lock:
        return copy.deepcopy(_state)


def update_state(**kwargs) -> dict:
    with _lock:
        _state.update(kwargs)
        snapshot = dict(_state)
        _write_to_disk(snapshot)
        return snapshot
