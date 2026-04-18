---
phase: "15-data-directory-audit-and-bug-fixes"
plan: "15-01"
subsystem: "backend/data"
tags: [bug-fix, refactor, audit, data-loader, yaml, tooling]
dependency_graph:
  requires: ["12-01"]
  provides: ["clean-data-loader-baseline", "body-slug-validation-script"]
  affects: ["terminal/data_loader.py", "data/galaxy/*/system_map.yaml"]
tech_stack:
  added: []
  patterns: []
key_files:
  created:
    - tools/validate_body_slugs.py
    - .planning/phases/15-data-directory-audit-and-bug-fixes/15-01-AUDIT.md
  modified:
    - terminal/data_loader.py
    - data/galaxy/tau-ceti/system_map.yaml
    - data/galaxy/proxima-centauri/system_map.yaml
    - data/galaxy/ross-128/system_map.yaml
    - data/galaxy/epsilon-eridani/system_map.yaml
    - data/galaxy/luyten-star/system_map.yaml
    - data/galaxy/sol/system_map.yaml
    - data/galaxy/trappist-1/system_map.yaml
decisions:
  - "load_location() deleted — only call site was dead sync_campaign_data.py management command (targets models that no longer exist)"
  - "load_maps() deleted — searched maps/ plural directory that does not exist anywhere in the codebase"
  - "manifest key rename risk: deeply wired in frontend; any rename to deckplan requires coordinated change"
  - "slug: ship field in ship.yaml IS used — frontend reads shipData.slug for LocationTree node identity"
  - "validate_body_slugs.py placed in tools/ alongside svg_to_map.py; exits 0/1 for CI use"
metrics:
  duration_seconds: 182
  completed_date: "2026-04-17"
  tasks_completed: 6
  files_modified: 9
---

# Phase 15 Plan 01: Data Directory Audit + Bug Fixes Summary

**One-liner:** Fixed three data_loader.py bugs (undefined attribute, dead methods, duplicate return), stripped redundant has_orbit_map YAML field from 7 system maps, ran alignment audit documenting manifest/slug risks, and created body_slug validation script that immediately surfaced 5 missing galaxy directories.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Delete load_location() — undefined self.locations_dir | 89168e8 | terminal/data_loader.py |
| 2 | Remove duplicate return None in find_location_by_slug | 89168e8 | terminal/data_loader.py |
| 3 | Delete dead load_maps() method + convenience function | 89168e8 | terminal/data_loader.py |
| 4 | Strip has_orbit_map from 7 system_map.yaml files | c098cb9 | 7 YAML files |
| 5 | Alignment audit — manifest, slug, planets, total_decks | 5629776 | 15-01-AUDIT.md |
| 6 | Create tools/validate_body_slugs.py | ec9bc39 | tools/validate_body_slugs.py |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Additional Findings (Task 6 script output)

Running `python3 tools/validate_body_slugs.py` immediately revealed 5 body slugs in system_map.yaml files that reference non-existent galaxy directories:

- `epsilon-eridani-b` (Epsilon Eridani system)
- `proxima-c` (Proxima Centauri system)
- `mars` (Sol system)
- `tau-ceti-g` (Tau Ceti system)
- `trappist-1f` (TRAPPIST-1 system)

These are expected gaps — bodies with `location_slug` set but no corresponding data directory yet. Phase 18 should address these before migration. Logged here for Phase 18 planning.

## Alignment Audit Summary

| Check | Finding | Action Needed |
|-------|---------|---------------|
| `manifest` in TS types | Deeply wired in 5+ components | HIGH: coordinate rename with Phase 18 |
| `slug: ship` in ship.yaml | IS read by frontend as `shipData.slug` | None — field is active |
| `planets/stations` fields | Not consumed by frontend | Safe to restructure in Phase 18 |
| `total_decks` source | Read from both manifest obj and flattened activeView fields | None — both paths consistent |

## Known Stubs

None.

## Threat Flags

None — this plan is read-only bug fixes and tooling with no new network endpoints or auth paths.

## Self-Check: PASSED

- [x] terminal/data_loader.py modified — no load_location, load_maps, or locations_dir references remain
- [x] data/galaxy/*/system_map.yaml — 0 has_orbit_map fields remain (verified with grep)
- [x] tools/validate_body_slugs.py created and executable
- [x] 15-01-AUDIT.md created
- [x] All 4 task commits verified in git log:
  - 89168e8 — data_loader.py bug fixes (Tasks 1-3)
  - c098cb9 — has_orbit_map stripped (Task 4)
  - 5629776 — alignment audit (Task 5)
  - ec9bc39 — validate_body_slugs.py (Task 6)
