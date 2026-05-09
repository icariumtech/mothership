# Roadmap: Mothership GM Terminal

## Milestones

- ✅ **v1.0 MVP** — Phases 1–20 (shipped 2026-05-07)
- 🚧 **v2** — Phase 21 onward

## Phases

### v2 (in progress)

- [ ] Phase 21: Encounter Geometry Deepening (5 plans) — planned 2026-05-08
  - Lift `EncounterMapRenderer.tsx` (1895 LOC) into a four-module geometry stack (`polygon2d`, `roomGeometry`, `gridProjection`, `mapView`); rework door model to top-level canonical `Door`; extract reveal-cascade scheduler. Adds Vitest infrastructure. Future iso/rotation view becomes a one-line projection swap.
  - See `.planning/phases/21-encounter-geometry-deepening/`

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
