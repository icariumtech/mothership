---
phase: 25
plan: 03
subsystem: maps
tags: [r3f, system-map, play-pause, scrub, orbital]
requires:
  - 25-01 (MapPlaybackControls component contract)
provides:
  - SystemScene props: orbitsPaused + scrubOffsetRef
  - SystemMap local isOrbiting state + scrubOffsetRef accumulator
  - System view play/pause + scrub overlay wiring
affects:
  - src/components/domain/maps/r3f/SystemScene.tsx
  - src/components/domain/maps/SystemMap.tsx
tech_stack:
  added: []
  patterns:
    - ref-as-frame-shared-state (parent accumulates radians, child reads each frame)
    - frozen-elapsed pause (capture elapsed at pause-edge; calculate from frozen + scrub)
    - re-anchor on resume (fold scrubOffset back into startTimeRef for continuity)
    - independent pause flags (paused vs orbitsPaused — never ORed)
key_files:
  created: []
  modified:
    - src/components/domain/maps/r3f/SystemScene.tsx
    - src/components/domain/maps/SystemMap.tsx
decisions:
  - "Kept the optional startTimeRef re-anchor block on resume (folds scrubOffset back into startTimeRef using shortest-period as canonical clock anchor) — provides continuous playback after pause→scrub→resume without snapping planets back to live time."
  - "`orbitsPaused` derivation is a separate const from `paused` and is never ORed into the existing `if (!paused)` useFrame guard — when orbitsPaused, the frameloop still ticks and planet meshes still re-render so React-Three updates their transforms from frozen positions."
  - "Scrub-speed period selection uses optional-chained selectedPlanetData.orbital_period with shortest-period fallback (Number.isFinite + >0 filter) to defend against missing/invalid orbital_period in YAML."
metrics:
  duration: ~3m
  tasks: 2
  files_touched: 2
  completed: 2026-05-22
---

# Phase 25 Plan 03: System Map Play/Pause + Scrub Wiring Summary

Wires the system map to the Wave-1 `MapPlaybackControls` overlay: extends `SystemScene` with two independent props (`orbitsPaused`, `scrubOffsetRef`) that freeze orbital math without halting rendering or camera tracking, and gives `SystemMap` the local state + scrub accumulator that drive them. Ships D-03, D-04, D-05, D-06, D-08, D-09.

## What Was Built

### Files Modified

