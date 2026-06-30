# Roadmap: Mothership GM Terminal

## Milestones

- ✅ **v1.0 MVP** — Phases 1–20 (shipped 2026-05-07)
- ✅ **v2.0 AI Tooling** — Phases 21–28 + 28.1 (shipped 2026-06-12)
- 🚧 **v3.0 Better Deckplans** — Phase 29, 31–33 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–20) — SHIPPED 2026-05-07</summary>

- [x] Phase 1: Campaign Logs Tab (2/2 plans) — completed 2026-02-12
- [x] Phase 2: Ship Status Dashboard (3/3 plans) — completed 2026-02-12
- [x] Phase 3: Encounter Tokens (4/4 plans) — completed 2026-02-21
- [x] Phase 4: NPC Portrait System (4/4 plans) — completed 2026-02-21
- [x] Phase 5: Real-Time Push Architecture (4/4 plans) — completed 2026-03-01
- [x] Phase 6: UI Audio System — DEFERRED
- [x] Phase 7: Grid-Based Encounter Map Redesign (4/4 plans) — completed 2026-03-16
- [x] Phase 8: Rework GM Console UI (4/4 plans) — completed 2026-03-16
- [x] Phase 9: Integration + GM Bridge Polish (2/2 plans) — completed 2026-03-20
- [x] Phase 10: Player Ship Map View (3/3 plans) — completed 2026-03-24
- [x] Phase 11: Close Functional + Security Gaps (1/1 plan) — completed 2026-03-24
- [x] Phase 12: Requirements Tracking + Dead Code Cleanup (1/1 plan) — completed 2026-04-17
- [x] Phase 13: Atmospheric UI Animations (5/5 plans) — completed 2026-03-28
- [x] Phase 14: Rework Bridge STATUS Tab (3/3 plans) — completed 2026-04-07
- [x] Phase 15: Data Directory Audit + Bug Fixes (1/1 plan) — completed 2026-04-18
- [x] Phase 16: Ship Data Consolidation (1/1 plan) — completed 2026-04-18
- [x] Phase 17: Characters Per-Entity Files (1/1 plan) — completed 2026-04-18
- [x] Phase 18: Locations Flat Directory (2/2 plans) — completed 2026-04-20
- [x] Phase 19: DATA_DIRECTORY_GUIDE.md Rewrite (1/1 plan) — completed 2026-05-06
- [x] Phase 20: Audit Closure — Security + Requirements Tracking (3/3 plans) — completed 2026-05-07

See `.planning/milestones/v1.0-ROADMAP.md` for full phase details.

</details>

<details>
<summary>✅ v2.0 AI Tooling (Phases 21–28 + 28.1) — SHIPPED 2026-06-12</summary>

- [x] Phase 21: Encounter Geometry Deepening (5/5 plans) — completed 2026-05-11
- [x] Phase 22: Renderer Interaction Seams (3/3 plans) — completed 2026-05-14
- [x] Phase 23: Containerization — Docker + MCP server (7/7 plans) — completed 2026-05-18
- [x] Phase 24: JANUS Skills — Claude Code skill library (7/7 plans) — completed 2026-05-22
- [x] Phase 25: Map Rotation Controls (5/5 plans) — completed 2026-05-24
- [x] Phase 26: Map Polish — labels, hit targets, centering (ad-hoc, commit `33e3e07`) — completed 2026-05-25
- [x] Phase 27: MCP Image Upload (3/3 plans) — completed 2026-05-27
- [x] Phase 28: GM Console Data Directory File Editor (3/3 plans) — completed 2026-06-01
- [x] Phase 28.1: Close Gap D-10 + Phase 28 UAT + VERIFICATION ×3 (INSERTED) (3/3 plans) — completed 2026-06-05

See `.planning/milestones/v2.0-ROADMAP.md` for full phase details.

</details>

### 🚧 v3.0 Better Deckplans (Phase 31–33)

