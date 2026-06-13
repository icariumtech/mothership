---
phase: 29
slug: interactive-deckplan-map-editor-with-live-preview-yaml-sync
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-13
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | No frontend test runner detected (`package.json` scripts: `dev`, `build`, `typecheck`, lint only). Backend has Django's standard `python manage.py test` runner, but no existing tests under `core/` for `data_loader.py` or `views/encounter.py` (confirm with `find core -path '*test*'`). |
| **Config file** | none — see Wave 0 |
| **Quick run command** | `pnpm run typecheck` |
| **Full suite command** | `pnpm run typecheck && pnpm run build` (+ `python manage.py test` for Plan 1 backend changes, if/once Django tests exist) |
| **Estimated runtime** | ~30-60s (typecheck+build); Django test suite TBD |

---

## Sampling Rate

- **After every task commit:** Run `pnpm run typecheck`
- **After every plan wave:** Run `pnpm run typecheck && pnpm run build`; for Plan 1 (legacy removal/migration), also run `python manage.py test` (if/once backend tests exist) plus a manual check that `/api/encounter-map/<somnus-slug>/` and `/api/encounter-map/<somnus-slug>/all-decks/` return non-error JSON after migration.
- **Before `/gsd:verify-work`:** Full suite must be green + manual UAT walkthrough of EDIT-02..06 (this phase has no automated frontend test runner, so UAT carries significant weight for the interactive/visual behaviors).
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 29-01-xx | 01 | 1 | EDIT-01 | — | N/A | unit/integration | `python manage.py test core.tests.test_data_loader` (or equivalent) | ❌ W0 | ⬜ pending |
| 29-0x-xx | 0x | x | EDIT-02 | — | N/A | manual/smoke | manual UAT (visual) | ❌ W0 (no frontend runner) | ⬜ pending |
| 29-0x-xx | 0x | x | EDIT-03 | — | N/A | manual/smoke | manual UAT | ❌ W0 | ⬜ pending |
| 29-0x-xx | 0x | x | EDIT-04 | — | N/A | unit (id→range map) + manual E2E | unit test for `buildIdRangeMap()` against fixture YAML | ❌ W0 — needs new test file + fixture | ⬜ pending |
| 29-0x-xx | 0x | x | EDIT-05 | — | N/A | unit (edit-range builder) + manual | unit test for `buildPositionEdit()` against fixture YAML | ❌ W0 | ⬜ pending |
| 29-0x-xx | 0x | x | EDIT-06 | — | N/A | unit (edit-range builder) + manual | unit test for `buildAddPoiEdit()` against fixture YAML | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs above are placeholders (`29-0x-xx`) until the planner assigns concrete plan/task numbers — the planner should update this table with final IDs.*

---

## Wave 0 Requirements

- [ ] Fixture file: a small representative `deckplan.yaml` excerpt (2-room, 1-POI, from `patrol_gunboat/deckplan.yaml`) for frontend unit tests of `buildIdRangeMap`, `buildPositionEdit`, `buildAddPoiEdit`
- [ ] Decide on a lightweight unit-test runner for the new pure functions (`vitest` pairs naturally with Vite — `[ASSUMED]` not installed; confirm with `pnpm ls vitest` and `pnpm view vitest version` before adding)
- [ ] `core/tests/test_data_loader.py` (or project's existing Django test location) — covers EDIT-01 (load_deckplan path for somnus post-migration, absence of legacy loader methods)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live map preview renders below Monaco when a `deckplan.yaml` is opened | EDIT-02 | No frontend test runner; visual rendering | Open a `deckplan.yaml` (e.g. `data/ships/patrol_gunboat/deckplan.yaml`) in the GM Console file editor and confirm the preview pane appears below Monaco |
| Deck selector switches the rendered deck | EDIT-03 | Visual/interactive | Use the deck selector and confirm the preview re-renders the chosen deck |
| Click room/POI on preview reveals + highlights the corresponding YAML line in Monaco | EDIT-04 | Visual/interactive, depends on real Monaco instance | Click a room and a POI on the preview; confirm Monaco scrolls to and highlights the matching `id:` line, deck-scoped |
| Drag POI moves it; click empty cell adds POI stub; both write back as surgical patches with no reformatting | EDIT-05, EDIT-06 | Visual/interactive; verifying "no reserialize" requires diffing the saved file | Drag a POI and click an empty cell; save; diff the file against pre-edit version to confirm only the targeted lines changed (flow-style formatting/comments preserved) |
| Somnus deckplan loads correctly post-migration | EDIT-01 | End-to-end smoke across migrated data | Load `/api/encounter-map/somnus/` and `/api/encounter-map/somnus/all-decks/`, confirm non-error JSON and correct deck/room data |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
