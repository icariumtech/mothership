---
phase: 29
slug: interactive-deckplan-map-editor-with-live-preview-yaml-sync
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-13
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **vitest IS installed** — `package.json` scripts: `test` → `vitest run`, `test:watch`, `test:ui` (corrects RESEARCH's "no runner" assumption; `node_modules/.bin/vitest` present). Backend uses Django's `python manage.py test`; existing tests live in `core/tests/` (`test_gm_api.py`, `test_upload_image.py`). |
| **Config file** | vitest configured via Vite (existing). New tests: `src/components/gm/views/deckplan/*.test.ts`. |
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
| 29-01-03 | 01 | 1 | EDIT-01 | T-29-02 | N/A | unit/integration | `python manage.py test core.tests.test_data_loader` | ✅ created in 29-01 T3 | ⬜ pending |
| 29-02-02 | 02 | 2 | EDIT-04 | T-29-03 | N/A | unit (id→range map) | `pnpm test src/components/gm/views/deckplan` (buildIdRangeMap) | ✅ created in 29-02 (fixture + test) | ⬜ pending |
| 29-02-02 | 02 | 2 | EDIT-05 | T-29-03 | N/A | unit (edit-range builder) | `pnpm test src/components/gm/views/deckplan` (buildPositionEdit) | ✅ created in 29-02 | ⬜ pending |
| 29-02-02 | 02 | 2 | EDIT-06 | T-29-03 | N/A | unit (edit-range builder) | `pnpm test src/components/gm/views/deckplan` (buildAddPoiEdit) | ✅ created in 29-02 | ⬜ pending |
| 29-03-03 | 03 | 3 | EDIT-02 | T-29-07 | N/A | build/smoke + manual | `pnpm run typecheck && pnpm run build`; manual UAT (preview renders) | ✅ typecheck/build | ⬜ pending |
| 29-03-02 | 03 | 3 | EDIT-03 | — | N/A | build/smoke + manual | `pnpm run typecheck && pnpm run build`; manual UAT (deck switch) | ✅ typecheck/build | ⬜ pending |
| 29-04-01 | 04 | 4 | EDIT-04 | T-29-08 | N/A | build + manual E2E | `pnpm run typecheck`; checkpoint 29-04 T3 step 4 | ✅ build | ⬜ pending |
| 29-04-02 | 04 | 4 | EDIT-05 | T-29-08 | N/A | build + manual E2E | `pnpm run build`; checkpoint 29-04 T3 step 5 (git diff) | ✅ build | ⬜ pending |
| 29-04-02 | 04 | 4 | EDIT-06 | T-29-08 | N/A | build + manual E2E | `pnpm run build`; checkpoint 29-04 T3 step 6 | ✅ build | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs assigned by the planner (format `29-{plan}-{task}`). EDIT-04/05/06 are unit-tested in Plan 02 (pure builders) and exercised end-to-end via the Plan 04 human-verify checkpoint.*

---

## Wave 0 Requirements

Resolved during planning — no separate Wave 0 plan needed (test infra already exists):

- [x] **Runner decision:** vitest is already installed (`pnpm test` → `vitest run`); no install required. RESEARCH's "no frontend runner" assumption was incorrect (verified `node_modules/.bin/vitest` + `package.json` scripts).
- [→] Fixture `src/components/gm/views/deckplan/__fixtures__/deckplan.fixture.yaml` (2-deck, id-collision, 1 flow-style POI) — created in **Plan 02 Task 1**.
- [→] `deckplanYamlEdits.test.ts` + `useDeckplanModel.test.ts` (buildIdRangeMap/buildPositionEdit/buildAddPoiEdit) — created in **Plan 02 Task 2**.
- [→] `core/tests/test_data_loader.py` (EDIT-01: somnus deckplan load + absence of legacy loaders) — created in **Plan 01 Task 3** (follows existing `core/tests/test_gm_api.py` style).

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (folded into Plans 01/02)
- [x] No watch-mode flags (vitest run, not watch)
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned (task IDs assigned 2026-06-13)
