"""
PayloadBuilder — builds the enriched SSE payload from raw active-view state.

Separates stable data (NPCs, ship deckplan) from live state (token positions,
door status, room visibility). Stable data is cached with a 30-second TTL so
high-frequency mutations (token drag, door changes) don't hit disk on every
broadcast.
"""

import time
from pathlib import Path
from typing import Any
from core.encounter_utils import normalize_deck_poi

_NPC_TTL = 30.0
_SHIP_DECK_TTL = 30.0


class PayloadBuilder:
    def __init__(self, loader):
        self._loader = loader
        self._npc_cache: list | None = None
        self._npc_cache_at: float = 0.0
        self._ship_deck_cache: dict | None = None
        self._ship_deck_cache_at: float = 0.0

    def _get_npcs(self) -> list:
        now = time.monotonic()
        if self._npc_cache is None or now - self._npc_cache_at > _NPC_TTL:
            self._npc_cache = self._loader.load_npcs()
            self._npc_cache_at = now
        return self._npc_cache

    def _get_ship_deck(self) -> dict | None:
        now = time.monotonic()
        if self._ship_deck_cache is None or now - self._ship_deck_cache_at > _SHIP_DECK_TTL:
            self._ship_deck_cache = self._load_ship_deck()
            self._ship_deck_cache_at = now
        return self._ship_deck_cache

    def _load_ship_deck(self) -> dict | None:
        ship_dir = self._loader.data_dir / "campaign" / "ship"
        if not ship_dir.exists():
            return None
        deckplan = self._loader.load_deckplan(ship_dir)
        if not deckplan or not deckplan.get('decks'):
            return None
        decks = deckplan['decks']
        default_deck = next((d for d in decks if d.get('default')), decks[0] if decks else None)
        if not default_deck:
            return None
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
        return {
            'ship_deck_data': {
                'is_multi_deck': True,
                'manifest': manifest,
                'current_deck': normalize_deck_poi({**default_deck, 'deck_id': default_deck['id']}),
                'current_deck_id': default_deck['id'],
                'slug': 'deckplan',
            },
            'ship_deck_total_decks': deckplan['total_decks'],
        }

    def build(self, state: dict) -> dict:
        response: dict[str, Any] = {
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
            'encounter_vents_visible': state.get('encounter_vents_visible', False),
            'encounter_tokens': (
                state.get('encounter_tokens_by_location', {})
                .get(state.get('location_slug', ''), {})
            ),
            'encounter_active_portraits': list(state.get('encounter_active_portraits', [])),
        }

        npcs = self._get_npcs()
        response['encounter_npc_data'] = {
            npc['id']: {
                'id': npc['id'],
                'name': npc['name'],
                'portrait': npc.get('portrait', ''),
                'met': npc.get('met') is True,
            }
            for npc in npcs
            if npc.get('id')
        }

        if state.get('view_type') == 'ENCOUNTER' and state.get('location_slug'):
            self._add_encounter_location(response, state)

        ship_deck = self._get_ship_deck()
        if ship_deck:
            response.update(ship_deck)

        return response

    def _add_encounter_location(self, response: dict, state: dict) -> None:
        location = self._loader.find_location_by_slug(state['location_slug'])
        if not location:
            return
        response['location_type'] = location.get('type', 'unknown')
        response['location_name'] = location.get('name', '')
        response['location_data'] = location
        location_path = self._loader.get_location_path(state['location_slug'])
        if location_path:
            response['location_path'] = location_path
            if len(location_path) >= 1:
                response['location_data']['system_slug'] = location_path[0]
            if len(location_path) >= 2:
                response['location_data']['parent_slug'] = location_path[1]

        if not location.get('directory'):
            return
        location_dir = Path(location['directory'])
        deckplan = self._loader.load_deckplan(location_dir)
        if not deckplan or not deckplan.get('decks'):
            return
        decks = deckplan['decks']
        response['encounter_total_decks'] = deckplan['total_decks']
        current_deck_id = state.get('encounter_deck_id', '')
        if not current_deck_id:
            default_deck = next((d for d in decks if d.get('default')), decks[0] if decks else None)
            if default_deck:
                current_deck_id = default_deck.get('id', '')
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
        if not current_deck_id:
            return
        current_deck = next((d for d in decks if d.get('id') == current_deck_id), None)
        if current_deck:
            response['location_data']['map'] = {
                'is_multi_deck': True,
                'manifest': manifest,
                'current_deck': normalize_deck_poi(current_deck),
                'current_deck_id': current_deck_id,
            }
            response['encounter_deck_name'] = current_deck.get('name', '')

    def invalidate_stable_cache(self) -> None:
        """Force re-read of NPCs and ship deckplan on the next broadcast."""
        self._npc_cache = None
        self._ship_deck_cache = None
