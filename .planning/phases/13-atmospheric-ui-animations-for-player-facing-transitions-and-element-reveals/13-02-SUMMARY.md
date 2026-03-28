---
phase: 13-atmospheric-ui-animations-for-player-facing-transitions-and-element-reveals
plan: "02"
subsystem: ui-animations
tags: [animations, overlays, css-keyframes, anim-phase, clip-path, flicker, typewriter]
dependency_graph:
  requires: []
  provides: [ANIM-OVERLAY]
  affects:
    - src/components/domain/DocumentDialog.tsx
    - src/components/domain/charon/CharonDialog.tsx
    - src/components/domain/terminal/CommTerminalDialog.tsx
tech_stack:
  added: []
  patterns:
    - AnimPhase state machine (entering -> stable -> exiting) for deferred visual unmount
    - clip-path inset scan reveal for document dialogs
    - steps(1) opacity flicker for CRT power-on effect
    - per-line staggered animation with inline animationDelay
    - radial-gradient vignette backdrop replacing flat rgba overlay
key_files:
  created: []
  modified:
    - src/components/domain/DocumentDialog.css
    - src/components/domain/DocumentDialog.tsx
    - src/components/domain/charon/CharonDialog.css
    - src/components/domain/charon/CharonDialog.tsx
    - src/components/domain/terminal/CommTerminalDialog.css
    - src/components/domain/terminal/CommTerminalDialog.tsx
decisions:
  - "AnimPhase guard uses `!open && animPhase === 'entering'` (not 'stable') so component stays mounted through exit animation"
  - "commLineReveal stagger duration capped at 2000ms to handle very long terminal logs gracefully"
  - "useEffect for 'exiting' checks animPhase !== 'exiting' guard to prevent re-triggering on each render"
  - "CharonDialog existing disableClose prop left unchanged — AnimPhase exit only triggered by parent setting open=false"
metrics:
  duration: ~600s
  completed: "2026-03-28"
  tasks: 2
  files: 6
---

# Phase 13 Plan 02: Overlay Dialog Atmospheric Animations Summary

Replaced generic 0.2s scale-fade overlays with distinct CRT-appropriate entrance animations for each dialog type. DocumentDialog scans in top-down via clip-path; CharonDialog flickers to life with steps(1) opacity pulses; CommTerminalDialog cascades log items in sequentially as if receiving a live signal. All three share a unified exit (opacity fade + scale 0.92). Backdrop transitions from transparent to radial vignette instead of flat rgba.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Animate DocumentDialog and CharonDialog overlays | f0b1b31 | DocumentDialog.css, DocumentDialog.tsx, CharonDialog.css, CharonDialog.tsx |
| 2 | Animate CommTerminalDialog overlay | b21c192 | CommTerminalDialog.css, CommTerminalDialog.tsx |

## What Was Built

### DocumentDialog (scan reveal)
- `@keyframes docScanIn`: `clip-path: inset(0 0 100% 0)` -> `inset(0 0 0% 0)` over 500ms — top-down wipe
- `@keyframes docDismiss`: opacity fade + `scale(0.92)` over 300ms
- `@keyframes docBackdropIn` / `docBackdropOut`: radial vignette creep-in / opacity fade-out
- AnimPhase state machine: entering (500ms) -> stable -> exiting (300ms); `if (!open && animPhase === 'entering') return null`

### CharonDialog (flicker-in)
- `@keyframes charonFlickerIn`: multi-step opacity pulses at `steps(1)` timing over 280ms — CRT power-on
- `@keyframes charonDismiss`: opacity fade + `scale(0.92)` over 300ms
- `@keyframes charonBackdropIn` / `charonBackdropOut`: radial vignette backdrop
- AnimPhase state machine: entering (280ms) -> stable -> exiting (300ms)
- `disableClose` prop behavior unchanged — exit only from parent `open=false`

### CommTerminalDialog (typewriter cascade)
- `@keyframes commLineReveal`: `translateY(-6px) opacity:0` -> `translateY(0) opacity:1` over 0.18s per item
- `@keyframes commContainerIn`: fast 100ms panel fade-in (panel appears; items do the reveal work)
- `@keyframes commDismiss`: opacity fade + `scale(0.92)` over 300ms
- `@keyframes commBackdropIn` / `commBackdropOut`: radial vignette backdrop
- `.comm-log-line.comm-entering`: CSS class enabling per-line animation; `animationDelay` set inline per index
- Stagger: 60ms × item index, capped at 2000ms total; applied to both logs and inbox/sent items
- AnimPhase state machine: entering (item count × 60 + 150ms) -> stable -> exiting (300ms)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- DocumentDialog.css: contains `docScanIn`, `docDismiss`, `.doc-dialog-backdrop.exiting`, `.doc-dialog-container.exiting`
- DocumentDialog.tsx: contains `type AnimPhase`, guards with `animPhase === 'entering'` (no bare `if (!open) return null`)
- CharonDialog.css: contains `charonFlickerIn`, `charonDismiss`, `.charon-dialog-backdrop.exiting`, `.charon-dialog-container.exiting`
- CharonDialog.tsx: contains `type AnimPhase`, AnimPhase state machine
- CommTerminalDialog.css: contains `commLineReveal`, `.comm-log-line.comm-entering`, `commDismiss`, `.comm-terminal-backdrop.exiting`
- CommTerminalDialog.tsx: contains `type AnimPhase`, per-line stagger with `animationDelay`
- Commits f0b1b31 and b21c192 verified in git log
- `npm run typecheck` and `npm run build` both pass
