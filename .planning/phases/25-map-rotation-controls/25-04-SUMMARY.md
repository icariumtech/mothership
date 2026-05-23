---
phase: 25-map-rotation-controls
plan: 04
subsystem: ui
tags: [react, r3f, three.js, orbital-mechanics, scrub-controls, pointer-capture]

requires:
  - phase: 25
    provides: "MapPlaybackControls (stateless overlay component) from plan 25-01"
provides:
  - "Play/pause + scrub control over moon and orbital-station motion in the orbit map"
  - "orbitsPaused + scrubOffsetRef threaded through OrbitScene to Moon and OrbitalStation children"
  - "Independent freeze flag (orbitsPaused) coexisting with the existing animationPaused (surface marker selection)"
  - "Scrub speed auto-calibrates to selected body's period, or shortest moon/station period when no body selected"
affects: [encounter, orbit-map, surface-markers]

tech-stack:
  added: []
  patterns:
    - "Combined freeze flag (orbitalMathFrozen = animationPaused || orbitsPaused) at scene boundary; children consume a single 'freeze orbital math' prop"
    - "scrubOffsetRef accumulator applied to orbital angle while paused — frame still updates each tick so drag motion is visible"

key-files:
  created:
    - .planning/phases/25-map-rotation-controls/25-04-SUMMARY.md
  modified:
    - src/components/domain/maps/r3f/OrbitScene.tsx
    - src/components/domain/maps/r3f/orbit/Moon.tsx
    - src/components/domain/maps/r3f/orbit/OrbitalStation.tsx
    - src/components/domain/maps/OrbitMap.tsx

key-decisions:
  - "Approach A: combine animationPaused + orbitsPaused into a single orbitalMathFrozen at the OrbitScene boundary, minimising child surface area"
  - "Moon + OrbitalStation continue updating position each frame while paused so the scrub drag is visible — only the time source is frozen"
  - "CentralPlanet/LatLonGrid/SurfaceMarker continue to honor only animationPaused (surface-marker selection); orbitsPaused does NOT freeze the central planet or surface markers"
  - "Camera-tracking useFrame guard is unchanged — play/pause button does not freeze camera tracking"
  - "Scrub speed: uses selected moon/station orbital_period when one is selected; otherwise the shortest period among all moons + stations (surface markers excluded — no orbital period)"
  - "ORBITAL_PERIOD_TARGET_SECONDS=10 and SCRUB_TRACK_WIDTH=300 mirror the SystemScene constants for consistency across map types"

patterns-established:
  - "Independent freeze flag pattern: a new map-level pause (orbitsPaused) coexists with a context-driven pause (animationPaused) via combined boundary flag — keeps child API stable while exposing new control surface"

requirements-completed:
  - PHASE-25-GOAL

duration: ~3m (network error after final commit but before SUMMARY.md write — rescued by orchestrator)
completed: 2026-05-22
---

# Phase 25 / Plan 04: OrbitMap Play/Pause + Scrub Summary

**Adds independent play/pause + scrub control over moons and orbital stations in the orbit map without disrupting the existing surface-marker pause behavior.**

## Performance

- **Duration:** ~3m execution (network error after both implementation commits, before SUMMARY.md write — SUMMARY rescued by orchestrator from committed diffs)
- **Started:** 2026-05-22T22:08:00Z
- **Completed:** 2026-05-22T22:14:52Z (last commit)
- **Tasks:** 2 of 2 (implementation complete)
- **Files modified:** 4 (plan listed 2; Moon.tsx + OrbitalStation.tsx added as necessary children to consume the new threaded props — see Deviations)

## Accomplishments

- Threaded `orbitsPaused` + `scrubOffsetRef` props through `OrbitScene` to `Moon` and `OrbitalStation`
- Combined `orbitsPaused` with existing `animationPaused` into `orbitalMathFrozen` at the scene boundary — single prop on children
- Wired `OrbitMap` with local `isOrbiting` state, scrub accumulator ref, and `MapPlaybackControls` overlay (top-center, after Canvas)
- Auto-calibrated scrub pixel→radians using selected body's period, or shortest period if none selected (surface markers excluded)

## Task Commits

1. **Task 1: Thread orbitsPaused + scrubOffsetRef through OrbitScene** — `88c89d2` (feat)
2. **Task 2: Wire OrbitMap with play/pause + scrub overlay** — `8230cbb` (feat)

## Files Created/Modified

- `src/components/domain/maps/r3f/OrbitScene.tsx` — Added `orbitsPaused` + `scrubOffsetRef` props; computes `orbitalMathFrozen = animationPaused || orbitsPaused`; passes combined flag + scrub ref to Moon + OrbitalStation. CentralPlanet/LatLonGrid/SurfaceMarker continue to use original `animationPaused`.
- `src/components/domain/maps/r3f/orbit/Moon.tsx` — Consumes `orbitalMathFrozen` + `scrubOffsetRef`; captures frozen elapsed on pause; applies scrub offset to orbital angle while paused; still updates position each frame so drag motion is visible.
- `src/components/domain/maps/r3f/orbit/OrbitalStation.tsx` — Same pause/scrub pattern as Moon, applied to orbital stations.
- `src/components/domain/maps/OrbitMap.tsx` — Added `isOrbiting` state + `scrubOffsetRef`; `handleScrubDelta` calibrates px→rad using selected body's period or shortest period among all moons + stations; renders `MapPlaybackControls` overlay; local `ORBITAL_PERIOD_TARGET_SECONDS=10` + `SCRUB_TRACK_WIDTH=300` constants mirror SystemScene.

## Decisions Made

See key-decisions in frontmatter. The combined-flag approach (Approach A) was chosen over passing two separate freeze flags to children to keep the child API stable and avoid a coupling refactor.

## Deviations from Plan

### Expanded files_modified

The plan listed only `OrbitScene.tsx` and `OrbitMap.tsx` in `files_modified`. Implementation required modifying `Moon.tsx` and `OrbitalStation.tsx` to consume the newly-threaded props — otherwise the freeze flag would not propagate to the actual orbital math. This is a non-substantive expansion (mechanical prop wiring in children) and does not introduce new behavior outside the plan's scope.

### Orchestrator-rescued SUMMARY.md

The executor agent's network connection dropped (`API Error: socket connection was closed unexpectedly`) after both implementation commits were made but before SUMMARY.md was written. The orchestrator reconstructed SUMMARY.md from the committed diffs and detailed commit messages, preserving the agent's stated decisions and notes.

## Self-Check

- [x] Both implementation tasks committed atomically
- [x] OrbitScene exposes `orbitsPaused` + `scrubOffsetRef` props
- [x] OrbitMap renders `MapPlaybackControls` overlay
- [x] `animationPaused` (surface marker selection) preserved as independent flag
- [x] Camera tracking useFrame guard unchanged
- [ ] Self-typecheck: not run by agent before connection drop — orchestrator runs post-merge typecheck gate
