"""
Shared test isolation for the active-view state singleton.

`active_view_store` persists to a module-level `_state` dict and a
`_STATE_PATH` file computed once at import time (see JANUS_STATE_PATH in
active_view_store.py). Tests that call `update_state`/`sync_state` must not
write to the real `var/active_view.json` used by the dev server, and must not
leak mutated state into other tests in the same process.
"""
import copy
import tempfile
from pathlib import Path

from core import active_view_store


class IsolatedStateMixin:
    """Point active_view_store at a throwaway file and reset in-memory state
    around each test."""

    def setUp(self):
        super().setUp()
        self._tmpdir = tempfile.TemporaryDirectory()
        self._orig_state_path = active_view_store._STATE_PATH
        self._orig_state = active_view_store._state
        active_view_store._STATE_PATH = Path(self._tmpdir.name) / 'active_view.json'
        active_view_store._state = copy.deepcopy(active_view_store._DEFAULT_STATE)

    def tearDown(self):
        active_view_store._STATE_PATH = self._orig_state_path
        active_view_store._state = self._orig_state
        self._tmpdir.cleanup()
        super().tearDown()
