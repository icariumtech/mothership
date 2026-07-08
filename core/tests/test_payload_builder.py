"""
Tests for core.payload_builder.PayloadBuilder — the SSE payload assembler.

Uses a FakeLoader instead of real campaign data so these tests are fast,
deterministic, and independent of what's currently in data/. Specifically
guards the in-place-mutation trap found during the Tier 2 DataLoader caching
work: PayloadBuilder._add_encounter_location mutates the location dict it's
handed (adding system_slug/parent_slug) — DataLoader.load_all_locations()
must deep-copy on every read because of this, and this suite pins that
mutation's shape so a future change can't silently break the cache contract.
"""
from pathlib import Path
from django.test import TestCase

from core.payload_builder import PayloadBuilder


class FakeLoader:
    """Minimal stand-in for DataLoader exposing only what PayloadBuilder uses."""

    def __init__(self, data_dir: Path, npcs=None, deckplans=None, locations=None, location_paths=None):
        self.data_dir = data_dir
        self._npcs = npcs or []
        self._deckplans = deckplans or {}  # keyed by str(directory)
        self._locations = locations or {}  # keyed by slug
        self._location_paths = location_paths or {}  # keyed by slug

    def load_npcs(self):
        return self._npcs

    def load_deckplan(self, directory: Path):
        return self._deckplans.get(str(directory))

    def find_location_by_slug(self, slug):
        return self._locations.get(slug)

    def get_location_path(self, slug):
        return self._location_paths.get(slug, [])


def _deckplan(deck_id='main_deck', default=True):
    return {
        'name': 'Test Deck',
        'total_decks': 1,
        'hull': None,
        'decks': [
            {
                'id': deck_id,
                'name': 'Main Deck',
                'level': 1,
                'default': default,
                'rooms': [{'id': 'bridge', 'name': 'Bridge', 'rects': [{'x': 0, 'y': 0, 'w': 4, 'h': 4}]}],
                'doors': [],
            }
        ],
    }


class BuildBasicFieldsTests(TestCase):
    def setUp(self):
        self.loader = FakeLoader(data_dir=Path('/nonexistent'))
        self.builder = PayloadBuilder(self.loader)

    def test_build_passes_through_scalar_state_fields(self):
        state = {'view_type': 'MESSAGES', 'location_slug': 'somnus', 'bridge_tab': 'crew'}
        response = self.builder.build(state)
        self.assertEqual(response['view_type'], 'MESSAGES')
        self.assertEqual(response['location_slug'], 'somnus')
        self.assertEqual(response['bridge_tab'], 'crew')

    def test_build_defaults_missing_fields(self):
        response = self.builder.build({})
        self.assertEqual(response['view_type'], 'STANDBY')
        self.assertEqual(response['encounter_level'], 1)
        self.assertEqual(response['encounter_room_visibility'], {})

    def test_build_includes_npc_data_keyed_by_id(self):
        self.loader._npcs = [
            {'id': 'npc_1', 'name': 'Ash', 'portrait': 'ash.png', 'met': True},
            {'id': 'npc_2', 'name': 'Kane', 'met': False},
        ]
        response = self.builder.build({})
        self.assertEqual(response['encounter_npc_data']['npc_1']['name'], 'Ash')
        self.assertTrue(response['encounter_npc_data']['npc_1']['met'])
        self.assertFalse(response['encounter_npc_data']['npc_2']['met'])

    def test_build_skips_npcs_without_id(self):
        self.loader._npcs = [{'name': 'No ID'}]
        response = self.builder.build({})
        self.assertEqual(response['encounter_npc_data'], {})


