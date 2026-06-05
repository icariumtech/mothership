"""
Encounter state mutations — domain-level operations on in-memory encounter state.

Each function applies one atomic encounter state change and broadcasts the
updated payload to all SSE clients. Views delegate here instead of repeating
the get → copy → mutate → sync_state pattern inline.
"""

from core.active_view_store import get_state


def _sync(*args, **kwargs) -> dict:
    from core.views.active_view import sync_state
    return sync_state(**kwargs)


# ---------------------------------------------------------------------------
# Level / deck
# ---------------------------------------------------------------------------

def switch_level(level: int, deck_id: str) -> dict:
    return _sync(encounter_level=level, encounter_deck_id=deck_id)


# ---------------------------------------------------------------------------
# Room visibility
# ---------------------------------------------------------------------------

def toggle_room(room_id: str, visible: bool | None = None) -> tuple[bool, dict]:
    """Toggle or set a single room's visibility. Returns (new_visible, new_state)."""
    current = get_state()
    visibility = dict(current.get('encounter_room_visibility') or {})
    new_visible = (not visibility.get(room_id, True)) if visible is None else bool(visible)
    visibility[room_id] = new_visible
    new_state = _sync(encounter_room_visibility=visibility)
    return new_visible, new_state


def set_room_visibility(visibility: dict) -> dict:
    return _sync(encounter_room_visibility=visibility)


# ---------------------------------------------------------------------------
# Doors
# ---------------------------------------------------------------------------

VALID_DOOR_STATUSES = {'OPEN', 'CLOSED', 'LOCKED', 'SEALED', 'DAMAGED'}


def set_door_status(connection_id: str, door_status: str) -> dict:
    """Set a door's runtime status. Raises ValueError for unrecognized statuses."""
    if door_status not in VALID_DOOR_STATUSES:
        raise ValueError(
            f"Invalid door_status '{door_status}'. Must be one of: {', '.join(sorted(VALID_DOOR_STATUSES))}"
        )
    current = get_state()
    door_states = dict(current.get('encounter_door_status') or {})
    door_states[connection_id] = door_status
    return _sync(encounter_door_status=door_states)


# ---------------------------------------------------------------------------
# Vent visibility
# ---------------------------------------------------------------------------

def set_vents_visible(visible: bool) -> dict:
    """Show or hide all vents for players."""
    return _sync(encounter_vents_visible=bool(visible))


# ---------------------------------------------------------------------------
# Tokens
# ---------------------------------------------------------------------------

def _get_tokens(slug: str) -> tuple[dict, dict]:
    """Return (tokens_by_loc, tokens) for the current location."""
    current = get_state()
    tokens_by_loc = dict(current.get('encounter_tokens_by_location') or {})
    tokens = dict(tokens_by_loc.get(slug) or {})
    return tokens_by_loc, tokens


def place_token(slug: str, token_id: str, token_data: dict) -> dict:
    """Store a new token. Returns the updated tokens dict for this location."""
    tokens_by_loc, tokens = _get_tokens(slug)
    tokens[token_id] = token_data
    tokens_by_loc[slug] = tokens
    _sync(encounter_tokens_by_location=tokens_by_loc)
    return tokens


def move_token(slug: str, token_id: str, x: int, y: int, room_id: str) -> dict:
    """Move an existing token. Raises KeyError if token not found."""
    tokens_by_loc, tokens = _get_tokens(slug)
    if token_id not in tokens:
        raise KeyError(token_id)
    tokens[token_id] = {**tokens[token_id], 'x': x, 'y': y, 'room_id': room_id}
    tokens_by_loc[slug] = tokens
    _sync(encounter_tokens_by_location=tokens_by_loc)
    return tokens


def remove_token(slug: str, token_id: str) -> dict:
    """Remove a token. Raises KeyError if token not found."""
    tokens_by_loc, tokens = _get_tokens(slug)
    if token_id not in tokens:
        raise KeyError(token_id)
    del tokens[token_id]
    tokens_by_loc[slug] = tokens
    _sync(encounter_tokens_by_location=tokens_by_loc)
    return tokens


def update_token_status(slug: str, token_id: str, status: list) -> dict:
    """Update a token's status list. Raises KeyError if token not found."""
    tokens_by_loc, tokens = _get_tokens(slug)
    if token_id not in tokens:
        raise KeyError(token_id)
    tokens[token_id] = {**tokens[token_id], 'status': status}
    tokens_by_loc[slug] = tokens
    _sync(encounter_tokens_by_location=tokens_by_loc)
    return tokens


def clear_tokens(slug: str) -> dict:
    """Remove all tokens for this location. Returns empty dict."""
    current = get_state()
    tokens_by_loc = dict(current.get('encounter_tokens_by_location') or {})
    tokens_by_loc[slug] = {}
    _sync(encounter_tokens_by_location=tokens_by_loc)
    return {}


# ---------------------------------------------------------------------------
# Portraits
# ---------------------------------------------------------------------------

def toggle_portrait(npc_id: str) -> list:
    """Add or remove an NPC portrait from the active portrait overlay."""
    current = get_state()
    portraits = list(current.get('encounter_active_portraits') or [])
    if npc_id in portraits:
        portraits.remove(npc_id)
    else:
        portraits.append(npc_id)
    _sync(encounter_active_portraits=portraits)
    return portraits
