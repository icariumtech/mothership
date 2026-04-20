---
phase: "18-locations-flat-directory"
plan: "18-01"
subsystem: "data-migration"
tags: ["data", "backend", "refactor", "locations"]

dependency_graph:
  requires: ["16-01"]
  provides: ["18-02"]
  affects: ["terminal/data_loader.py", "data/locations/"]

tech_stack:
  added: []
  patterns:
    - "Flat directory layout for non-celestial locations with self-describing YAML"
    - "Parent context fields (parent_type, body_slug, system_slug) in location.yaml"
    - "Merged deckplan.yaml (manifest + deck data in a single file)"
    - "Fallback pattern: new code path first, legacy fallback if directory absent"

key_files:
  created:
    - data/locations/orbital-yards/location.yaml
    - data/locations/new-terra-city/location.yaml
    - data/locations/patrol_gunboat/location.yaml
    - data/locations/patrol_gunboat/deckplan.yaml
    - data/locations/gateway-station/location.yaml
    - data/locations/twilight-station/location.yaml
    - data/locations/darkside-mines/location.yaml
    - data/locations/base_beta/location.yaml
    - data/locations/base_alpha/location.yaml
    - data/locations/base_alpha/deckplan.yaml
    - data/locations/ship_gamma/location.yaml
    - data/locations/ship_gamma/deckplan.yaml
    - data/locations/haven-city/location.yaml
    - data/locations/research_base_alpha/location.yaml
    - data/locations/eden-research/location.yaml
    - data/locations/orbital-research-platform/location.yaml
    - data/locations/survey-station-delta/location.yaml
    - data/locations/base_alpha/comms/ (copied from galaxy tree)
    - data/locations/ship_gamma/comms/ (copied from galaxy tree)
    - data/locations/research_base_alpha/comms/ (copied from galaxy tree)
  modified:
    - terminal/data_loader.py

decisions:
  - "Moons (phoebe, selene, verdant, luna) not migrated — they are celestial bodies, not stations/bases/ships"
  - "deck_1/deck_2 sub-locations of ship_gamma not migrated as standalone — consolidated into ship_gamma deckplan.yaml"
  - "Fallback to legacy galaxy tree scan preserved in load_all_locations() if data/locations/ absent"
  - "Orbital data in location.yaml uses approximate values for locations without orbit_map.yaml entries"
  - "orbital_stations entries NOT removed from orbit_map.yaml — deferred to 18-02"

metrics:
  duration: 720
  completed: "2026-04-20T17:58:29Z"
  tasks_completed: 4
  files_changed: 44
---

# Phase 18 Plan 01: Locations Flat Directory — Data Migration + Backend Summary

Migrated 14 non-celestial locations (stations, bases, ships) from nested `data/galaxy/` tree into a flat `data/locations/{slug}/` directory. Each location is now self-describing with explicit `parent_type`, `body_slug`, and `system_slug` fields. `load_all_locations()` in DataLoader was updated to scan the new flat directory, with fallback to legacy galaxy tree if absent.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Inventory all non-celestial locations | 9e9aaf7 |
| 2 | Migrate each location to data/locations/ | 9e9aaf7 |
| 3 | Update load_all_locations() in DataLoader | 1a05683 |
| 4 | Verify load_deckplan() with migrated locations | 1a05683 |

## Location Inventory

14 non-celestial locations migrated:

| Slug | Type | Parent Body | System | Has Map | Has Comms |
|------|------|-------------|--------|---------|-----------|
| orbital-yards | station | tau-ceti-e | tau-ceti | — | — |
| new-terra-city | base | tau-ceti-e | tau-ceti | — | — |
| patrol_gunboat | ship | tau-ceti-f | tau-ceti | deckplan.yaml | — |
| gateway-station | station | proxima-b | proxima-centauri | — | — |
| twilight-station | base | proxima-b | proxima-centauri | — | — |
| darkside-mines | base | ross-128-b | ross-128 | — | — |
| base_beta | station | kepler-442b | kepler-442 | — | — |
| base_alpha | station | kepler-442b | kepler-442 | deckplan.yaml | comms/ |
| ship_gamma | ship | kepler-442c | kepler-442 | deckplan.yaml | comms/ |
| haven-city | base | luyten-b | luyten-star | — | — |
| research_base_alpha | station | earth | sol | — | comms/ |
| eden-research | base | trappist-1e | trappist-1 | — | — |
| orbital-research-platform | station | trappist-1e | trappist-1 | — | — |
| survey-station-delta | station | trappist-1d | trappist-1 | — | — |

**Skipped:**
- Moons: phoebe, selene, verdant, luna (celestial bodies — belong in galaxy tree)
- deck_1, deck_2 (sub-locations of ship_gamma — consolidated into ship_gamma deckplan.yaml)

## Verification Results

```
Locations found: ['base_alpha', 'base_beta', 'darkside-mines', 'eden-research',
  'gateway-station', 'haven-city', 'new-terra-city', 'orbital-research-platform',
  'orbital-yards', 'patrol_gunboat', 'research_base_alpha', 'ship_gamma',
  'survey-station-delta', 'twilight-station']
Total: 14

patrol_gunboat deckplan: total_decks=1, hull=present, decks=['main_deck']
base_alpha deckplan: total_decks=1, decks=['main']
gateway-station deckplan (no map): {'decks': [], 'hull': None, 'total_decks': 0}
```

Old galaxy location directories confirmed intact (not deleted).

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written, with the following scope clarifications applied automatically:

**1. Moon locations excluded from migration**
- Found during: Task 1
- Issue: Moons (phoebe, selene, verdant, luna) appear at depth 4 in the galaxy tree and have location.yaml files, but they are celestial bodies (type: "moon"), not non-celestial locations
- Decision: Excluded from migration — moons remain in galaxy tree where orbit_map.yaml references them

**2. deck_1/deck_2 consolidated into parent ship_gamma**
- Found during: Task 2
- Issue: deck_1 and deck_2 are sub-directories of ship_gamma, not standalone locations
- Decision: Created ship_gamma deckplan.yaml with two deck entries; comms from deck_1 copied to ship_gamma comms/

## Known Stubs

None — all migrated data is real campaign content. ship_gamma deckplan decks use simple grid_size dimensions matching the source deck files (no room geometry was defined in the original YAML).

## Self-Check: PASSED

- [x] data/locations/ directory exists with 14 subdirectories
- [x] All location.yaml files have parent_type, body_slug, system_slug
- [x] patrol_gunboat/deckplan.yaml, base_alpha/deckplan.yaml, ship_gamma/deckplan.yaml created
- [x] comms/ dirs copied for base_alpha, ship_gamma, research_base_alpha
- [x] load_all_locations() returns 14 slugs (verified via Django shell)
- [x] load_deckplan() works for migrated locations (verified)
- [x] Old galaxy locations still exist
- [x] Commits 9e9aaf7 and 1a05683 present in git log
