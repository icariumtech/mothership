---
phase: 25
plan: 01
subsystem: maps
tags: [ui, overlay, pointer-capture, crt]
requires: []
provides:
  - MapPlaybackControls component (presentational)
  - MapPlaybackControlsProps interface
affects:
  - src/components/domain/maps/ (new component + CSS)
tech_stack:
  added: []
  patterns:
    - pointer-capture drag (setPointerCapture/releasePointerCapture)
    - CRT pill overlay with single 12px chamfer
    - stateless callback-emitter (no internal animation state)
key_files:
  created:
    - src/components/domain/maps/MapPlaybackControls.tsx
    - src/components/domain/maps/MapPlaybackControls.css
  modified: []
decisions:
  - "Cosmetic thumb position kept as local state in MapPlaybackControls; parent owns true orbital offset (consistent with stateless contract — thumb is purely visual feedback bounded by track width)"
  - "Pointer event handlers passed as undefined (not no-ops) when isPlaying=true so the browser does not register drag listeners at all on disabled scrub bar"
metrics:
  duration: 1m45s
  tasks: 2
  files_touched: 2
  completed: 2026-05-22
---

# Phase 25 Plan 01: MapPlaybackControls — CRT Pill Overlay Summary

Created the stateless `MapPlaybackControls` overlay component plus its CRT pill CSS — establishes the visual contract that Wave 2 wrappers (GalaxyMap / SystemMap / OrbitMap) will consume.

## What Was Built

A self-contained, presentational React component that renders a top-center pill overlay containing a play/pause button and (optionally) a horizontal scrub drag zone. The component owns NO animation state; it only emits `onTogglePlay()` and `onScrubDelta(deltaX)` callbacks. Per D-13, it is intended to render outside the R3F Canvas as a positioned div inside the map container.

### Files

| File                                                       | Role                                                                                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/domain/maps/MapPlaybackControls.tsx`       | Functional component, `MapPlaybackControlsProps` export, pointer-capture drag handlers, cosmetic thumb state                                |
| `src/components/domain/maps/MapPlaybackControls.css`       | Pill background (#111e1e + #2a4040 border + 12px top-left chamfer), 44px button, teal/muted scrub track, amber thumb, disabled scrub state |

### Component Contract

```typescript
interface MapPlaybackControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  showScrub: boolean;
  onScrubDelta?: (deltaX: number) => void;
}
```

Match verbatim with `25-UI-SPEC.md` — no field additions or renames.

### Behavior Summary

- **Button** — Renders ⏸ (U+23F8) when playing, ▶ (U+25B6) when paused. `aria-label` flips to match. Amber border applied in paused state (`--paused` modifier) so the user knows the scrub bar is now live.
- **Scrub bar** — Only renders when `showScrub=true`. When `isPlaying=true`, the bar is visually disabled (gray track, no thumb, opacity 0.4, default cursor) AND its pointer handlers are passed as `undefined` so no listeners are bound at all.
- **Drag** — `pointerdown` calls `setPointerCapture` and records `lastX`. `pointermove` emits raw `deltaX = clientX - lastX` to the parent (positive = right/forward) and updates a cosmetic thumb position clamped to track width via `getBoundingClientRect`. `pointerup` and `pointercancel` release pointer capture.
- **Touch** — `touchAction: 'none'` on the scrub zone prevents the browser from claiming the gesture as a scroll on mobile / touch-TV contexts.

## Commits

| Task | Description                                                        | Commit    |
| ---- | ------------------------------------------------------------------ | --------- |
| 1    | `feat(25-01): add MapPlaybackControls CSS pill overlay`            | `716a494` |
| 2    | `feat(25-01): add MapPlaybackControls component with pointer-capture drag` | `cc80ffe` |

## Verification

- `pnpm run typecheck` — exit 0, clean (after `pnpm install --prefer-offline` in the fresh worktree).
- CSS file: 9 selectors prefixed `.map-playback-controls`, all required color tokens present (`#111e1e`, `#2a4040`, `#c9a050`, `#4a8b8b`), 44px touch targets, single 12px chamfer.
- TSX file: 2 exports (interface + component), pointer-capture pair (`setPointerCapture` + `releasePointerCapture`), CSS import, all three aria-labels, both Unicode icons.

## Deviations from Plan

None affecting the contract — the component matches `25-UI-SPEC.md` and the plan's `<interfaces>` block verbatim.

Two minor implementation notes (not deviations from the public contract):

1. **Pointer handlers passed as `undefined` when `isPlaying=true`** — The plan said disabled drag handlers but did not specify the mechanism. Passing `undefined` (rather than no-op functions) means no DOM listener is registered at all in the disabled state, which is cheaper and more accessible. This is internal-only and invisible to consumers.

2. **`useCallback` wrapping of all three handlers** — The plan said "use `useCallback`". Done as specified; dependency arrays minimal (`[onScrubDelta, isPlaying]` for down, `[onScrubDelta]` for move, `[]` for up).

## Threat Flags

No new threat surface beyond what is already documented in `25-01-PLAN.md` `<threat_model>` (T-25-01, T-25-02 accepted client-side; T-25-SC n/a — no packages added). No new endpoints, auth paths, file access, or schema changes.

## Known Stubs

None. The component is fully wired to its own contract. It does NOT yet have consumers in `GalaxyMap.tsx` / `SystemMap.tsx` / `OrbitMap.tsx` — that is Wave 2's job per the phase plan; this plan only delivers the visual contract.

## Self-Check: PASSED

- File `src/components/domain/maps/MapPlaybackControls.tsx`: FOUND
- File `src/components/domain/maps/MapPlaybackControls.css`: FOUND
- Commit `716a494`: FOUND
- Commit `cc80ffe`: FOUND
- `pnpm run typecheck`: exit 0
