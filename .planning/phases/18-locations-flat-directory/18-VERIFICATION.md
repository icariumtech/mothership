---
phase: 18-locations-flat-directory
verified: 2026-04-20T21:00:00Z
status: gaps_found
score: 12/15 must-haves verified
overrides_applied: 0
gaps:
  - truth: "load_orbit_map() merges location orbital: blocks as orbital_stations and surface_markers"
    status: partial
    reason: "load_orbit_map() correctly injects orbital-type locations but silently drops all surface locations that lack an orbital: block. Eight surface locations (base_alpha, base_beta, darkside-mines, eden-research, haven-city, new-terra-city, research_base_alpha, twilight-station) have parent_type: surface but no orbital: block. The guard at data_loader.py:588 (`if not orbital_block: continue`) fires before the parent_type check, so these locations never appear in surface_markers."
    artifacts:
      - path: "terminal/data_loader.py"
        issue: "Lines 587-600: orbital_block guard fires before parent_type check, silently dropping surface locations with no orbital: block"
    missing:
      - "Move the parent_type check before the orbital_block guard so surface locations are included in surface_markers even without position data"
  - truth: "Galaxy map, system map, and orbit map render correctly with location data"
    status: failed
    reason: "Cannot verify visual rendering programmatically. The orbit map injection for surface locations has the WR-02 bug (see above), which means surface facility markers will not appear even if the render pipeline is correct. Additionally, WR-01 in views.py means parent_slug is set to system slug (location_path[0]) instead of body slug (location_path[1]) in the encounter payload, which may affect consumers that use parent_slug for breadcrumb or display logic."
    artifacts:
      - path: "terminal/views.py"
        issue: "Line 232: parent_slug = location_path[0] (system slug) — should be location_path[1] (parent body slug)"
      - path: "terminal/data_loader.py"
        issue: "load_orbit_map silently drops surface locations without orbital block"
    missing:
      - "Fix parent_slug assignment: location_path[1] not location_path[0]"
      - "Fix load_orbit_map surface location guard"
      - "Human verification that galaxy/system/orbit maps render with correct data"
human_verification:
  - test: "Load orbit map for tau-ceti-e — verify orbital-yards station appears"
    expected: "orbital-yards station marker visible on orbit map for tau-ceti-e"
    why_human: "Visual rendering cannot be verified programmatically; requires browser check"
  - test: "Load orbit map for kepler-442b — verify surface markers appear after WR-02 fix"
    expected: "base_alpha and base_beta appear as surface markers (currently silently dropped)"
    why_human: "Requires code fix (WR-02) then visual verification in browser"
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
**Status:** gaps_found
**Re-verification:** No — initial verification

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
| 8 | load_orbit_map() merges location orbital: blocks as orbital_stations and surface_markers | PARTIAL | Orbital-type locations with orbital: block correctly inject into orbital_stations. Eight surface locations (parent_type: surface) without orbital: block are silently dropped — the `if not orbital_block: continue` guard fires before the parent_type routing. surface_markers will be empty for all bodies. |
| 9 | get_system_map_json facility counting queries data/locations/ by system_slug + body_slug | VERIFIED | views.py:412-423: iterates loader.load_all_locations(), filters by system_slug, increments orbital_counts/surface_counts by body_slug; applied to bodies at lines 433-434 |
| 10 | get_location_path() reconstructs [system_slug, body_slug, slug] for flat locations | VERIFIED | data_loader.py:435-442: checks data/locations/{slug}/ first, reads system_slug/body_slug from location.yaml, returns [system_slug, body_slug, slug] filtered for non-empty |
| 11 | find_location_by_slug() checks data/locations/ before data/galaxy/ | VERIFIED | data_loader.py:396-398: checks data_dir/'locations'/slug first; falls through to campaign dir then galaxy tree |
| 12 | All load_encounter_manifest() call sites in views.py updated to load_deckplan() | VERIFIED | grep returns 0 matches for load_encounter_manifest in views.py |
| 13 | orbital_stations: entries removed from orbit_map.yaml files | VERIFIED | All four orbit_map.yaml files (tau-ceti-e, tau-ceti-f, earth, saturn) contain only comments noting self-registration; no live YAML orbital_stations keys present |
| 14 | Old galaxy facility directories deleted | VERIFIED | find data/galaxy/ -mindepth 3 -name "location.yaml" returns only celestial bodies (phoebe, selene, verdant, luna, somnus) and anchor-system/veil-station; all 14 migrated facility dirs are gone |
| 15 | Galaxy map, system map, and orbit map render correctly with location data | FAILED | Cannot verify visual rendering; additionally WR-01 bug sets parent_slug to system slug instead of body slug in encounter payload; WR-02 means surface_markers are always empty |

