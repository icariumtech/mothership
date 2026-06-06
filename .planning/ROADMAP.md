# Roadmap: Mothership GM Terminal

## Milestones

- ✅ **v1.0 MVP** — Phases 1–20 (shipped 2026-05-07)
- 🚧 **v2** — Phase 21 onward

## Phases

### v2 (in progress)

- [x] Phase 21: Encounter Geometry Deepening (5 plans) — planned 2026-05-08 (completed 2026-05-11)
  - Lift `EncounterMapRenderer.tsx` (1895 LOC) into a four-module geometry stack (`polygon2d`, `roomGeometry`, `gridProjection`, `mapView`); rework door model to top-level canonical `Door`; extract reveal-cascade scheduler. Adds Vitest infrastructure. Future iso/rotation view becomes a one-line projection swap.
  - See `.planning/phases/21-encounter-geometry-deepening/`

- [x] Phase 22: Renderer Interaction Seams — planned 2026-05-13 (completed 2026-05-14)
  - **Goal:** Extract `useExclusivePopover` and `useTokenPlacement` hooks from `EncounterMapRenderer.tsx`, completing the renderer interaction decomposition. After both hooks land, the renderer holds no interaction state machines — all geometry, projection, reveal-cascade, pan/zoom, token placement, and popover coordination sit behind named seams. `usePanZoom` was already extracted ad-hoc after Phase 21.
  - **Plans:** 3 plans
  - Plans:
    - [x] 22-01-PLAN.md — Create `useExclusivePopover` hook + wire renderer's four popover slots through it (Wave 1)
    - [x] 22-02-PLAN.md — Create `useTokenPlacement` hook + wire renderer's drag/drop handlers through it (Wave 2)
    - [x] 22-03-PLAN.md — Static + human smoke verification, orphan-import cleanup (Wave 3, has checkpoint)
  - See `.planning/phases/22-renderer-interaction-seams/`

<details>
<summary>✅ v1.0 MVP (Phases 1–20) — SHIPPED 2026-05-07</summary>

- [x] Phase 1: Campaign Logs Tab (2/2 plans) — completed 2026-02-12
- [x] Phase 2: Ship Status Dashboard (3/3 plans) — completed 2026-02-12
- [x] Phase 3: Encounter Tokens (4/4 plans) — completed 2026-02-21
- [x] Phase 4: NPC Portrait System (4/4 plans) — completed 2026-02-21
- [x] Phase 5: Real-Time Push Architecture (4/4 plans) — completed 2026-03-01
- [x] Phase 6: UI Audio System — DEFERRED to v2
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

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Campaign Logs Tab | v1.0 | 2/2 | ✓ Complete | 2026-02-12 |
| 2. Ship Status Dashboard | v1.0 | 3/3 | ✓ Complete | 2026-02-12 |
| 3. Encounter Tokens | v1.0 | 4/4 | ✓ Complete | 2026-02-21 |
| 4. NPC Portrait System | v1.0 | 4/4 | ✓ Complete | 2026-02-21 |
| 5. Real-Time Push Architecture | v1.0 | 4/4 | ✓ Complete | 2026-03-01 |
| 6. UI Audio System | v2 | — | Deferred to v2 | - |
| 7. Grid-Based Encounter Map | v1.0 | 4/4 | ✓ Complete | 2026-03-16 |
| 8. Rework GM Console UI | v1.0 | 4/4 | ✓ Complete | 2026-03-16 |
| 9. Integration + GM Bridge Polish | v1.0 | 2/2 | ✓ Complete | 2026-03-20 |
| 10. Player Ship Map View | v1.0 | 3/3 | ✓ Complete | 2026-03-24 |
| 11. Close Functional + Security Gaps | v1.0 | 1/1 | ✓ Complete | 2026-03-24 |
| 12. Requirements Tracking + Cleanup | v1.0 | 1/1 | ✓ Complete | 2026-04-17 |
| 13. Atmospheric UI Animations | v1.0 | 5/5 | ✓ Complete | 2026-03-28 |
| 14. Rework Bridge STATUS Tab | v1.0 | 3/3 | ✓ Complete | 2026-04-07 |
| 15. Data Directory Audit + Bug Fixes | v1.0 | 1/1 | ✓ Complete | 2026-04-18 |
| 16. Ship Data Consolidation | v1.0 | 1/1 | ✓ Complete | 2026-04-18 |
| 17. Characters Per-Entity Files | v1.0 | 1/1 | ✓ Complete | 2026-04-18 |
| 18. Locations Flat Directory | v1.0 | 2/2 | ✓ Complete | 2026-04-20 |
| 19. DATA_DIRECTORY_GUIDE.md Rewrite | v1.0 | 1/1 | ✓ Complete | 2026-05-06 |
| 20. Audit Closure | v1.0 | 3/3 | ✓ Complete | 2026-05-07 |
| 21. Encounter Geometry Deepening | v2 | 5/5 | ✓ Complete | 2026-05-11 |
| 22. Renderer Interaction Seams | v2 | 3/3 | ✓ Complete  | 2026-05-14 |
| 23. Containerization           | v2 | 7/7 | ✓ Complete  | 2026-05-18 |
| 25. Map Rotation Controls      | v2 | 5/5 | ✓ Complete  | 2026-05-24 |
| 26. Map polish (ad-hoc)        | v2 | —   | ✓ Complete (ad-hoc) | 2026-05-25 |
| 27. MCP Image Upload           | v2 | 3/3 | ✓ Complete  | 2026-05-27 |
| 28. GM Console File Editor     | v2 | 3/3 | Complete   | 2026-06-01 |

