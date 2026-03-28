---
phase: 13
slug: atmospheric-ui-animations-for-player-facing-transitions-and-element-reveals
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-28
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend TypeScript) + npm run typecheck |
| **Config file** | vite.config.ts |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | anim-transitions | type-check | `npm run typecheck` | ✅ | ⬜ pending |
| 13-01-02 | 01 | 1 | anim-glitch | type-check | `npm run typecheck` | ✅ | ⬜ pending |
| 13-02-01 | 02 | 2 | anim-overlays | type-check | `npm run typecheck` | ✅ | ⬜ pending |
| 13-02-02 | 02 | 2 | anim-encounter | type-check | `npm run typecheck` | ✅ | ⬜ pending |
| 13-03-01 | 03 | 1 | anim-room | build-check | `grep -c "roomFlickerIn" src/components/domain/encounter/EncounterMapRenderer.css` | ✅ | ⬜ pending |
| 13-03-02 | 03 | 1 | anim-room | type-check | `npm run typecheck` | ✅ | ⬜ pending |
| 13-04-01 | 04 | 1 | anim-bridge | type-check | `npm run typecheck` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework installation needed — animations are verified via TypeScript type-check, build success, and manual visual inspection.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| View transition glitch plays before view swap | anim-transitions | CSS animation timing, no DOM query | Switch views in GM console, verify glitch flicker before new view appears |
| Overlay enter/exit animations play | anim-overlays | CSS keyframe timing | Open/close CharonDialog, DocumentDialog, CommTerminalDialog overlays |
| Encounter map room fade-in on reveal | anim-encounter | SVG animation, visual | Trigger room reveal in encounter map, verify fade-in |
| Stagger effect on STANDBY element reveal | anim-standby | CSS stagger timing | Load STANDBY view, verify sequential element appearance |
| No animation jitter on rapid SSE changes | anim-transitions | Race condition, visual | Send rapid view changes, verify no jitter or stuck states |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (existing infrastructure sufficient — no new test framework needed)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