**Score:** 12/15 truths verified (truths 8 and 15 failed; truth 7 is 18-01 scoped and was correctly preserved)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `data/locations/` (14 subdirectories) | All non-celestial locations migrated | VERIFIED | 14 directories present |
| `terminal/data_loader.py` | load_all_locations, find_location_by_slug, get_location_path, get_location_by_path updated | VERIFIED | All four methods updated with flat directory priority |
| `terminal/views.py` | Facility counting, orbit map injection call, load_deckplan usage | VERIFIED with warning | load_encounter_manifest calls = 0; facility counting from data/locations/; but parent_slug WR-01 bug exists at line 232 |
| `data/galaxy/` orbit_map.yaml files | orbital_stations entries removed | VERIFIED | Four files updated with only self-registration comments |
| Old galaxy facility directories | Deleted | VERIFIED | All 14 listed in 18-02-SUMMARY.md deleted |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| build_active_view_payload | load_deckplan | location_dir from find_location_by_slug | WIRED | Lines 237-277; deckplan loaded and manifest-compatible structure built |
| get_system_map_json | load_all_locations | system_slug + body_slug filter | WIRED | Lines 412-434 |
| load_orbit_map | location.yaml orbital: blocks | body_slug match + orbital_block spread | PARTIAL WIRED | Orbital stations wired; surface markers silently dropped |
| find_location_by_slug | data/locations/{slug}/ | O(1) path check | WIRED | Lines 396-398 |
| get_location_path | location.yaml system_slug/body_slug | direct YAML read | WIRED | Lines 435-442 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| load_orbit_map() | orbital_stations | load_all_locations() filtered by body_slug + orbital: block | Yes for orbit-type; No for surface-type | PARTIAL — surface locations dropped |
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
| surface_markers populated for surface locations | Code analysis | Always empty — orbital_block guard fires first | FAIL |

### Requirements Coverage

No phase-18-specific requirement IDs found in REQUIREMENTS.md traceability table. Phase 18 is a backend refactor supporting existing requirements (GRID-*, GMUI-*, SHIP-01) rather than introducing new user-facing functionality.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| terminal/views.py | 2080 | `power_grid` undefined variable — NameError on every successful reactor power allocation | Blocker (pre-existing, not introduced by Phase 18) | `api_ship_reactor_power` crashes on success; broadcast fires but caller gets 500 |
| terminal/views.py | 232 | `parent_slug = location_path[0]` — sets to system slug instead of body slug (WR-01) | Warning | Encounter location payload has incorrect parent_slug for flat locations |
| terminal/data_loader.py | 587-590 | `if not orbital_block: continue` before parent_type check drops surface locations (WR-02) | Warning | surface_markers always empty; surface locations invisible on orbit map |

Note: The `power_grid` NameError (CR-01) is pre-existing and not introduced by Phase 18. It is documented in the code review (18-REVIEW.md) and should be fixed separately.

### Human Verification Required

#### 1. Orbit Map Visual Rendering (tau-ceti-e)

**Test:** Load `/api/orbit-map/tau-ceti/tau-ceti-e/` in browser dev tools or via curl; verify `orbital_stations` contains orbital-yards entry
**Expected:** `{ "orbital_stations": [{ "slug": "orbital-yards", "name": "...", "radius": 30, ... }], "surface_markers": [] }`
**Why human:** API response can be verified with curl, but orbit map visual rendering on the 3D map requires browser

#### 2. Surface Markers After WR-02 Fix (kepler-442b)

**Test:** After fixing the `if not orbital_block: continue` guard in load_orbit_map(), load `/api/orbit-map/kepler-442/kepler-442b/` and verify base_alpha and base_beta appear in `surface_markers`
**Expected:** `{ "surface_markers": [{ "slug": "base_alpha", ... }, { "slug": "base_beta", ... }] }`
**Why human:** Fix must be applied first; then visual confirmation that surface markers appear in the orbit map view

#### 3. System Map Facility Counts (tau-ceti)

**Test:** Load `/api/system-map/tau-ceti/` and check bodies array
**Expected:** tau-ceti-e has `orbital_station_count: 1` (orbital-yards); tau-ceti-f has `orbital_station_count: 1` (patrol_gunboat)
**Why human:** While logic looks correct, end-to-end API response confirmation recommended

#### 4. Encounter Map for patrol_gunboat

**Test:** Via GM console, switch encounter view to patrol_gunboat; verify map loads showing main_deck rooms
**Expected:** Encounter map renders with patrol_gunboat deckplan rooms; deck switcher shows 1 deck
**Why human:** Requires running server; tests the full deckplan load chain end-to-end

### Gaps Summary

Two gaps block full goal achievement:

**Gap 1 — Surface locations silently dropped from orbit maps (WR-02)**

`load_orbit_map()` has a guard `if not orbital_block: continue` that fires before the `parent_type` routing. Eight locations with `parent_type: surface` but no `orbital:` block (base_alpha, base_beta, darkside-mines, eden-research, haven-city, new-terra-city, research_base_alpha, twilight-station) are silently skipped. The `surface_markers` list will always be empty, meaning surface facilities are invisible on the orbit map. This contradicts the must-have that orbit maps show both orbital stations and surface markers from self-registering locations.

**Fix:** In `data_loader.py:587-600`, move the `if not orbital_block: continue` guard inside the `if parent_type == 'orbit':` branch so it only applies to orbit-type locations that need position coordinates.

**Gap 2 — Visual rendering unverifiable without human check**

The map rendering goal ("Galaxy map, system map, and orbit map render correctly") cannot be verified programmatically. The WR-01 bug (parent_slug wrong) and WR-02 bug (surface markers missing) mean even if pipes are wired, the rendered output will be incorrect until both are fixed.

**Note on pre-existing CR-01 bug:** The `power_grid` NameError in `api_ship_reactor_power` (views.py:2080) is a pre-existing crash that was identified by the code review but is not introduced by Phase 18 and does not affect the location migration goal. It should be tracked and fixed separately.

---

_Verified: 2026-04-20T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
