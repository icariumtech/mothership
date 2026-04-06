---
status: complete
phase: 13-atmospheric-ui-animations-for-player-facing-transitions-and-element-reveals
source: [13-01-SUMMARY.md, 13-02-SUMMARY.md, 13-03-SUMMARY.md, 13-04-SUMMARY.md, 13-05-SUMMARY.md]
started: 2026-04-06T18:14:51Z
updated: 2026-04-06T18:30:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. View Transition Glitch Animation
expected: Trigger a view type change via the GM Console (e.g., switch from STANDBY to BRIDGE or ENCOUNTER). On the player terminal, you should see: the current view briefly glitches/tears horizontally, then cuts to black for a short moment, then the new view fades in smoothly. Total transition takes roughly 500ms. The screen should NOT snap instantly between views.
result: pass

### 2. ViewStatusOverlay Typewriter Label
expected: During a view transition (while the new view is fading in), a centered status label should appear on screen with a typewriter-style animation — e.g., "BRIDGE SYSTEMS ONLINE" or "TACTICAL DISPLAY INITIALIZING...". It should fade out after about 2 seconds. The label should be distinct per view type, not generic.
result: pass

### 3. DocumentDialog Scan Reveal
expected: Open a document/notes dialog on the player terminal. It should animate in with a top-down wipe — like a scanner revealing the content from top to bottom over ~500ms. The backdrop should fade from transparent to a dark vignette. Dismissing the dialog should fade it out with a slight scale-down (not just instant disappear).
result: issue
reported: "The animation when showing works but when dismissing the dialog the dialogs just disappear"
severity: major

### 4. CharonDialog Flicker-In
expected: Trigger a CharonDialog message (the JANUS/AI overlay). It should flicker to life with a CRT power-on effect — rapid opacity pulses (stepping, not smooth) over ~280ms — rather than a smooth fade. Closing it should fade out with a slight scale-down.
result: issue
reported: "Animation works on show but just disappears instead of fade and slight scale-down"
severity: major

### 5. CommTerminalDialog Cascade
expected: Open a Comm Terminal dialog that has multiple log entries. The entries should appear sequentially one after another in a typewriter cascade — each line staggered ~60ms apart, sliding up from slightly below. Short logs should finish quickly; long logs should finish within 2 seconds. Closing should fade out with scale-down.
result: issue
reported: "no, on the comm terminal the items don't slide in."
severity: major

### 6. Encounter Room Reveal Animation
expected: In an encounter map on the player terminal, have the GM reveal a room. The room should flicker into view with a CRT-style digital flicker (stepped opacity pulses, not smooth fade) over ~400ms. If multiple rooms are revealed at once (Reveal All), they should cascade top-to-bottom with a ~75ms delay between each. Tokens in newly revealed rooms should fade in slightly after the room flicker (about 200ms delay).
result: pass

### 7. BridgeView Boot Stagger
expected: Switch to the BRIDGE view on the player terminal. The panels/sections should animate in with a staggered fade-slide-up sequence — each panel appearing about 100ms after the previous one, sliding up from ~12px below. All 6 items (content sections + tab bar) should complete their animation in about 1.2 seconds total. After that, no ongoing animation — panels stay fully visible.
result: pass

## Summary

total: 7
passed: 4
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Dismissing a dialog (DocumentDialog) fades out with opacity fade and scale(0.92) over 300ms"
  status: failed
  reason: "User reported: The animation when showing works but when dismissing the dialog the dialogs just disappear"
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Closing CharonDialog fades out with opacity fade and scale(0.92) over 300ms"
  status: failed
  reason: "User reported: Animation works on show but just disappears instead of fade and slight scale-down"
  severity: major
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "CommTerminalDialog list items slide in sequentially (60ms stagger, slide up from below) when dialog opens"
  status: failed
  reason: "User reported: no, on the comm terminal the items don't slide in."
  severity: major
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
