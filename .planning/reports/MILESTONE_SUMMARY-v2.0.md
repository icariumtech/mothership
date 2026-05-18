# Milestone v2.0 — Project Summary

**Generated:** 2026-05-13
**Status:** In progress (Phase 21 complete; additional ad-hoc refactoring shipped; no formal v2.0 close yet)
**Purpose:** Team onboarding and project review

---

## 1. Project Overview

**Mothership GM Terminal** is a retro-futuristic GM tool for running Mothership RPG campaigns. It's a full-stack Django + React/TypeScript web app that serves as an interactive command center: atmospheric CRT-styled interfaces, 3D galaxy/system/orbit maps, grid-based encounter maps with token tracking, the CHARON AI terminal, NPC portrait overlays, real-time SSE state push, and a structured YAML/Markdown campaign data system.

**Core value:** Give the GM a single tool that enhances the tabletop experience with atmospheric digital interfaces without interrupting gameplay flow. Players access from phones/tablets at the table; GM controls everything from the console.

**v1.0 MVP shipped 2026-05-07** — 19 active phases, 49 plans, 51/51 requirements satisfied.

**v2.0 is the architecture deepening milestone.** Where v1.0 delivered all user-visible features, v2.0 targets code quality, testability, and structural foundations that make the codebase maintainable at scale. Phase 21 (Encounter Geometry Deepening) is the first formal phase. Additional ad-hoc refactoring of the Django backend and dead-code removal shipped outside the formal GSD phase structure.

---

## 2. Architecture & Technical Decisions

### Phase 21: Encounter Geometry Stack

The central architectural work of v2.0. `EncounterMapRenderer.tsx` (1895 LOC in v1.0) mixed pure geometry math, coordinate projection, door model, reveal-cascade scheduling, SVG render tree, pan/zoom, token drag, and popover state in one file. Phase 21 extracted the geometry and animation orchestration layers.

- **Decision: Four-module geometry stack**
  - **Why:** Deletion test confirmed each layer earns its keep — removing any one collapses a distinct concern back into its caller. The `gridProjection` seam makes future isometric/rotated map views a one-line constructor swap.
  - **Modules:**
    | Module | Purpose | Dependencies |
    |--------|---------|--------------|
    | `polygon2d` | Pure 2D math — pointInPolygon, centroid, boundary, octagon | none |
    | `roomGeometry` | Grid-space, domain-aware: rooms, doors, walls, bbox, labels | `polygon2d` |
    | `gridProjection` | `project(gx,gy) → svg`, `unproject(sx,sy) → grid`. Top-down today, iso tomorrow. | none |
    | `mapView` | Renderer-facing facade combining the above three | the above three |

- **Decision: Canonical Door model (top-level `doors[]` on the map)**
  - **Why:** In v1.0, doors were nested under `GridRoom.doors[]`; the "other room" was inferred geometrically via `findRoomAtCell`. This was a model bug — doors are relationships between two rooms, not properties of one.
  - **New model:** `Door { id, x, y, angle, width, roomA, roomB | null, type, status }`
  - **Authored YAML formats:** `B-rel` (`{rooms, along, width}`) for human/AI authoring — relational, no geometry reasoning required. `B-pos` (`{rooms, position: {x, y, angle}}`) for precise/SVG-tool output.
  - **`doorNormalizer`** maps both authored shapes to canonical `Door`, validates shared-edge geometry, and assigns deterministic ids.
  - **Phase:** 21

- **Decision: `scheduleReveal` as pure function**
  - **Why:** The room-reveal cascade (visibility diff → Y-ascending sort → per-room timer) was buried inside the renderer with side effects tangled in. Extracting it as `(prev, curr, rooms, mapIdentity, opts) → RevealStep[]` makes it trivially testable and strategy-parameterized.
  - **Split:** `scheduleReveal` (pure, no React) + `useRoomRevealAnimations` (hook owning timer side effects). The `enabled` flag at the hook level replaces the `isGM` bake-in — future "reduced motion" or "performance mode" toggles flip the same flag.
  - **Phase:** 21

- **Decision: T3 test strategy — pure layers only**
  - **Why:** The codebase had zero tests. Adding `@testing-library/react` + fake timers for full component coverage is a high-infrastructure investment. Pure-layer tests (`polygon2d`, `gridProjection`, `roomGeometry`, `doorNormalizer`, `scheduleReveal`) capture ~80% of the geometry safety net for ~20% of the infra cost. `doorNormalizer` tests are highest-leverage: they cover real validation that must be correct.
  - **Phase:** 21

- **Decision: Vitest 2.1.9 (not 4.x)**
  - **Why:** Vitest 4 ships with rolldown-vite which uses `node:util.styleText` (Node 22+). Dev environment is Node 18.19. 2.1.x is the latest Node-18-compatible line; behavior is functionally identical for pure-module unit tests.
  - **Phase:** 21

### Ad-Hoc Backend Refactoring (unplanned, post Phase 21)

