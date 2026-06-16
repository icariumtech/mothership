"""
Regression tests for DataLoader deckplan-only loading (Phase 29 Plan 01, EDIT-01).

Guards against regression of the legacy loader removal:
  - load_map / load_encounter_manifest / load_deck_map must not exist on the loader
  - load_deckplan() must return non-empty decks for the somnus ship location
  - load_deckplan() must return empty sentinel for a directory with no deckplan.yaml
"""
import tempfile
from pathlib import Path
from django.test import TestCase
from django.conf import settings
from core.data_loader import DataLoader


class DataLoaderDeckplanTests(TestCase):
    """Tests for the deckplan-only loading path (EDIT-01)."""

    def setUp(self):
        self.loader = DataLoader(getattr(settings, 'DATA_DIR', 'data'))

    # ------------------------------------------------------------------ #
    # Legacy method absence                                                #
    # ------------------------------------------------------------------ #

    def test_load_map_does_not_exist(self):
        """load_map() must not be present — removed in Phase 29."""
        self.assertFalse(
            hasattr(self.loader, 'load_map'),
            "load_map() was found on DataLoader — it should have been removed in Phase 29",
        )

    def test_load_encounter_manifest_does_not_exist(self):
        """load_encounter_manifest() must not be present — removed in Phase 29."""
        self.assertFalse(
            hasattr(self.loader, 'load_encounter_manifest'),
            "load_encounter_manifest() was found on DataLoader — it should have been removed in Phase 29",
        )

    def test_load_deck_map_does_not_exist(self):
        """load_deck_map() must not be present — removed in Phase 29."""
        self.assertFalse(
            hasattr(self.loader, 'load_deck_map'),
            "load_deck_map() was found on DataLoader — it should have been removed in Phase 29",
        )

    # ------------------------------------------------------------------ #
    # load_deckplan() — somnus (real deckplan.yaml)                        #
    # ------------------------------------------------------------------ #

    def test_somnus_load_deckplan_returns_non_empty_decks(self):
        """load_deckplan() on the somnus ship directory returns at least one deck."""
        somnus_dir = Path(self.loader.data_dir) / 'ships' / 'somnus'
        if not somnus_dir.exists():
            self.skipTest("data/ships/somnus not present in test environment")
        result = self.loader.load_deckplan(somnus_dir)
        self.assertIn('decks', result)
        self.assertGreater(len(result['decks']), 0, "Expected at least one deck in somnus deckplan")

    def test_somnus_load_deckplan_first_deck_has_rooms(self):
        """The first deck of the somnus deckplan contains rooms."""
        somnus_dir = Path(self.loader.data_dir) / 'ships' / 'somnus'
        if not somnus_dir.exists():
            self.skipTest("data/ships/somnus not present in test environment")
        result = self.loader.load_deckplan(somnus_dir)
        first_deck = result['decks'][0]
        self.assertIn('rooms', first_deck)
        self.assertGreater(len(first_deck['rooms']), 0, "Expected rooms in the first somnus deck")

    def test_somnus_load_deckplan_main_deck_id(self):
        """The somnus deckplan's first deck has id 'main_deck'."""
        somnus_dir = Path(self.loader.data_dir) / 'ships' / 'somnus'
        if not somnus_dir.exists():
            self.skipTest("data/ships/somnus not present in test environment")
        result = self.loader.load_deckplan(somnus_dir)
        self.assertEqual(result['decks'][0]['id'], 'main_deck')

    def test_somnus_load_deckplan_hull_present(self):
        """The somnus deckplan has a hull polygon."""
        somnus_dir = Path(self.loader.data_dir) / 'ships' / 'somnus'
        if not somnus_dir.exists():
            self.skipTest("data/ships/somnus not present in test environment")
        result = self.loader.load_deckplan(somnus_dir)
        self.assertIsNotNone(result.get('hull'))
        self.assertIn('polygon', result['hull'])
        self.assertGreater(len(result['hull']['polygon']), 0)

    # ------------------------------------------------------------------ #
    # load_deckplan() — directory with no deckplan.yaml (empty sentinel)  #
    # ------------------------------------------------------------------ #

    def test_load_deckplan_missing_file_returns_empty_sentinel(self):
        """load_deckplan() on a directory without deckplan.yaml returns the empty sentinel dict."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            result = self.loader.load_deckplan(Path(tmp_dir))
        self.assertEqual(result['decks'], [])
        self.assertIsNone(result['hull'])
        self.assertEqual(result['total_decks'], 0)