- [x] Phase 29: Interactive deckplan map editor with live preview, YAML sync, and POI placement — completed 2026-06-30
  - **Goal:** Give the GM a visual way to author deckplan maps — consolidate on `deckplan.yaml` as the sole format, then extend the GM Console file editor with a live map preview, deck selector, click-to-jump, and POI placement/move via surgical text edits.
  - **Depends on:** Phase 28
  - **Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06
  - **Success Criteria** (what must be TRUE):
    1. Every location's deckplan loads from `deckplan.yaml` only — somnus migrated, legacy `map/manifest.yaml` + per-deck `map/*.yaml` loaders and fallback branches removed
    2. GM opens a `deckplan.yaml` in the file editor and sees a live rendered map preview below Monaco
    3. GM can switch which deck the preview renders via a deck selector
    4. GM clicks a room or POI on the preview and Monaco reveals + highlights the corresponding YAML line
    5. GM can drag a POI to move it or click an empty cell to add a POI stub, with both written back as surgical text patches (no reserialize)
  - **Plans:** 4 plans
    - [x] 29-01-PLAN.md — Consolidate on deckplan.yaml: migrate somnus, remove legacy loaders/fallbacks, schema doc + Django test (Wave 1)
    - [x] 29-02-PLAN.md — Pure YAML model + surgical edit builders (buildIdRangeMap/buildPositionEdit/buildAddPoiEdit) + vitest fixture/tests (Wave 2)
    - [x] 29-03-PLAN.md — Renderer POI editor props + DeckSelector + DeckplanPreviewPane mounted below Monaco (Wave 3)
    - [x] 29-04-PLAN.md — Wire click-to-jump, POI drag-to-move, click-to-add into Monaco + human-verify checkpoint (Wave 4)
  - Context: `.planning/phases/29-interactive-deckplan-map-editor-with-live-preview-yaml-sync-/29-CONTEXT.md`

- [x] Phase 30: AI map editing — element resolver + targeted edit MCP tools (3/3 plans) — completed 2026-06-06 (executed out of order, ahead of Phase 29; ad-interim, not v3.0 scope)
  - **Goal:** Let the JANUS AI edit a single deckplan element (room/corridor/door) and add/remove POIs without reading or rewriting the whole `deckplan.yaml`. Adds a server-side element resolver (id / slugified label / glob / fuzzy), an atomic targeted-edit endpoint (`set` field-merge + `add_poi`/`remove_poi` list verbs) with `data-changed` SSE, two MCP tools (`find_map_element`, `edit_map_element`), and deterministic human-readable element ids from `svg_to_map.py`. Independent of Phase 29's GUI editor but provides a resolution layer it can reuse.
  - **Requirements**: E-01–E-07 (defined in 30-CONTEXT.md)
  - Plans:
    - [x] 30-01-PLAN.md — Backend: `_resolve_map_element` + `api_gm_data_map_edit` endpoint + tests (Wave 1)
    - [x] 30-02-PLAN.md — Stable element ids — already satisfied (slug+unique exists; doors use derived id) (Wave 1)
    - [x] 30-03-PLAN.md — MCP tools `find_map_element`/`edit_map_element` + schema docs (Wave 2)

- [ ] Phase 31: Deckplan Format — Per-Deck Hulls & Detail Linework
  - **Goal:** Extend the `deckplan.yaml` schema and `EncounterMapRenderer` so decks can declare their own hull geometry and decorative detail linework, with interior details gated by room reveal.
  - **Depends on:** Phase 29 (deckplan.yaml is the sole format; editor preview benefits from but does not require this)
  - **Requirements**: HULL-01, HULL-02, DET-01, DET-03
  - **Success Criteria** (what must be TRUE):
    1. A deck in `deckplan.yaml` can declare its own hull polygon that overrides the location-level hull when present
    2. A deck hull can consist of multiple disjoint polygons (pods, nacelles, detached modules), and the renderer draws each correctly
    3. `deckplan.yaml` supports decorative detail linework attached to a room and to the deck exterior, and `EncounterMapRenderer` draws it
    4. Players viewing an unrevealed room do not see its interior detail linework; once revealed, the details appear
    5. Exterior/hull detail linework is always visible regardless of room reveal state
  - **Plans:** 0 plans (run `/gsd:plan-phase 31` to break down)
  - **UI hint**: yes

