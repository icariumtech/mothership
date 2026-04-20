---
phase: 18-locations-flat-directory
verified: 2026-04-20T21:00:00Z
re_verified: 2026-04-20T22:00:00Z
status: human_needed
score: 14/15 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 12/15
  gaps_closed:
    - "load_orbit_map() surface location guard (WR-02): `if not orbital_block: continue` moved inside `if parent_type == 'orbit':` branch — surface locations now reach surface_markers"
    - "views.py parent_slug (WR-01): location_path[1] (body slug) now used instead of location_path[0] (system slug)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Load orbit map for tau-ceti-e — verify orbital-yards station appears"
    expected: "orbital-yards station marker visible on orbit map for tau-ceti-e"
    why_human: "Visual rendering cannot be verified programmatically; requires browser check"
  - test: "Load orbit map for a body with surface locations — verify surface markers appear"
    expected: "surface locations (e.g. base_alpha, base_beta) appear as surface markers now that WR-02 is fixed"
    why_human: "Code fix is confirmed; visual confirmation that surface markers render correctly in the orbit map view still requires browser"
  - test: "Load system map for tau-ceti — verify facility counts for tau-ceti-e and tau-ceti-f are non-zero"
    expected: "orbital_station_count >= 1 for tau-ceti-e (orbital-yards) and tau-ceti-f (patrol_gunboat)"
    why_human: "While facility counting logic looks correct, end-to-end data flow through the API response should be confirmed in-browser or via curl"
  - test: "Switch encounter to patrol_gunboat — verify deck map loads"
    expected: "Encounter view shows patrol_gunboat main_deck with rooms from deckplan.yaml"
    why_human: "Requires running server; deckplan load path uses load_deckplan() which is wired correctly but full round-trip needs human confirmation"
---

# Phase 18: Locations Flat Directory Verification Report

**Phase Goal:** Move all non-celestial locations from data/galaxy/ nesting into data/locations/{slug}/ with explicit parent references and self-registration into orbit maps.
**Verified:** 2026-04-20T21:00:00Z
**Re-verified:** 2026-04-20T22:00:00Z (gap closure check)
**Status:** human_needed
**Re-verification:** Yes — after WR-01 and WR-02 gap closure

## Gap Closure Summary

Two code bugs identified in initial verification were fixed and confirmed:

**WR-02 closed:** `data_loader.py` lines 589-604 — the `if not orbital_block: continue` guard is now inside the `if parent_type == 'orbit':` branch. The `elif parent_type == 'surface':` branch runs unconditionally, spreading `orbital_block` (empty `{}` if absent) into the entry. Surface locations with no `orbital:` block now correctly appear in `surface_markers`.

**WR-01 closed:** `views.py` line 232 — `response['location_data']['parent_slug'] = location_path[1]` now uses index 1 (body slug) instead of index 0 (system slug). The encounter payload carries the correct parent body reference.