### Phase 23: Containerization — Docker image with external data directory mount, live-reload for AI-managed game data, and best-practices for remote data mutations during play

**Goal:** Package the Mothership GM Terminal as a portable Docker image published to GHCR. Campaign data lives on an external mounted volume. A remote AI game-master agent connects via MCP to read and write YAML data files during live play. Homelab server runs `docker compose up` — no local build required.
**Requirements**: D-01–D-17 (see 23-CONTEXT.md)
**Depends on:** Phase 22
**Plans:** 7/7 plans complete

**Wave 1** (parallel — no dependencies):

- [x] 23-01-PLAN.md — Django production config: WhiteNoise static serving, env-driven settings, DataLoader DATA_DIR, Gunicorn gevent config, SSE announce_generic method
- [x] 23-02-PLAN.md — Dockerfile multi-stage build (Vite → Django) + docker-entrypoint.sh first-run init

**Wave 2** *(blocked on Wave 1 — 23-01)*:

- [x] 23-03-PLAN.md — GM data REST API (list/read/write/session-context/data-schema endpoints) + Wave 0 behavioral tests with path-traversal defense

**Wave 3** *(blocked on Wave 2 — 23-01, 23-02, 23-03)*:

- [x] 23-04-PLAN.md — FastMCP server (5 MCP tools calling Django API over HTTP transport, port 8001)

**Wave 4** *(blocked on Wave 3 — 23-02, 23-04)*:

- [x] 23-05-PLAN.md — docker-compose.yml (two services, shared data volumes) + GitHub Actions GHCR publish workflow

**Gap closure** *(parallel — no dependencies between plans; remediates VERIFICATION.md gap + REVIEW.md critical/warning findings)*:

- [x] 23-06.1-PLAN.md — Fix Dockerfile pnpm→npm lockfile mismatch + reorder docker-entrypoint.sh CMD guard above migrate (VERIFICATION blocker + CR-01)
- [x] 23-06.2-PLAN.md — Harden settings.py defaults (SECRET_KEY required, DEBUG=False, ALLOWED_HOSTS loopback) + add app healthcheck and mcp service_healthy dependency + Dockerfile BUILD_SECRET_KEY ARG (CR-02, WR-03, WR-04)

### Phase 24: JANUS Skills — Claude Code skill library for AI-driven campaign data management

**Goal:** Create a `janus-skills` repository containing Claude Code skill files that encode the DATA_DIRECTORY_GUIDE into focused, task-specific workflows. Skills use the JANUS MCP server (port 8001) to read and write campaign YAML data. Enables both GM-driven manual workflows (add NPC, move ship, generate location context) and automated AI agent pipelines (Obsidian → janus.yaml generation).
**Depends on:** Phase 23