- [ ] Phase 32: SVG Converter — Details, Per-Deck Hulls, Circular Rooms
  - **Goal:** Extend `tools/svg_to_map.py` to emit the new Phase 31 schema fields and circular rooms, so Inkscape-authored decks convert directly into richer `deckplan.yaml` output.
  - **Depends on:** Phase 31 (emits the format Phase 31 defines)
  - **Requirements**: DET-02, HULL-03, CIRC-01
  - **Success Criteria** (what must be TRUE):
    1. Running `svg_to_map.py` on an SVG with a "Details" sublayer produces detail linework entries in the output `deckplan.yaml`, correctly associated with their room or the deck exterior
    2. Running `svg_to_map.py` on an SVG with per-deck "Hull" sublayers produces per-deck hull polygons (including multi-polygon hulls) in the output
    3. Running `svg_to_map.py` on an SVG containing `<circle>`/`<ellipse>` elements in a room layer produces `circle` room entries in the output, renderable by the existing renderer
    4. Converted output remains valid per `docs/schemas/schema-encounters.md`, updated in the same commit as the format change
  - **Plans:** 0 plans (run `/gsd:plan-phase 32` to break down)

- [ ] Phase 33: Isometric View
  - **Goal:** Add an isometric projection alongside the existing top-down view, with a live toggle on both the player encounter view and the GM console map.
  - **Depends on:** Phase 31 (details/hulls must project correctly in iso)
  - **Requirements**: ISO-01, ISO-02, ISO-03
  - **Success Criteria** (what must be TRUE):
    1. Any deckplan can render in an isometric projection via the existing `gridProjection`/`mapView` seam — rooms, doors, vents, POIs, tokens, and detail linework all appear correctly positioned
    2. Players can toggle the encounter view between top-down and isometric, with the change applying live (a cut, not an animated transition)
    3. The GM can independently toggle the GM console map between top-down and isometric, live
  - **Plans:** 0 plans (run `/gsd:plan-phase 33` to break down)
  - **UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1–20 (see v1.0 archive) | v1.0 | 49/49 | ✓ Complete | 2026-05-07 |
| 21. Encounter Geometry Deepening | v2.0 | 5/5 | ✓ Complete | 2026-05-11 |
| 22. Renderer Interaction Seams | v2.0 | 3/3 | ✓ Complete | 2026-05-14 |
| 23. Containerization | v2.0 | 7/7 | ✓ Complete | 2026-05-18 |
| 24. JANUS Skills | v2.0 | 7/7 | ✓ Complete | 2026-05-22 |
| 25. Map Rotation Controls | v2.0 | 5/5 | ✓ Complete | 2026-05-24 |
| 26. Map Polish (ad-hoc) | v2.0 | — | ✓ Complete (ad-hoc) | 2026-05-25 |
| 27. MCP Image Upload | v2.0 | 3/3 | ✓ Complete | 2026-05-27 |
| 28. GM Console File Editor | v2.0 | 3/3 | ✓ Complete | 2026-06-01 |
| 28.1. Audit Gap Closure (INSERTED) | v2.0 | 3/3 | ✓ Complete | 2026-06-05 |
| 29. Deckplan Map Editor | v3.0 | 4/4 | ✓ Complete | 2026-06-30 |
| 30. AI Map Editing MCP Tools | (ad-interim) | 3/3 | ✓ Complete | 2026-06-06 |
| 31. Deckplan Format — Hulls & Details | v3.0 | 0/? | Not started | - |
| 32. SVG Converter — Details/Hulls/Circles | v3.0 | 0/? | Not started | - |
| 33. Isometric View | v3.0 | 0/? | Not started | - |