class EncounterLocationTests(TestCase):
    def setUp(self):
        self.loader = FakeLoader(data_dir=Path('/nonexistent'))
        self.builder = PayloadBuilder(self.loader)

    def test_non_encounter_view_skips_location_data(self):
        response = self.builder.build({'view_type': 'STANDBY', 'location_slug': 'somnus'})
        self.assertNotIn('location_data', response)

    def test_encounter_view_without_location_found_skips_location_data(self):
        response = self.builder.build({'view_type': 'ENCOUNTER', 'location_slug': 'missing'})
        self.assertNotIn('location_data', response)

    def test_encounter_view_adds_location_type_and_name(self):
        self.loader._locations['somnus'] = {'type': 'ship', 'name': 'USCSS Somnus', 'directory': None}
        response = self.builder.build({'view_type': 'ENCOUNTER', 'location_slug': 'somnus'})
        self.assertEqual(response['location_type'], 'ship')
        self.assertEqual(response['location_name'], 'USCSS Somnus')

    def test_location_path_annotates_system_and_parent_slug(self):
        """Regression: _add_encounter_location mutates the location dict in place
        with system_slug/parent_slug — this is the exact mutation that forces
        DataLoader.load_all_locations() to deep-copy on every read."""
        self.loader._locations['somnus'] = {'type': 'ship', 'name': 'USCSS Somnus', 'directory': None}
        self.loader._location_paths['somnus'] = ['sol', 'earth', 'somnus']

        response = self.builder.build({'view_type': 'ENCOUNTER', 'location_slug': 'somnus'})

        self.assertEqual(response['location_data']['system_slug'], 'sol')
        self.assertEqual(response['location_data']['parent_slug'], 'earth')
        # And the mutation landed on the SAME dict FakeLoader returned —
        # proving callers of find_location_by_slug must not treat the result
        # as safe-to-share without their own copy.
        self.assertIs(response['location_data'], self.loader._locations['somnus'])

    def test_location_without_directory_skips_deckplan(self):
        self.loader._locations['somnus'] = {'type': 'ship', 'name': 'USCSS Somnus', 'directory': None}
        response = self.builder.build({'view_type': 'ENCOUNTER', 'location_slug': 'somnus'})
        self.assertNotIn('map', response.get('location_data', {}))

    def test_location_with_deckplan_builds_multi_deck_map(self):
        loc_dir = Path('/fake/somnus')
        self.loader._locations['somnus'] = {'type': 'ship', 'name': 'USCSS Somnus', 'directory': str(loc_dir)}
        self.loader._deckplans[str(loc_dir)] = _deckplan()

        response = self.builder.build({'view_type': 'ENCOUNTER', 'location_slug': 'somnus'})

        map_data = response['location_data']['map']
        self.assertTrue(map_data['is_multi_deck'])
        self.assertEqual(map_data['current_deck_id'], 'main_deck')
        self.assertEqual(response['encounter_deck_name'], 'Main Deck')
        self.assertEqual(response['encounter_total_decks'], 1)

    def test_explicit_encounter_deck_id_overrides_default(self):
        loc_dir = Path('/fake/multideck')
        deckplan = {
            'name': 'Multideck', 'total_decks': 2, 'hull': None,
            'decks': [
                {'id': 'upper', 'name': 'Upper', 'level': 2, 'default': True, 'rooms': [], 'doors': []},
                {'id': 'lower', 'name': 'Lower', 'level': 1, 'default': False, 'rooms': [], 'doors': []},
            ],
        }
        self.loader._locations['ship'] = {'type': 'ship', 'name': 'Ship', 'directory': str(loc_dir)}
        self.loader._deckplans[str(loc_dir)] = deckplan

        response = self.builder.build({
            'view_type': 'ENCOUNTER', 'location_slug': 'ship', 'encounter_deck_id': 'lower',
        })

        self.assertEqual(response['location_data']['map']['current_deck_id'], 'lower')
        self.assertEqual(response['encounter_deck_name'], 'Lower')


class StableCacheTests(TestCase):
    def setUp(self):
        self.loader = FakeLoader(data_dir=Path('/nonexistent'))
        self.builder = PayloadBuilder(self.loader)

    def test_npc_cache_avoids_repeated_loader_calls(self):
        calls = {'n': 0}
        original = self.loader.load_npcs

        def counting_load_npcs():
            calls['n'] += 1
            return original()

        self.loader.load_npcs = counting_load_npcs
        self.builder.build({})
        self.builder.build({})
        self.assertEqual(calls['n'], 1)

    def test_invalidate_stable_cache_forces_reload(self):
        calls = {'n': 0}
        original = self.loader.load_npcs

        def counting_load_npcs():
            calls['n'] += 1
            return original()

        self.loader.load_npcs = counting_load_npcs
        self.builder.build({})
        self.builder.invalidate_stable_cache()
        self.builder.build({})
        self.assertEqual(calls['n'], 2)