**Plans:** 7/7 plans complete

Plans:

- [x] 24-01-PLAN.md — Scaffold janus-skills repo (gitignore, mcp-config-template.json, resources/skills directories) (Wave 1)
- [x] 24-02-PLAN.md — Author 5 schema resource files in resources/ (Wave 2)
- [x] 24-03-PLAN.md — Author install.sh with --global / --project / --mcp-config modes (Wave 2)
- [x] 24-04-PLAN.md — Author 4 SKILL.md files (janus-add-npc, janus-add-location, janus-add-system, janus-add-body) + README (Wave 3)
- [x] 24-05-PLAN.md — Author 4 SKILL.md files (janus-add-ship, janus-update-galaxy, janus-generate-context, janus-session-prep) (Wave 4)
- [x] 24-06-PLAN.md — GAP CLOSURE: fix install.sh skills glob (CR-01), atomic settings write (CR-02), portable realpath (WR-06) (Wave 5)
- [x] 24-07-PLAN.md — GAP CLOSURE: fix janus-add-ship deckplan format (CR-03), janus-add-npc id formula (WR-01), janus-add-location moon depth + ship redirect (WR-03) (Wave 5)

**Cross-cutting constraints:**

- All services use the same GHCR image tag (`ghcr.io/{owner}/mothership`)
- Both `app` and `mcp` services mount `./data:/app/data` and `./db.sqlite3:/app/db.sqlite3`
- No authentication on GM data API (trust-the-network model — homelab only)
- Gunicorn workers=1 (SSE is per-process; multi-worker Redis upgrade is a future phase)

### Phase 25: Map rotation controls

**Goal:** Add playback controls (play/pause + horizontal scrub bar) to all three 3D map views (galaxy, system, orbit). Galaxy gets a play/pause button that toggles the existing `sceneStore.animations.autoRotate`; system and orbit get play/pause plus a horizontal drag-zone scrub bar (active only when paused) that advances/reverses orbital positions of planets and moons/stations. Controls render as a CRT-style overlay pill (`[ ⏸ |==scrub==| ]`) at top-center of each map, outside the R3F Canvas. Designed for large-touch-TV GM interaction (≥44px button targets). Scrub speed is adaptive — calibrated to the shortest orbital period in the scene by default, or to the selected body's period when one is selected.
**Requirements**: D-01–D-13 (see 25-CONTEXT.md)
**Depends on:** Phase 24
**Plans:** 5/5 plans executed — COMPLETE (GM sign-off 2026-05-24)
**Note:** Overlay shipped as a circular Chronoscope (iPod-style click wheel, lower-right) rather than the spec'd horizontal pill; functional contract (play/pause + adaptive scrub on all three maps) unchanged. See 25-05-SUMMARY.md "Design Evolution".

Plans:

**Wave 1** (no dependencies):

- [x] 25-01-PLAN.md — Create stateless `MapPlaybackControls.tsx` + CSS (CRT pill, play/pause button, scrub drag zone with pointer capture)

**Wave 2** (parallel — all blocked only on Wave 1):

- [x] 25-02-PLAN.md — Wire `MapPlaybackControls` into `GalaxyMap.tsx` (showScrub=false, toggles `sceneStore.animations.autoRotate` without `recordInteraction()`)
- [x] 25-03-PLAN.md — Extend `SystemScene` with `orbitsPaused` + `scrubOffsetRef` props; wire `SystemMap` with local `isOrbiting` state, adaptive scrub-speed formula, and overlay
- [x] 25-04-PLAN.md — Extend `OrbitScene` with `orbitsPaused` + `scrubOffsetRef` (alongside existing `animationPaused`); thread to moon/station children; wire `OrbitMap` overlay

**Wave 3** (blocked on Wave 2):

- [x] 25-05-PLAN.md — Typecheck + build + GM smoke test (approved 2026-05-24; control redesigned to Chronoscope during verification)

### Phase 26: Map polish — planet name labels, larger hit targets, and map view centering