All programmatic gaps are resolved. Human verification items remain as standard UAT.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | data/locations/ directory exists with one subdirectory per non-celestial location | VERIFIED | 14 directories present: base_alpha, base_beta, darkside-mines, eden-research, gateway-station, haven-city, new-terra-city, orbital-research-platform, orbital-yards, patrol_gunboat, research_base_alpha, ship_gamma, survey-station-delta, twilight-station |
| 2 | Each location.yaml has parent_type, body_slug, and system_slug fields | VERIFIED | Python scan confirmed all 14 location.yaml files contain all three fields |
| 3 | Each location has deckplan.yaml (merged from old manifest.yaml + deck files) where applicable | VERIFIED | patrol_gunboat/deckplan.yaml, base_alpha/deckplan.yaml, ship_gamma/deckplan.yaml all present; other locations have no map data as expected |
| 4 | comms/ directories moved as-is from old location paths where applicable | VERIFIED | base_alpha/comms/, ship_gamma/comms/, research_base_alpha/comms/ all present |
| 5 | load_all_locations() scans data/locations/ instead of recursing data/galaxy/ | VERIFIED | data_loader.py:34-60: locations_dir = self.data_dir / 'locations'; checks existence, iterates sorted subdirs, falls back to galaxy tree only if data/locations/ absent |
| 6 | load_deckplan() works for all locations (ship + locations/ entries) | VERIFIED | load_deckplan() at line 704 reads deckplan.yaml from given dir; wired in build_active_view_payload() lines 237-277 for encounter locations and lines 283-318 for ship deck |
| 7 | orbital_stations entries NOT yet removed from orbit_map.yaml files (safety — deferred to 18-02) | VERIFIED (18-01 scope) | orbit_map.yaml files retained static entries during 18-01; removed in 18-02 commit ea4993f |
| 8 | load_orbit_map() merges location orbital: blocks as orbital_stations and surface_markers | VERIFIED | WR-02 fixed: `if not orbital_block: continue` guard moved inside `if parent_type == 'orbit':` branch. Surface locations now reach surface_markers unconditionally. Orbital locations with no orbital: block are still skipped (correct — they have no position data). |
| 9 | get_system_map_json facility counting queries data/locations/ by system_slug + body_slug | VERIFIED | views.py:412-423: iterates loader.load_all_locations(), filters by system_slug, increments orbital_counts/surface_counts by body_slug; applied to bodies at lines 433-434 |
| 10 | get_location_path() reconstructs [system_slug, body_slug, slug] for flat locations | VERIFIED | data_loader.py:435-442: checks data/locations/{slug}/ first, reads system_slug/body_slug from location.yaml, returns [system_slug, body_slug, slug] filtered for non-empty |
| 11 | find_location_by_slug() checks data/locations/ before data/galaxy/ | VERIFIED | data_loader.py:396-398: checks data_dir/'locations'/slug first; falls through to campaign dir then galaxy tree |
| 12 | All load_encounter_manifest() call sites in views.py updated to load_deckplan() | VERIFIED | grep returns 0 matches for load_encounter_manifest in views.py |
| 13 | orbital_stations: entries removed from orbit_map.yaml files | VERIFIED | All four orbit_map.yaml files (tau-ceti-e, tau-ceti-f, earth, saturn) contain only comments noting self-registration; no live YAML orbital_stations keys present |
| 14 | Old galaxy facility directories deleted | VERIFIED | find data/galaxy/ -mindepth 3 -name "location.yaml" returns only celestial bodies (phoebe, selene, verdant, luna, somnus) and anchor-system/veil-station; all 14 migrated facility dirs are gone |
| 15 | Galaxy map, system map, and orbit map render correctly with location data | NEEDS HUMAN | Code bugs WR-01 and WR-02 are now fixed. Visual rendering of galaxy/system/orbit maps with correct data requires browser confirmation. |

**Score:** 14/15 truths verified (truth 15 requires human verification; all programmatic checks pass)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `data/locations/` (14 subdirectories) | All non-celestial locations migrated | VERIFIED | 14 directories present |
| `terminal/data_loader.py` | load_all_locations, find_location_by_slug, get_location_path, get_location_by_path updated | VERIFIED | All four methods updated with flat directory priority; WR-02 fixed |
| `terminal/views.py` | Facility counting, orbit map injection call, load_deckplan usage | VERIFIED | WR-01 fixed (line 232 now uses location_path[1]); load_encounter_manifest calls = 0; facility counting from data/locations/ |
| `data/galaxy/` orbit_map.yaml files | orbital_stations entries removed | VERIFIED | Four files updated with only self-registration comments |
| Old galaxy facility directories | Deleted | VERIFIED | All 14 listed in 18-02-SUMMARY.md deleted |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| build_active_view_payload | load_deckplan | location_dir from find_location_by_slug | WIRED | Lines 237-277; deckplan loaded and manifest-compatible structure built |
| get_system_map_json | load_all_locations | system_slug + body_slug filter | WIRED | Lines 412-434 |
| load_orbit_map | location.yaml orbital: blocks | body_slug match + parent_type routing | WIRED | WR-02 fixed; orbital stations and surface markers both populated correctly |
| find_location_by_slug | data/locations/{slug}/ | O(1) path check | WIRED | Lines 396-398 |
| get_location_path | location.yaml system_slug/body_slug | direct YAML read | WIRED | Lines 435-442; WR-01 fixed, location_path[1] returns body slug |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| load_orbit_map() | orbital_stations | load_all_locations() filtered by body_slug + orbital: block | Yes | FLOWING |
| load_orbit_map() | surface_markers | load_all_locations() filtered by body_slug + parent_type == 'surface' | Yes — WR-02 fixed | FLOWING |
| get_system_map_json | orbital_station_count, surface_facility_count | load_all_locations() filtered by system_slug | Yes | FLOWING |
| build_active_view_payload | location_data.map (encounter) | load_deckplan() from location['directory'] | Yes — deckplan.yaml rooms loaded | FLOWING |

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| data/locations/ has 14 entries | `ls data/locations/ \| wc -l` | 14 | PASS |
| All location.yaml have required fields | Python field scan | 0 missing | PASS |
| load_encounter_manifest calls removed from views.py | grep count | 0 | PASS |
| orbit_map.yaml live orbital_stations entries removed | grep output | Only comments | PASS |
| Old facility dirs deleted | find mindepth 3 location.yaml | Only celestial bodies | PASS |
| surface_markers guard fixed | Code analysis: `if not orbital_block: continue` inside `if parent_type == 'orbit':` branch | Confirmed at lines 589-591 | PASS |
| parent_slug uses body slug | Code analysis: location_path[1] at views.py:232 | Confirmed | PASS |

