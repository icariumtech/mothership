---
phase: 21-encounter-geometry-deepening
plan: 01
subsystem: testing
tags: [vitest, jsdom, polygon, geometry, projection, encounter-map]

# Dependency graph
requires: []
provides:
  - Vitest infrastructure (jsdom env, src/**/__tests__/**/*.test.{ts,tsx} glob)
  - npm scripts: test, test:watch, test:ui
  - polygon2d module — domain-free 2D math (pointInPolygon, polygonAreaCentroid, polygonBoundaryFromRay, octagonFromRect)
  - gridProjection module — Projection interface + topDownProjection({unitSize}) factory
  - 46 passing tests across the two pure modules
affects:
  - 21-02-PLAN (canonical Door + doorNormalizer — uses Vitest)
  - 21-03-PLAN (roomGeometry + mapView + renderer adoption — uses polygon2d, gridProjection)
  - 21-05-PLAN (scheduleReveal — uses Vitest)

# Tech tracking
tech-stack:
  added:
    - vitest@2.1.9 (Node 18 compatible; vitest 4 + rolldown require Node 22+)
    - "@vitest/ui@2.1.9"
    - jsdom@^25
  patterns:
    - "Domain-free utility module — utility code MUST NOT import from src/types/encounterMap.ts (or any other domain module). Coupling-resistant by construction."
    - "Projection seam — every transform between grid space and SVG space goes through Projection.project / .unproject. Future iso/rotation projections plug into the same interface."
    - "Test colocation — tests live in src/**/__tests__/**/*.test.ts adjacent to the module under test."

key-files:
  created:
    - vitest.config.ts
    - src/utils/polygon2d.ts
    - src/utils/__tests__/polygon2d.test.ts
    - src/components/domain/encounter/geometry/gridProjection.ts
    - src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts
  modified:
    - package.json (vitest scripts + dev deps)
    - package-lock.json

key-decisions:
  - "Pinned Vitest to 2.1.9 instead of latest (4.x) — vitest 4 ships with rolldown-vite which uses node:util.styleText (Node 22+); current dev environment is Node 18.19. Latest Node-18-compatible line is 2.1.x."
  - "Function signatures use Point = {x,y} / Polygon = Point[] objects, not the renderer's [number,number] tuples — the lift to a shared module is also the cleanup. Renderer continues to use its tuple-based copies until plan 21-03."
  - "polygonBoundaryFromRay generalises the renderer's centroid-only getPolygonBoundaryPoint — origin is now an explicit parameter, opening up door-midpoint and player-position rays without forcing callers through the centroid."
  - "polygonAreaCentroid falls back to vertex average for degenerate (zero-area) polygons — renderer version produced NaN."
  - "topDownProjection throws on unitSize <= 0 / NaN / Infinity — fail loudly so misuse surfaces immediately rather than producing wrong-but-not-crashing output."

patterns-established:
  - "Pure-layer test coverage: pure modules ship with table-driven tests, no React, no fixtures touching DOM. Future pure modules (roomGeometry, doorNormalizer, scheduleReveal) follow the same pattern."
  - "Hand-derived expected values for centroid tests: chosen polygons have integer / clean-rational centroids so diffs catch bugs without floating-point ambiguity."

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-05-09
---

# Phase 21 Plan 01: Foundation (Vitest + polygon2d + gridProjection) Summary

**Vitest + jsdom test infrastructure plus two domain-free pure modules (polygon2d, gridProjection) with 46 tests covering point-in-polygon, area centroid, ray-to-boundary intersection, chamfered octagon construction, and top-down grid↔SVG projection round-trip.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-09T18:25:27Z
- **Completed:** 2026-05-09T18:37:51Z
- **Tasks:** 6
- **Files created:** 5
- **Files modified:** 2

## Accomplishments

- Vitest infrastructure landed (config, scripts, dev deps) — first tests ever in this codebase
- `polygon2d` exports four pure helpers (pointInPolygon, polygonAreaCentroid, polygonBoundaryFromRay, octagonFromRect) with **zero domain imports**; renderer's local copies stay in place until plan 21-03
- `gridProjection` exports the Projection seam plus `topDownProjection({unitSize})`; future `isoProjection({unitSize, tilt, rotation})` lands in the same interface without touching any caller
- 46 tests pass; `npm run typecheck` clean; `npm run build` clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Vitest as dev dependency and configure** — `627c9b1` (chore)
2. **Task 2: Create src/utils/polygon2d.ts with pure 2D math** — `7735522` (feat)
3. **Task 3: Test polygon2d** — `6fd55fc` (test)
4. **Task 4: Create gridProjection.ts** — `006f3fb` (feat)
5. **Task 5: Test gridProjection** — `18da8a0` (test)
6. **Task 6: Verify build + typecheck + tests** — no commit (verification gate; all green)

## Files Created/Modified

- `vitest.config.ts` — jsdom env, src/**/__tests__/**/*.test.{ts,tsx} glob, `@` alias to `src/`
- `src/utils/polygon2d.ts` — domain-free 2D polygon utilities (199 LOC including doc comments)
- `src/utils/__tests__/polygon2d.test.ts` — 23 tests across all four exports
- `src/components/domain/encounter/geometry/gridProjection.ts` — Projection interface + topDownProjection factory
- `src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts` — 23 tests covering identity, scale, fractional / negative coords, round-trip property table, and loud-failure invariants
- `package.json` — added `test`, `test:watch`, `test:ui` scripts; added `vitest`, `@vitest/ui`, `jsdom` dev deps
- `package-lock.json` — lockfile update

