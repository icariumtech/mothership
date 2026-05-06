---
phase: "19-data-directory-guide-rewrite"
plan: "19-01"
subsystem: "docs"
tags: ["documentation", "data-directory", "deckplan", "ships", "campaign"]
dependency_graph:
  requires: ["18-02"]
  provides: ["DATA_DIRECTORY_GUIDE.md updated for live state"]
  affects: []
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - DATA_DIRECTORY_GUIDE.md
decisions:
  - "Document data/ships/ (not data/locations/) — commit 456d9ab finalized the split after plan was written"
  - "orbit_map.yaml documents moons-only; stations and ships are self-registered at runtime"
  - "deckplan.yaml documents explicit-position door format (x/y/angle) as primary, wall+position as rect-room format"
metrics:
  duration: "~10 minutes"
  completed_date: "2026-05-06"
  tasks_completed: 3
  files_modified: 1
---

# Phase 19 Plan 01: DATA_DIRECTORY_GUIDE.md Rewrite Summary

## One-liner

Full rewrite of DATA_DIRECTORY_GUIDE.md to match the Phases 15–18 four-way data split: `campaign/`, `galaxy/`, `ships/`, `janus/` with pointer-field orbit injection.

## What Was Done

### Task 1: Read current guide

Read the full existing `DATA_DIRECTORY_GUIDE.md` (1,615 lines). Identified all outdated sections:
- Recursive `data/galaxy/` as the only discovery mechanism
- `manifest.yaml` multi-deck format
- `orbital_stations:` as a static section in `orbit_map.yaml`
- `inbox/`/`sent/` subdirectory as primary message format
- No mention of `data/campaign/`, `data/ships/`, per-entity character files, or `deckplan.yaml`

### Task 2 + 3: Write new guide / Remove outdated sections

Replaced 1,357 lines with 550 lines of accurate documentation covering:

1. **Four-way directory split** — campaign / galaxy / ships / janus with annotated tree
2. **Discovery mechanism** — galaxy tree scan + ships pointer-field injection + orbit map merging
3. **File types reference** — updated table with no manifest.yaml row
4. **Location self-registration** — `body_slug` + `orbital:` pattern with typo warning
5. **Ship section** — `ship.yaml` full schema reference with all systems and resources
6. **Characters section** — per-entity file format, id-matches-filename rule, uniqueness enforcement
7. **deckplan.yaml schema** — hull polygon, decks list, room shapes (rect/polygon/circle), door definitions (wall+position for rects; explicit x/y/angle for polygon/circle rooms), POI icons
8. **Adding a new location** — step-by-step for mobile vessel AND permanent installation
9. **Adding a new deck** — edit deckplan.yaml, set level:, data loader sorts automatically
10. **Galaxy reference** — star_map / system_map / orbit_map schemas (orbit_map moons-only note)
11. **Terminals and messages** — central message store, personal logs format
12. **JANUS config** — context.yaml schema
13. **Naming conventions** — slugs, galaxy vs ship namespace collision warning
14. **Planet textures** — categories and naming pattern
15. **Validation checklist** + **Troubleshooting**

## Deviations from Plan

### Auto-corrected: `data/locations/` vs `data/ships/`

The plan was written expecting `data/locations/` as the visitable-places directory. Commit `456d9ab` (post-plan, pre-execution) split this into `data/ships/` (mobile vessels) and nested `data/galaxy/.../` (permanent installations). The guide documents `data/ships/` — the actual live state — rather than `data/locations/`.

No other deviations.

## Known Stubs

None — this is a documentation-only plan.

## Threat Flags

None — documentation file only, no security surface introduced.

## Self-Check

### Files exist

- [x] `DATA_DIRECTORY_GUIDE.md` — confirmed written and committed

### Commits exist

- [x] `5149c40` — docs(19-01): rewrite DATA_DIRECTORY_GUIDE.md for Phases 15-18 live state

## Self-Check: PASSED