**Goal:** Ad-hoc polish pass on the 3D map views: display planet name labels in orbit view, increase clickable hit targets for system/orbit bodies, and center the map view on the active selection.
**Depends on:** Phase 25
**Plans:** Ad-hoc (no formal plans — shipped directly in commit `33e3e07`)

### Phase 27: MCP Image Upload — binary image upload tool and janus-skills for portraits, logos, and map assets

**Goal:** Add a `upload_image` MCP tool to the JANUS server that accepts base64-encoded binary image data and saves it to the correct data directory location based on image type. NPC portraits are saved to `data/campaign/NPCs/images_source/` with an optional conversion pass through `convert_npc_portraits.py` (amber gradient, 512×512 crop). Logos land in `data/campaign/images/logos/`, handout maps in `data/campaign/images/maps/`, and miscellaneous assets in `data/campaign/images/misc/`. Two new janus-skills expose this: `janus-upload-portrait` (auto-converts by default) and `janus-upload-image` (generic, destination-type required).
**Depends on:** Phase 26
**Plans:** 3/3 plans complete

**Wave 1** (no dependencies):

- [x] 27-01-PLAN.md — Pillow in requirements.txt + logos/maps/misc .gitkeep dirs + Django api_gm_upload_image view + URL routing + test file (Wave 1)

**Wave 2** (blocked on Wave 1):

- [x] 27-02-PLAN.md — upload_image MCP tool in mcp_server.py delegating to Django endpoint (Wave 2)

**Wave 3** (blocked on Wave 2):

- [x] 27-03-PLAN.md — janus-upload-portrait/SKILL.md + janus-upload-image/SKILL.md in janus-skills repo (Wave 3)

### Phase 28: GM Console Data Directory File Editor

**Goal:** Add a full-screen file browser + YAML/Markdown editor as a new GMViewType in the GM Console. The GM can browse the full data/ directory, open any file, edit YAML/Markdown content in Monaco Editor, and save — triggering SSE broadcast to player terminals without needing SSH or Claude Code.
**Requirements**: D-01–D-05 (see 28-CONTEXT.md)
**Depends on:** Phase 27
**Plans:** 3/3 plans complete

**Wave 1** (parallel — no dependencies):

- [x] 28-01-PLAN.md — Backend list API fix (files + dirs), gmConsoleApi data-file methods, FILE_EDITOR ViewRail entry + DISPLAY disabled logic
- [x] 28-02-PLAN.md — DataFileTree component (Ant Design Tree, lazy load, filter input, extension badges)

**Wave 2** (blocked on Wave 1):

- [x] 28-03-PLAN.md — FileEditorView (Monaco editor, save workflow, error banner, localStorage persistence) + GMConsole.tsx wiring + human smoke test

### Phase 28.1: Close gap: D-10 — data-changed SSE consumer + Phase 28 UAT + VERIFICATION.md for phases 25/27/28 (INSERTED)

**Goal:** Close three v2.0 milestone-audit gaps: (1) implement the missing frontend `data-changed` SSE consumer in `useSSE.ts` + `SharedConsole.tsx` so player terminals auto-reload when the GM edits YAML via FileEditorView (closes D-10), (2) run and record all 11 pending Phase 28 UAT tests, (3) author VERIFICATION.md for phases 25, 27, and 28.
**Requirements**: D-01, D-02, D-03, D-04, D-05, D-10
**Depends on:** Phase 28
**Plans:** 1/3 plans executed

Plans:

- [x] 28.1-01-PLAN.md — Add onDataChanged option to useSSE + wire data-changed handler in SharedConsole.tsx (Wave 1)
- [ ] 28.1-02-PLAN.md — Human UAT walkthrough: record all 11 pending Phase 28 UAT verdicts (Wave 1, autonomous=false)
- [ ] 28.1-03-PLAN.md — Author 25-VERIFICATION.md, 27-VERIFICATION.md, 28-VERIFICATION.md (Wave 2, depends on 28.1-02)

### Phase 29: Interactive deckplan map editor with live preview, YAML sync, and POI placement

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 28
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd:plan-phase 29 to break down)
