---
phase: 16-ship-data-consolidation
verified: 2026-04-18T00:00:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Start Django dev server, open GM Console → BRIDGE → STATUS tab"
    expected: "Ship deck map renders correctly with rooms visible and USCSS Morrigan data displayed"
    why_human: "Cannot verify SVG rendering output or visual correctness of the deckplan → MultiDeckMapData → frontend pipeline programmatically"
  - test: "Edit a ship system status in GM console (e.g., toggle Engines from ONLINE to WARNING)"
    expected: "Change persists after page reload — save_ship_* methods write correctly to the new path"
    why_human: "Requires live server interaction to verify round-trip write/read through the new SHIP_YAML_PATH"
---

# Phase 16: Ship Data Consolidation Verification Report

**Phase Goal:** Consolidate the Morrigan's data from 4 files into 2 — move ship.yaml into ship/ and merge deck map files into a single deckplan.yaml.
**Verified:** 2026-04-18
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | data/campaign/ship/ship.yaml exists with flat structure (no ship: wrapper) | VERIFIED | File exists at correct path; top-level keys are class, name, systems, resources, etc. — confirmed flat, no wrapper |
| 2 | data/campaign/ship/location.yaml deleted | VERIFIED | `ls` confirms file absent from ship/ directory |
| 3 | data/campaign/ship/map/manifest.yaml deleted | VERIFIED | `ls` confirms map/ directory does not exist at all |
| 4 | data/campaign/ship/deckplan.yaml exists with decks: list format and hull: at top level | VERIFIED | File exists; hull: polygon at line 4; decks: list beginning at line 36 with id/name/level/default/rooms structure |
| 5 | data/campaign/ship/map/ directory is gone | VERIFIED | `ls data/campaign/ship/map/` returns "map/ does not exist" |
| 6 | SHIP_YAML_PATH constant defined in DataLoader; all save_ship_* methods use it | VERIFIED | Line 16: `SHIP_YAML_PATH = 'campaign/ship/ship.yaml'`; all 8 save methods (_save_ship_yaml, save_ship_location, save_ship_system, save_ship_integrity, save_ship_resource, save_ship_cargo, save_ship_stat, save_system_power, save_system_fault_indicator) use `self.SHIP_YAML_PATH`; grep for old hardcoded path returns 0 results |
| 7 | find_location_by_slug() checks ship.yaml presence (not location.yaml) for campaign ship dir | VERIFIED | data_loader.py line 375: `(candidate / "ship.yaml").exists()` — correct sentinel |
| 8 | views.py load_map(ship_dir) call updated to load_deckplan(ship_dir) | VERIFIED | views.py line 274: `deckplan = loader.load_deckplan(ship_dir)` |
| 9 | load_deckplan() returns dict with decks (sorted by level), hull, and total_decks keys | VERIFIED | data_loader.py lines 577-602: method sorts by level, returns {decks, hull, total_decks} |

**Score:** 9/9 truths verified

### Note on Must-Have #1 (ship: wrapper)

The PLAN frontmatter stated "ship: wrapper preserved" but the SUMMARY correctly documents this was superseded: the Phase 14 refactor had already made the file flat. The code accesses top-level keys directly (e.g., `ship_data.setdefault('systems', {})` — not `ship_data['ship']['systems']`). The flat format is correct and consistent with the backend. This deviation was intentional and self-correcting.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `data/campaign/ship/ship.yaml` | Ship identity, systems, resources | VERIFIED | 132 lines; flat structure with class, name, stats, systems (6), resources (5), cargo |
| `data/campaign/ship/deckplan.yaml` | Decks list with hull at top level | VERIFIED | hull: polygon (29 points); decks: 1 entry (main_deck, level 1, 9 rooms + 3 corridors) |
| `terminal/data_loader.py` | SHIP_YAML_PATH constant + load_deckplan() + find_location_by_slug fix | VERIFIED | All three present and correct |
| `terminal/views.py` | load_deckplan() call replacing load_map(); MultiDeckMapData transform | VERIFIED | Lines 272-308; transforms deckplan to MultiDeckMapData shape with manifest, current_deck, slug='deckplan' |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| views.py build_active_view_payload | DataLoader.load_deckplan | loader.load_deckplan(ship_dir) | WIRED | line 274; result consumed lines 275-308 |
| load_deckplan() | data/campaign/ship/deckplan.yaml | Path(location_dir) / 'deckplan.yaml' | WIRED | line 587; file exists |
| save_ship_* methods | data/campaign/ship/ship.yaml | self.data_dir / self.SHIP_YAML_PATH | WIRED | All 9 save methods use constant; file exists |
| find_location_by_slug | ship.yaml sentinel | (candidate / "ship.yaml").exists() | WIRED | line 375; file exists to match |
| views.py response | frontend (ship_deck_data) | response['ship_deck_data'] dict | WIRED | MultiDeckMapData shape built at lines 283-307 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| views.py ship_deck_data | deckplan (decks, hull) | load_deckplan() reads deckplan.yaml | Yes — 9 rooms from YAML | FLOWING |
| load_deckplan() return | decks_sorted | yaml.safe_load(deckplan.yaml) | Yes — 1 deck, 9 rooms loaded | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for file-existence checks (file reorganization + backend refactor). Runtime behavior requires live server — routed to human verification.

### Requirements Coverage

Phase 16 is not mapped to any requirement IDs in REQUIREMENTS.md — this is a refactoring phase (internal data layout change, not a user-facing feature). No requirement coverage gaps.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| data_loader.py save_ship_location | Reads file directly (not via _save_ship_yaml for the read step) | Info | Minor — consistent with other save methods; not a bug |

No blockers found. The `save_ship_location` method reads the file directly rather than calling a load helper, consistent with the other save_ship_* methods that do the same pattern. This is a pre-existing style choice, not introduced by this phase.

### Human Verification Required

#### 1. Deck Map Renders in GM Console

**Test:** Start Django dev server (`./start_server.sh`), open GM Console at `/gmconsole/`, navigate to BRIDGE → STATUS tab
**Expected:** Ship deck map (USCSS Morrigan main deck) renders correctly with rooms visible — engineering, steerage, cargo bay, lounge, computer, bridge, and corridors
**Why human:** Cannot verify SVG rendering output or visual correctness of the deckplan → MultiDeckMapData → frontend pipeline programmatically

#### 2. Ship Data Edits Persist

**Test:** In GM Console BRIDGE view, toggle a ship system status (e.g., Engines from ONLINE to WARNING), reload page
**Expected:** Change persists — confirms save_ship_system() writes correctly to the new SHIP_YAML_PATH and load_ship_status() reads it back
**Why human:** Requires live server interaction to verify the round-trip write/read through the relocated file path

### Gaps Summary

No gaps found. All 9 must-haves are verified in the codebase. The phase achieved its goal: 4 files consolidated to 2, path centralized via SHIP_YAML_PATH constant, load_deckplan() method added, find_location_by_slug() updated, views.py updated with MultiDeckMapData transform.

Two human verification items remain for runtime confirmation of rendering and persistence behavior.

---

_Verified: 2026-04-18_
_Verifier: Claude (gsd-verifier)_