- **Decision: views.py monolith split into 8 focused subsystem modules**
  - **Why:** A single `views.py` was a clear locality violation — endpoint groups had no cohesion with each other. Split by subsystem: SSE, active-view, encounter tokens, NPC portraits, ship status, bridge selection, CHARON, and ship location.

- **Decision: `sync_state()` singleton**
  - **Why:** 20 callsites in views.py each manually called `update_active_view_store()` + `broadcast_sse_event()`. Collapsed to a single `sync_state()` that owns both, eliminating duplicated error-prone pairing.

- **Decision: `get_loader()` singleton**
  - **Why:** 31 inline `DataLoader()` calls scattered across views; DataLoader constructs a full YAML scan on every call. Singleton eliminates 31 redundant scans and makes the loader mockable in tests.

- **Decision: JanusController (collapse 4 duplicated AI orchestration blocks)**
  - **Why:** The CHARON AI terminal had 4 near-identical blocks for handling query → context → response → broadcast. Collapsed into a single `JanusController` class.

---

## 3. Phases Delivered

| Phase | Name | Milestone | Status | One-Liner |
|-------|------|-----------|--------|-----------|
| 21 | Encounter Geometry Deepening | v2.0 | ✓ Complete (2026-05-11) | Extract pure geometry stack from 1895-LOC renderer — polygon2d, roomGeometry, gridProjection, mapView, canonical Door model, scheduleReveal, 156 tests |
| — | Ad-hoc backend refactoring | v2.0 | ✓ Shipped (2026-05-13) | views.py split, sync_state singleton, get_loader singleton, JanusController, dead code removal |

> **Note:** The ad-hoc refactoring was done outside the formal GSD phase structure (no PLAN.md, no VERIFICATION.md). It was committed directly to main after Phase 21 closed.

### Phase 21 — Detailed Plan Breakdown

| Plan | Title | Status |
|------|-------|--------|
| 21-01 | Vitest + polygon2d + gridProjection (foundation) | ✓ Complete |
| 21-02 | Canonical Door type + doorNormalizer + tests | ✓ Complete |
| 21-03 | roomGeometry + mapView; renderer adopts canonical model | ✓ Complete |
| 21-04 | Backend serializer + svg_to_map.py + YAML migration + door-state ID migration | ✓ Complete |
| 21-05 | scheduleReveal + useRoomRevealAnimations; renderer drops cascade plumbing | ✓ Complete |

---

## 4. Requirements Coverage

Phase 21 was entirely structural refactoring — no user-visible requirements in `REQUIREMENTS.md` were targeted.

### Active Requirements (v2.0 scope)

| ID | Requirement | Status |
|----|------------|--------|
| AUDI-01 | UI click sounds | ❌ Not started (deferred from v1.0) |
| AUDI-02 | UI transition effects | ❌ Not started (deferred from v1.0) |
| AUDI-03 | Ambient atmosphere audio | ❌ Not started (deferred from v1.0) |

All 51 v1.0 requirements remain satisfied — Phase 21 touched no user-facing behavior.

---

## 5. Key Decisions Log

| ID | Decision | Phase | Rationale |
|----|---------|-------|-----------|
| GEO-01 | Four-module geometry stack | 21 | Deletion test validates each seam; gridProjection enables iso swap as constructor change |
| GEO-02 | Canonical top-level Door model | 21 | Doors are room relationships, not room properties; nested model was a design bug |
| GEO-03 | doorNormalizer validates authored YAML | 21 | B-rel format (rooms + along) requires no geometry from human/AI authors; normalizer enforces shared-edge invariant at load time |
| GEO-04 | scheduleReveal as pure function | 21 | Cascade scheduling had no reason to be stateful; purity makes it testable and strategy-parameterizable |
| GEO-05 | T3 test strategy: pure layers only | 21 | 80% safety net for 20% infra cost; doorNormalizer tests highest-leverage |
| GEO-06 | Vitest 2.1.9 not 4.x | 21 | Node 18 environment; rolldown-vite in v4 requires Node 22+ |
| BE-01 | views.py split into 8 subsystem modules | ad-hoc | Single-file monolith had no cohesion; split enables per-subsystem comprehension |
| BE-02 | sync_state() singleton | ad-hoc | Eliminated 20 duplicated update+broadcast pairs; reduces broadcast omission bugs |
| BE-03 | get_loader() singleton | ad-hoc | Eliminated 31 redundant DataLoader scans; makes loader mockable |
| BE-04 | JanusController | ad-hoc | 4 duplicated AI orchestration blocks collapsed; single entry point for CHARON query handling |

---

## 6. Tech Debt & Deferred Items

### Open Human Verification (Phase 21)

- **156 test suite run:** `npm test` — plan-05 session didn't have interactive terminal permission. Tests are authored and type-checked; runtime pass unconfirmed for 19 new scheduleReveal tests.
- **Manual smoke test:** Load somnus map and patrol gunboat map, exercise door toggle, room reveal cascade, deck switch in both GM console and player terminal.

