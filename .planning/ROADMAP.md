# Roadmap: Mothership GM Terminal

## Milestones

- ✅ **v1.0 MVP** — Phases 1–20 (shipped 2026-05-07)
- ✅ **v2.0 AI Tooling** — Phases 21–28 + 28.1 (shipped 2026-06-12)
- 📋 **Next milestone** — Phase 29 onward (run `/gsd:new-milestone` to define)

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

### 📋 Post-v2.0 (next milestone TBD)

- [ ] Phase 29: Interactive deckplan map editor with live preview, YAML sync, and POI placement
  - **Goal:** [To be planned — context gathered 2026-06-05]
  - **Requirements**: TBD
  - **Depends on:** Phase 28
  - **Plans:** 0 plans (run `/gsd:plan-phase 29` to break down)
  - Context: `.planning/phases/29-interactive-deckplan-map-editor-with-live-preview-yaml-sync-/29-CONTEXT.md`

- [x] Phase 30: AI map editing — element resolver + targeted edit MCP tools (3/3 plans) — completed 2026-06-06 (executed out of order, ahead of Phase 29)
  - **Goal:** Let the JANUS AI edit a single deckplan element (room/corridor/door) and add/remove POIs without reading or rewriting the whole `deckplan.yaml`. Adds a server-side element resolver (id / slugified label / glob / fuzzy), an atomic targeted-edit endpoint (`set` field-merge + `add_poi`/`remove_poi` list verbs) with `data-changed` SSE, two MCP tools (`find_map_element`, `edit_map_element`), and deterministic human-readable element ids from `svg_to_map.py`. Independent of Phase 29's GUI editor but provides a resolution layer it can reuse.
  - **Requirements**: E-01–E-07 (defined in 30-CONTEXT.md)
  - Plans:
    - [x] 30-01-PLAN.md — Backend: `_resolve_map_element` + `api_gm_data_map_edit` endpoint + tests (Wave 1)
    - [x] 30-02-PLAN.md — Stable element ids — already satisfied (slug+unique exists; doors use derived id) (Wave 1)
    - [x] 30-03-PLAN.md — MCP tools `find_map_element`/`edit_map_element` + schema docs (Wave 2)

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
| 29. Deckplan Map Editor | TBD | 0/? | Context gathered | - |
| 30. AI Map Editing MCP Tools | TBD | 3/3 | ✓ Complete | 2026-06-06 |
