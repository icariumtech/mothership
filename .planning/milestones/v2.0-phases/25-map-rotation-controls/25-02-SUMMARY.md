---
phase: 25-map-rotation-controls
plan: 02
subsystem: frontend/maps
tags: [galaxy-map, playback-controls, scene-store, autorotate]
requires:
  - src/components/domain/maps/MapPlaybackControls.tsx (Wave 1 / Plan 25-01)
  - src/stores/sceneStore.ts (existing — useAnimationState, setAutoRotate)
provides:
  - GalaxyMap.tsx now renders MapPlaybackControls overlay wired to sceneStore.animations.autoRotate
affects:
  - Galaxy map view in GMConsole BridgeView and player Terminal BridgeView
tech-stack:
  added: []
  patterns:
    - "Stateless overlay component as Canvas sibling (D-13)"
    - "Sticky pause via setAutoRotate without recordInteraction"
key-files:
  created: []
  modified:
    - src/components/domain/maps/GalaxyMap.tsx
decisions:
  - "Pause is sticky: omit recordInteraction() so GalaxyControls' 5s auto-resume timer does not fire"
metrics:
  duration: "2m 4s"
  completed: 2026-05-22
  tasks: 1
  files_modified: 1
---

# Phase 25 Plan 02: Galaxy Map Play/Pause Integration Summary

Wired `MapPlaybackControls` into `GalaxyMap.tsx` as a Canvas-sibling overlay that toggles `sceneStore.animations.autoRotate` via a sticky pause (no `recordInteraction()` call).

## Objective

Hook the play/pause-only variant of `MapPlaybackControls` (showScrub=false) into the galaxy map so users can pause/resume the galaxy's automatic rotation without the existing OrbitControls 5s auto-resume timer interfering.

## What Was Done

### Task 1: Wire MapPlaybackControls into GalaxyMap.tsx

Modified `src/components/domain/maps/GalaxyMap.tsx`:

- **Imports (lines 21-22):**
  - `import { useSceneStore, useAnimationState } from '@/stores/sceneStore';`
  - `import { MapPlaybackControls } from './MapPlaybackControls';`
- **forwardRef body (lines 62-72):**
  - `const animations = useAnimationState();`
  - `const setAutoRotate = useSceneStore((state) => state.setAutoRotate);`
  - `const handleTogglePlay = useCallback(() => { setAutoRotate(!animations.autoRotate); }, [animations.autoRotate, setAutoRotate]);`
  - Inline comment documents why `recordInteraction()` is intentionally omitted (Gotcha #1).
- **JSX (lines 151-155):** Added `<MapPlaybackControls isPlaying={animations.autoRotate} onTogglePlay={handleTogglePlay} showScrub={false} />` as a sibling AFTER `</Canvas>` inside the existing `<div className={containerClass}>` wrapper. No changes to the Canvas block, its children, or any other behavior.

Commit: `6890c4f` — `feat(25-02): wire MapPlaybackControls into GalaxyMap`

## Verification

- `pnpm run typecheck` → exits 0 (clean)
- `grep -c MapPlaybackControls src/components/domain/maps/GalaxyMap.tsx` → 2 (import + JSX)
- `grep -c "useAnimationState\|useSceneStore" src/components/domain/maps/GalaxyMap.tsx` → 3
- `grep -c setAutoRotate src/components/domain/maps/GalaxyMap.tsx` → 4
- `grep -c "showScrub={false}" src/components/domain/maps/GalaxyMap.tsx` → 1
- `grep -c recordInteraction src/components/domain/maps/GalaxyMap.tsx` → 0 (Gotcha #1 honored)
- `<Canvas>` block structurally intact: still contains `<TypewriterController>`, `<Suspense><GalaxyScene/></Suspense>`, and `<PostProcessing enabled={false}/>`.

Visual verification (clicking pause → galaxy stops rotating with no 5s resume) is deferred to Plan 25-05 per CONTEXT.md.

## Deviations from Plan

None — plan executed exactly as written.

The plan instructed me to keep the explanatory comment but the acceptance criterion required `recordInteraction` to be absent from the file. I rephrased the comment to avoid the literal token (it now reads "Do NOT signal an interaction here") while preserving the same engineering rationale, then re-confirmed typecheck. This is a wording adjustment to satisfy a strict grep-based criterion, not a behavioral deviation.

## Threat Flags

None. The change introduces no new trust boundaries beyond the already-accepted T-25-03 (autoRotate boolean flip) and T-25-04 (no audit log) — both `accept` dispositions in the plan's threat register.

## Self-Check: PASSED

- Modified file `src/components/domain/maps/GalaxyMap.tsx`: FOUND
- Commit `6890c4f`: FOUND in `git log --oneline`