### Deferred State Machines (Phase 21 out-of-scope)

These were identified in the same grilling session that produced Phase 21 but excluded to keep scope tractable. Each is a clean follow-up phase:

| Candidate | What | Complexity |
|-----------|------|------------|
| `usePanZoom` | Pan/zoom/touch gesture state machine (~250 LOC in renderer) | Medium |
| `useTokenPlacement` | Token drag-and-drop with cell snapping + occupancy check (~200 LOC) | Medium |
| `useExclusivePopover<T>` | 4 independent `useState` for mutually-exclusive popovers → discriminated union | Small |
| View transition orchestration | Implicit phase machine across SharedConsole + useViewTransition + transitionCoordinator | Large |
| SharedConsole decomposition | 1064-LOC god-component → Bridge / JANUS / terminal-overlay modules | Large |
| Three-map stack collapse | Galaxy/System/Orbit are near-identical R3F scenes → `ScaleMap` with three adapters | Large |
| `sceneStore` split | Mixed API data + UI state machine → `mapDataStore` + `viewStateStore` | Medium |
| `DataLoader.load_all_locations` | Does 3 things in one method (walk, index, ship injection) | Small |

### Active UI Audio Deferred Items (from v1.0)

AUDI-01..03 (click sounds, transition effects, ambient atmosphere) remain in v2.0 scope but unstarted.

### v1.0 Lessons Applied in v2.0

- Phase 21 wrote VERIFICATION.md immediately after phase completion (fixed v1.0's retroactive-authoring problem)
- ROADMAP.md progress table updated atomically with each plan completion
- Ad-hoc refactoring after Phase 21 was not put through the GSD plan/execute/verify cycle — an open question for process in v2.0

---

## 7. Getting Started

### Run the project

```bash
./setup.sh && ./start_server.sh   # First-time setup + Django dev server
npm run dev                        # Vite dev server with hot reload (separate terminal)
```

**URLs:** GM Console `/gmconsole/` · Player Terminal `/terminal/` · Admin `/admin/`

### Run tests (new in v2.0)

```bash
npm test              # Vitest: all 156 tests (run from project root)
npm run test:watch    # Watch mode
npm run typecheck     # TypeScript type checking
npm run build         # Production build
```

### Key directories

```
src/
  components/domain/encounter/     # Encounter map system (Phase 21 target)
    geometry/                       # polygon2d, gridProjection, roomGeometry, mapView
    doors/                          # doorNormalizer, doorVisibility
    animation/                      # scheduleReveal, useRoomRevealAnimations
    EncounterMapRenderer.tsx        # Thin SVG render tree (~1509 LOC, down from 1895)
  entries/
    SharedConsole.tsx               # Player terminal (1064 LOC — deepening candidate)
    GMConsole.tsx                   # GM console
  utils/
    polygon2d.ts                    # Domain-free 2D math
terminal/
  views/                            # Django views (split into 8 subsystem modules in v2.0)
  active_view_store.py              # In-memory SSE state store
  data_loader.py                    # YAML → Python data pipeline
data/
  galaxy/                           # Celestial bodies (YAML/Markdown)
  locations/                        # Non-celestial locations (flat directory)
  campaign/                         # Session logs, crew, NPCs (per-entity files)
tools/
  svg_to_map.py                     # Inkscape SVG → encounter map YAML converter
  migrate_doors_to_canonical.py     # One-shot v1.0→v2.0 door format migration
```

### Where to look first

- **New to encounter maps:** Start with `21-CONTEXT.md` in `.planning/phases/21-encounter-geometry-deepening/` for the full design rationale, then `src/components/domain/encounter/geometry/` for the pure modules.
- **New to the GM workflow:** Read `codemaps/frontend.md` and `codemaps/backend.md` in `.planning/codebase/`.
- **New to the data format:** Read `DATA_DIRECTORY_GUIDE.md` at project root.
- **Adding a new encounter map:** See `DATA_DIRECTORY_GUIDE.md` → map authoring section; use `tools/svg_to_map.py` for SVG-based maps.

---

## Stats

| Metric | v2.0 (in progress) | v1.0 (shipped) |
|--------|-------------------|----------------|
| Timeline | 2026-05-07 → ongoing (~6 days) | 2026-02-11 → 2026-05-07 (~85 days) |
| Formal phases | 1 (Phase 21) | 19 active |
| Plans | 5 | 49 |
| Requirements | 0 new (3 deferred audio open) | 51/51 |
| Commits | 77 | 367 |
| Files changed | 140 (+5,282 / −14,596) | — |
| Contributors | Gabe Johnson | Gabe Johnson |
| Test coverage | 156 tests added (first tests ever) | 0 |
| Renderer LOC delta | −386 LOC (1895 → 1509, −20%) | — |

---

*For current project status, see `.planning/PROJECT.md` and `.planning/STATE.md`*
*v1.0 full details: `.planning/milestones/v1.0-ROADMAP.md`*
