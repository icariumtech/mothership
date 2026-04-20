---
phase: "18-locations-flat-directory"
plan: "18-02"
subsystem: "backend"
tags: ["backend", "refactor", "data-loader", "views", "orbit-map", "cleanup"]

dependency_graph:
  requires: ["18-01"]
  provides: []
  affects:
    - "terminal/data_loader.py"
    - "terminal/views.py"
    - "data/galaxy/"

tech_stack:
  added: []
  patterns:
    - "Self-registration: locations inject themselves into orbit maps via orbital: block in location.yaml"
    - "Slug disambiguation: data/locations/ checked before galaxy tree (O(1) path lookup)"
    - "Flat path reconstruction: [system_slug, body_slug, slug] from location.yaml fields"

key_files:
  modified:
    - terminal/data_loader.py
    - terminal/views.py
    - data/galaxy/tau-ceti/tau-ceti-e/orbit_map.yaml
    - data/galaxy/tau-ceti/tau-ceti-f/orbit_map.yaml
    - data/galaxy/sol/earth/orbit_map.yaml
    - data/galaxy/sol/saturn/orbit_map.yaml
  deleted:
    - data/galaxy/tau-ceti/tau-ceti-e/orbital-yards/ (14 facility dirs total)
    - data/galaxy/tau-ceti/tau-ceti-e/new-terra-city/
    - data/galaxy/tau-ceti/tau-ceti-f/patrol_gunboat/
    - data/galaxy/proxima-centauri/proxima-b/gateway-station/
    - data/galaxy/proxima-centauri/proxima-b/twilight-station/
    - data/galaxy/ross-128/ross-128-b/darkside-mines/
    - data/galaxy/kepler-442/kepler-442b/base_alpha/
    - data/galaxy/kepler-442/kepler-442b/base_beta/
    - data/galaxy/kepler-442/kepler-442c/ship_gamma/ (+ deck_1, deck_2)
    - data/galaxy/luyten-star/luyten-b/haven-city/
    - data/galaxy/sol/earth/research_base_alpha/
    - data/galaxy/trappist-1/trappist-1e/eden-research/
    - data/galaxy/trappist-1/trappist-1e/orbital-research-platform/
    - data/galaxy/trappist-1/trappist-1d/survey-station-delta/

decisions:
  - "load_orbit_map() now overwrites orbital_stations/surface_markers entirely from data/locations/ — no merging with static YAML entries"
  - "get_location_by_path() simplified to delegate to find_location_by_slug(path[-1]) — path leading elements provide context but slug is authoritative"
  - "veil-station and somnus left in galaxy tree — not migrated in 18-01, not deleted here"
  - "Room-hiding on encounter location switch (api_switch_view) left as-is — deckplan locations have no map/ dir so block is skipped; pre-existing behavior"
  - "load_encounter_manifest() kept in DataLoader for backward compat (used by load_map() internally)"

metrics:
  duration: 45
  completed: "2026-04-20T19:15:00Z"
  tasks_completed: 8
  files_changed: 6
---

# Phase 18 Plan 02: Locations Flat Directory — Views + Orbit Map Injection Summary

Updated all backend DataLoader methods and views to use the flat `data/locations/` structure: orbit map self-registration, facility counting from `data/locations/`, slug disambiguation prioritizing the flat directory, deckplan-based encounter map loading, and cleanup of the now-redundant galaxy facility directories.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Update load_orbit_map() for self-registration | 8be5e79 |
| 2 | Rewrite facility counting in get_system_map_json | 8be5e79 |
| 3 | Update get_location_path() for flat locations | 8be5e79 |
| 4 | Update find_location_by_slug() for slug disambiguation | 8be5e79 |
| 5 | Audit and update get_location_by_path() | 8be5e79 |
| 6 | Replace load_encounter_manifest() call sites in views.py | 8be5e79 |
| 7 | Remove orbital_stations from orbit_map.yaml files | ea4993f |
| 8 | Delete old galaxy facility directories | ea4993f |

## Verification Results

```
load_all_locations: 14 locations (all from data/locations/)
find_location_by_slug(orbital-yards): Tau Ceti Orbital Shipyards
find_location_by_slug(research_base_alpha): Research Base Alpha
get_location_path(patrol_gunboat): ['tau-ceti', 'tau-ceti-f', 'patrol_gunboat']

Orbit map tau-ceti-e:
  orbital_stations: ['orbital-yards']  (self-registered)
  surface_markers: []

Facility counts for tau-ceti:
  surface: {'tau-ceti-e': 1}
  orbital: {'tau-ceti-e': 1, 'tau-ceti-f': 1}

Static orbital_stations: none (grep returns empty)
Old facility dirs: DELETED
load_encounter_manifest calls in views.py: 0
```

## Deviations from Plan

None — plan executed exactly as written, with these implementation notes:

**1. load_deck_map() calls in api_switch_view left unchanged**
- The room-hiding logic in `api_switch_view` reads `location['map']` which is populated by `load_map()`.
- For deckplan-based locations (patrol_gunboat, base_alpha, ship_gamma), there is no `map/` directory, so `load_map()` returns `None` and the entire room-hiding block is skipped.
- This is pre-existing behavior — the encounter room visibility is managed client-side for deckplan locations.
- No code change needed; out of scope for this plan.

**2. load_encounter_manifest() retained in DataLoader**
- The method is still used internally by `load_map()` for legacy manifest.yaml locations.
- Only the `views.py` call site was replaced (as per plan Task 6).
- The method itself is not deleted; it remains for internal use.

## Known Stubs

None — all data is real campaign content.

## Threat Flags

None — no new network endpoints or auth paths introduced. This is a pure backend refactor.

## Self-Check: PASSED

- [x] load_all_locations() returns 14 locations from data/locations/
- [x] load_orbit_map() injects orbital_stations from location.yaml orbital: blocks
- [x] find_location_by_slug() checks data/locations/ first
- [x] get_location_path() reconstructs path from location.yaml fields for flat locs
- [x] get_system_map_json() counts facilities from data/locations/
- [x] build_active_view_payload() uses load_deckplan() instead of load_encounter_manifest()
- [x] grep orbital_stations: in orbit_map.yaml files returns no live YAML entries
- [x] 14 galaxy facility directories deleted
- [x] Commits 8be5e79 and ea4993f present
