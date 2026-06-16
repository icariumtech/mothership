---
phase: 29-interactive-deckplan-map-editor-with-live-preview-yaml-sync-
plan: "02"
subsystem: frontend/deckplan-editor
tags: [yaml-cst, surgical-edits, vitest, pure-functions, id-range-map]
dependency_graph:
  requires: [29-01]
  provides: [buildIdRangeMap, deckToMapData, buildPositionEdit, buildAddPoiEdit]
  affects:
    - src/components/gm/views/deckplan/useDeckplanModel.ts
    - src/components/gm/views/deckplan/deckplanYamlEdits.ts
    - src/components/gm/views/deckplan/__fixtures__/deckplan.fixture.yaml
    - src/components/gm/views/deckplan/__tests__/useDeckplanModel.test.ts
    - src/components/gm/views/deckplan/__tests__/deckplanYamlEdits.test.ts
tech_stack:
  added: []
  patterns:
    - yaml CST parseDocument + LineCounter for byte-offset → line/col mapping
    - deck-scoped id→range map (key = deckId|kind|id) for collision-safe lookup
    - surgical position patch (replace whole position value node range, flow or block)
    - poi insertion via range end of last item (poi-exists) or after last deck key (poi-absent)
    - TDD RED/GREEN cycle with vitest
key_files:
  created:
    - src/components/gm/views/deckplan/__fixtures__/deckplan.fixture.yaml
    - src/components/gm/views/deckplan/useDeckplanModel.ts
    - src/components/gm/views/deckplan/deckplanYamlEdits.ts
    - src/components/gm/views/deckplan/__tests__/useDeckplanModel.test.ts
    - src/components/gm/views/deckplan/__tests__/deckplanYamlEdits.test.ts
  modified: []
decisions:
  - "Test files placed in __tests__/ subdirectory to match vitest.config.ts include pattern"
  - "parseYamlSafe exported from useDeckplanModel for test access to plain JS object"
  - "TDD: RED (a996efc) → GREEN (b355d19); no REFACTOR phase needed — code clean on first pass"
  - "Unused insertPos/insertCol removed in typecheck fix before GREEN commit"
metrics:
  duration: "~8 minutes"
  completed: "2026-06-16"
  tasks: 2
  files: 5
---

# Phase 29 Plan 02: YAML CST Parse Layer + Edit-Range Builders Summary

**One-liner:** Pure deckplan editor core — `yaml` CST id→range map builder, deck→MapData adapter, and surgical `buildPositionEdit`/`buildAddPoiEdit` functions; 36 vitest tests green covering deck-scoped collision, flow+block position patch, and both POI insertion branches.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create deckplan fixture + useDeckplanModel | fa52883 | `__fixtures__/deckplan.fixture.yaml`, `useDeckplanModel.ts` |
| 2 (RED) | Add failing vitest tests | a996efc | `__tests__/useDeckplanModel.test.ts`, `__tests__/deckplanYamlEdits.test.ts` |
| 2 (GREEN) | Implement deckplanYamlEdits | b355d19 | `deckplanYamlEdits.ts` |

## Verification Results

- `pnpm test src/components/gm/views/deckplan` — 36 tests, 0 failures (2 test files)
- `pnpm run typecheck` — clean, no new errors
- Deck-scoped collision: `main_deck|room|corridor_1` at line 25, `lower_deck|room|corridor_1` at line 47 — verified different lines
- buildPositionEdit flow-style: range covers `{x: 5, y: 4}` exactly (col 91-103 on the POI line)
- buildPositionEdit block-style: collapses multi-line `position:\n  x:\n  y:` to single-line flow
- buildAddPoiEdit poi-exists: inserts `\n    - {id: ..., name: "New POI", ...}` at correct position
- buildAddPoiEdit poi-absent: inserts `\n  poi:\n  - {id: ...}` without swallowing next deck

## TDD Gate Compliance

- RED gate: commit `a996efc` — `test(29-02)` — failing test file for `deckplanYamlEdits` (implementation absent)
- GREEN gate: commit `b355d19` — `feat(29-02)` — all 36 tests passing
- REFACTOR gate: N/A — code was clean after typecheck fix, no refactor needed

## Deviations from Plan

### Plan Adjustments

**1. [Rule 2 - Auto-fix] Test files placed in `__tests__/` subdirectory**
- **Found during:** Task 2 (RED)
- **Issue:** `vitest.config.ts` include pattern is `src/**/__tests__/**/*.test.{ts,tsx}` — flat placement at `deckplan/*.test.ts` would not be discovered by vitest
- **Fix:** Placed test files in `src/components/gm/views/deckplan/__tests__/` matching the existing project convention (see `src/utils/__tests__/polygon2d.test.ts`)
- **Files modified:** Test files created at `__tests__/` path instead of plan-specified `deckplan/` path
- **Impact:** None — same behavior, tests discovered and run correctly

## Pre-existing Test Failures (Out of Scope)

Two pre-existing failures found when running the full suite in the worktree (not caused by this plan):

| Failure | Root Cause | Status |
|---------|-----------|--------|
| `migratedMaps.test.ts > normalizes doors in data/galaxy/tau-ceti/somnus/map/main_deck.yaml` | Plan 01 deleted `data/ships/somnus/map/main_deck.yaml`; `migratedMaps.test.ts` still references the legacy path | Deferred — fix required in `migratedMaps.test.ts` to remove the deleted somnus legacy path |
| `migratedMaps.test.ts > normalizes doors in data/campaign/ship/deckplan.yaml` | Missing `data/campaign/ship/deckplan.yaml` — geometry incompatibility between `engine_room` and `lower_corridor_2` | Pre-existing, not introduced by this phase |

Logged to `.planning/phases/29-interactive-deckplan-map-editor-with-live-preview-yaml-sync-/deferred-items.md`.

## Known Stubs

None — both modules are pure functions with complete implementations. The `poi_${Date.now()}` id in `buildAddPoiEdit` is intentional (auto-generated unique id for new POIs, not a stub).

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. The pure functions operate on in-memory YAML text and return plain TextEdit objects; no file I/O or DOM access.

## Self-Check: PASSED

- `src/components/gm/views/deckplan/__fixtures__/deckplan.fixture.yaml` — EXISTS
- `src/components/gm/views/deckplan/useDeckplanModel.ts` — EXISTS
- `src/components/gm/views/deckplan/deckplanYamlEdits.ts` — EXISTS
- `src/components/gm/views/deckplan/__tests__/useDeckplanModel.test.ts` — EXISTS
- `src/components/gm/views/deckplan/__tests__/deckplanYamlEdits.test.ts` — EXISTS
- Commit fa52883 — FOUND (feat: fixture + useDeckplanModel)
- Commit a996efc — FOUND (test: RED phase tests)
- Commit b355d19 — FOUND (feat: deckplanYamlEdits GREEN)
- 36 tests passing, 0 failures
- TypeScript typecheck clean
- No unintended file deletions