## Decisions Made

- **Vitest 2.1.9 instead of 4.x** — Node 18 environment incompatible with vitest 4 + rolldown's use of `node:util.styleText` (Node 22+ feature). 2.1.x is the latest Node-18-compatible line; behavior is functionally equivalent for our use case (pure-module unit tests, no advanced features used).
- **Object types (`Point = {x,y}`) instead of tuple types (`[number, number]`)** in the lifted modules. The renderer keeps its tuple-based local copies until plan 21-03, but the shared module has cleaner ergonomics: destructuring is unambiguous, accidental swaps are caught by readability, and JSON-friendly debugging is improved. The renderer's tuple-based callers will adapt at the seam in plan 21-03.
- **`polygonBoundaryFromRay` takes an explicit origin** — the renderer's existing helper hard-coded the polygon centroid as the ray origin, which prevented use cases like "ray from a door midpoint" or "ray from a player's current cell". Generalising at the lift is cheaper than re-doing the API later.
- **Loud-failure invariants on `topDownProjection`** — throws on `unitSize <= 0`, `NaN`, or `Infinity`. Misuse becomes immediately visible instead of silently producing zero / NaN coordinates that propagate into the SVG.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest 4 incompatible with Node 18 environment**
- **Found during:** Task 1 (initial `npm install --save-dev vitest @vitest/ui jsdom`)
- **Issue:** Vitest 4.1.5 (latest) installed successfully but failed at runtime with `SyntaxError: The requested module 'node:util' does not provide an export named 'styleText'`. The error originates in `rolldown-vite` (which Vitest 4 depends on), and `styleText` is a Node 22+ export. Local Node version is 18.19.1.
- **Fix:** Uninstalled vitest@4 + @vitest/ui@4 + jsdom (latest), reinstalled `vitest@2.1.9 @vitest/ui@2.1.9 jsdom@^25`. The 2.1.x line is the latest Node-18-compatible release of Vitest. Functionality used in this plan (table-driven tests via `it.each`, `describe`, basic matchers) is identical between 2.x and 4.x.
- **Files modified:** package.json, package-lock.json
- **Verification:** `npx vitest --version` reports `vitest/2.1.9 linux-x64 node-v18.19.1`; `npm test` runs cleanly; all 46 tests pass.
- **Committed in:** `627c9b1` (Task 1 commit, captures the working version pin directly)

**2. [Rule 1 - Bug] Boundary-convention test had wrong expected values for `pointInPolygon`**
- **Found during:** Task 3 (running `npm test` after writing polygon2d tests)
- **Issue:** The plan asked the test suite to "document the convention; assert it" for boundary points. My initial assertions assumed half-open / strict-< means bottom and left return false, but the standard ray-cast algorithm with `(yi > py) !== (yj > py)` doesn't have a uniform "false on bottom-left" rule — it depends on which edge happens to flip parity, which depends on vertex ordering.
- **Fix:** Traced the algorithm by hand for each tested boundary point, replaced the assertions with the actually-observed values, and updated the test's comment to make clear that boundary behavior is NOT a contract callers should rely on (the renderer's real callers query cell centers, not boundaries). The test's purpose is now to *pin* the observed behavior so future refactors of `pointInPolygon` don't silently change it.
- **Files modified:** src/utils/__tests__/polygon2d.test.ts
- **Verification:** All 23 polygon2d tests pass.
- **Committed in:** `6fd55fc` (Task 3 commit; the corrected test was the test that landed)

---

**Total deviations:** 2 auto-fixed (1 blocking infra, 1 test-correctness bug)
**Impact on plan:** Both fixes were necessary to make the plan executable as written. No scope creep — the plan's stated outcomes (Vitest passing, polygon2d + gridProjection landed with full test coverage, renderer untouched) are all met.

## Issues Encountered

- **`npm test` exits with code 1 when no test files exist.** Vitest 2.x's default behavior. Mitigated by adding the test files immediately in Tasks 3 and 5; no special handling needed since the test suite has files from this plan onward. (Future option: add `passWithNoTests: true` to `vitest.config.ts` if useful, but not strictly required.)

## User Setup Required

None — all dependencies install via `npm install`, and the new test scripts run via existing `npm` tooling.

## Next Phase Readiness

- **Plan 21-02 (canonical Door + doorNormalizer)** can now be developed test-first: Vitest is wired, polygon2d is available for shared-edge geometry checks, and the test pattern is established.
- **Plan 21-03 (roomGeometry + mapView + renderer adoption)** has its dependencies in place: it can both use and re-test polygon2d / gridProjection without re-introducing them.
- The renderer remains untouched (no behavior change shipped); production builds pass.

## Self-Check

Files created exist:
- vitest.config.ts — FOUND
- src/utils/polygon2d.ts — FOUND
- src/utils/__tests__/polygon2d.test.ts — FOUND
- src/components/domain/encounter/geometry/gridProjection.ts — FOUND
- src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts — FOUND

Commits exist:
- 627c9b1 (Task 1 / Vitest infra) — FOUND
- 7735522 (Task 2 / polygon2d module) — FOUND
- 6fd55fc (Task 3 / polygon2d tests) — FOUND
- 006f3fb (Task 4 / gridProjection module) — FOUND
- 18da8a0 (Task 5 / gridProjection tests) — FOUND

## Self-Check: PASSED

---
*Phase: 21-encounter-geometry-deepening*
*Completed: 2026-05-09*