### Requirements Coverage

No phase-18-specific requirement IDs found in REQUIREMENTS.md traceability table. Phase 18 is a backend refactor supporting existing requirements (GRID-*, GMUI-*, SHIP-01) rather than introducing new user-facing functionality.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| terminal/views.py | 2080 | `power_grid` undefined variable — NameError on every successful reactor power allocation | Blocker (pre-existing, not introduced by Phase 18) | `api_ship_reactor_power` crashes on success; broadcast fires but caller gets 500 |

Note: WR-01 and WR-02 from initial verification are resolved. The `power_grid` NameError (CR-01) is pre-existing and not introduced by Phase 18. It is documented in the code review (18-REVIEW.md) and should be fixed separately.

### Human Verification Required

#### 1. Orbit Map Visual Rendering (tau-ceti-e)

**Test:** Load `/api/orbit-map/tau-ceti/tau-ceti-e/` in browser dev tools or via curl; verify `orbital_stations` contains orbital-yards entry
**Expected:** `{ "orbital_stations": [{ "slug": "orbital-yards", "name": "...", "radius": 30, ... }], "surface_markers": [] }`
**Why human:** API response can be verified with curl, but orbit map visual rendering on the 3D map requires browser

#### 2. Surface Markers Now Populated (post-WR-02 fix)

**Test:** Load `/api/orbit-map/` for a body with surface locations (e.g. kepler-442b or any body with base_alpha/base_beta); verify surface markers now appear
**Expected:** `{ "surface_markers": [{ "slug": "base_alpha", ... }, { "slug": "base_beta", ... }] }`
**Why human:** Code fix confirmed; visual confirmation that surface markers render correctly in the orbit map view still requires browser

#### 3. System Map Facility Counts (tau-ceti)

**Test:** Load `/api/system-map/tau-ceti/` and check bodies array
**Expected:** tau-ceti-e has `orbital_station_count: 1` (orbital-yards); tau-ceti-f has `orbital_station_count: 1` (patrol_gunboat)
**Why human:** While logic looks correct, end-to-end API response confirmation recommended

#### 4. Encounter Map for patrol_gunboat

**Test:** Via GM console, switch encounter view to patrol_gunboat; verify map loads showing main_deck rooms
**Expected:** Encounter view shows patrol_gunboat main_deck with rooms from deckplan.yaml; deck switcher shows 1 deck
**Why human:** Requires running server; tests the full deckplan load chain end-to-end

### Gaps Summary

No programmatic gaps remain. Both code bugs from initial verification (WR-01, WR-02) are confirmed fixed:

- **WR-02** (`data_loader.py`): `if not orbital_block: continue` guard now scoped to orbit-type locations only. Surface locations reach `surface_markers` unconditionally.
- **WR-01** (`views.py:232`): `location_path[1]` correctly returns the parent body slug.

Four human verification items remain as standard UAT — visual rendering of maps in-browser cannot be verified programmatically. These do not represent code defects; they are confirmation that the wired data flows produce correct visual output.

---

_Verified: 2026-04-20T21:00:00Z_
_Re-verified: 2026-04-20T22:00:00Z (WR-01/WR-02 gap closure confirmed)_
_Verifier: Claude (gsd-verifier)_