| File                                                | Role                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/components/domain/maps/r3f/SystemScene.tsx`    | Accepts `orbitsPaused` + `scrubOffsetRef`; uses them inside `calculatePlanetPosition`         |
| `src/components/domain/maps/SystemMap.tsx`          | Local `isOrbiting` state, `scrubOffsetRef` accumulator, `MapPlaybackControls` overlay         |

### Exact Line Ranges Modified

**`SystemScene.tsx`**

| Range          | Change                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------- |
| L60–L65        | `SystemSceneProps`: added `orbitsPaused?: boolean` and `scrubOffsetRef?: React.RefObject<number>` with JSDoc |
| L90–L91        | `forwardRef` destructure: added `orbitsPaused: orbitsPausedProp = false,` and `scrubOffsetRef,`  |
| L108–L110      | After `const paused = pausedProp || storePaused;` — added `const orbitsPaused = orbitsPausedProp;` (independent flag, NOT ORed) |
| L235–L237      | Added `frozenElapsedRef = useRef<number \| null>(null)` near `startTimeRef`                     |
| L252–L278      | `calculatePlanetPosition` — `elapsedSeconds` reads frozen-or-live; added `scrubOffset` term to `currentAngle`; deps array includes `orbitsPaused` and `scrubOffsetRef` |
| L445–L470      | New `useEffect` keyed on `[orbitsPaused, data, speedMultiplier, scrubOffsetRef]` — captures elapsed on pause; re-anchors `startTimeRef` and zeros `scrubOffsetRef.current` on resume |
| L387 (UNCHANGED) | `if (!paused) {` useFrame guard preserved verbatim — `orbitsPaused` is NOT added here          |

**`SystemMap.tsx`**

| Range          | Change                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------- |
| L30            | `import { MapPlaybackControls } from './MapPlaybackControls';`                                  |
| L32–L35        | Module-level constants `ORBITAL_PERIOD_TARGET_SECONDS = 10` and `SCRUB_TRACK_WIDTH = 300`        |
| L90–L93        | After `loadedSystemRef`: `const [isOrbiting, setIsOrbiting] = useState(true);` and `const scrubOffsetRef = useRef<number>(0);` |
| L150–L172      | `handleTogglePlay` (useCallback) and `handleScrubDelta` (useCallback) — scrub uses selected body's `orbital_period`, else shortest-in-system (D-06) |
| L274–L275      | `<SystemScene>` JSX — added `orbitsPaused={!isOrbiting}` and `scrubOffsetRef={scrubOffsetRef}` (existing props untouched) |
| L285–L290      | After `<Canvas>`, sibling `<MapPlaybackControls isPlaying={isOrbiting} onTogglePlay={handleTogglePlay} showScrub={true} onScrubDelta={handleScrubDelta} />` |

### Re-anchor block: KEPT

The plan flagged the resume-side `startTimeRef` re-anchor as optional. **It was kept.** On the orbitsPaused → orbitsPaused=false transition, the effect:

1. Reads `frozenElapsedRef.current` (elapsed seconds captured at the pause edge).
2. Derives an `orbitalSpeed` from the shortest orbital period in the system (canonical clock anchor — mirrors `speedMultiplier`).
3. Converts `scrubOffsetRef.current` radians → seconds via `offsetSeconds = scrubOffsetRef.current / orbitalSpeed`.
4. Shifts `startTimeRef.current` backward by `(frozenElapsed + offsetSeconds) * 1000` so live `(Date.now() - startTime)/1000` matches the scrubbed angle.
5. Zeros `scrubOffsetRef.current` and clears `frozenElapsedRef.current`.

This gives a continuous handoff: pressing play after scrubbing keeps planets where the user left them and resumes from that position. Without this block, planets would snap back to live-time positions on resume (which contradicts D-07's "no reset" semantics for the user's scrub work).

## Commits

| Task | Description                                                            | Commit    |
| ---- | ---------------------------------------------------------------------- | --------- |
| 1    | `feat(25-03): add orbitsPaused + scrubOffsetRef to SystemScene`        | `d4b28f5` |
| 2    | `feat(25-03): wire SystemMap with isOrbiting state and scrub overlay`  | `86209c2` |

## Verification

- `pnpm run typecheck` — exit 0, clean.
- `grep` acceptance checks per plan all pass:
  - `SystemScene.tsx`: `orbitsPaused` count 14 (≥4), `scrubOffsetRef` count 8 (≥3), `frozenElapsedRef` count 8 (≥3); `const paused = pausedProp || storePaused` present; `if (!paused) {` useFrame guard at L387 unchanged.
  - `SystemMap.tsx`: `MapPlaybackControls` count 2 (import + JSX), `isOrbiting` count 4, `scrubOffsetRef` count 3, scrub-handler refs count 2, `ORBITAL_PERIOD_TARGET_SECONDS` present, literal `showScrub={true}` and `orbitsPaused={!isOrbiting}` both present.
- Visual smoke (deferred to Plan 05): on `/gmconsole/` Bridge MAP tab → System view → click ⏸ → planets freeze; drag scrub right → planets rotate forward along their orbits; click ▶ → planets resume from scrubbed positions.

## Deviations from Plan

None affecting the contract. Two minor implementation notes:

1. **`useEffect` placement** — The plan suggested adding the orbitsPaused effect "near other refs". It was instead placed immediately after the existing `useEffect(..., [systemSlug])` that resets `startTimeRef`, since both effects manipulate `startTimeRef` and grouping them keeps the time-anchor lifecycle co-located. Functionally identical; deps array matches the plan exactly: `[orbitsPaused, data, speedMultiplier, scrubOffsetRef]`.

2. **Scrub period filter hardening** — `handleScrubDelta` filters periods through `Number.isFinite(p) && p > 0` before `Math.min` (Rule 2 — defensive guard against zero/negative/NaN `orbital_period` values in YAML that would otherwise produce `Infinity` / `NaN` radiansPerPixel and break the scrub bar). The plan's snippet used a plain `Math.min` over `??365`. The fallback to 365 when filtering removes everything is preserved.

## Threat Flags

No new threat surface beyond what is documented in `25-03-PLAN.md` `<threat_model>` (T-25-05 / T-25-06 numeric-drift and DoS both `accept`-class; T-25-07 n/a). No new endpoints, auth paths, file access, or schema changes. Scrub state is local React refs / useState — never serialized.

## Known Stubs

None. The wiring is complete end-to-end for the system map. Galaxy map (Plan 02) and orbit map (Plan 04) wire the same overlay against their own scenes in their own plans.

## Self-Check: PASSED

- File `src/components/domain/maps/r3f/SystemScene.tsx`: FOUND (modified)
- File `src/components/domain/maps/SystemMap.tsx`: FOUND (modified)
- Commit `d4b28f5`: FOUND
- Commit `86209c2`: FOUND
- `pnpm run typecheck`: exit 0
