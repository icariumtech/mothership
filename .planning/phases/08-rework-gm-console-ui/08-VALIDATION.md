---
phase: 8
slug: rework-gm-console-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (TypeScript compiler + Vite build) |
| **Config file** | tsconfig.json, vite.config.ts |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | Layout restructure | type check | `npm run typecheck` | N/A | ⬜ pending |
| 08-02-01 | 02 | 1 | View rail + routing | type check | `npm run typecheck` | N/A | ⬜ pending |
| 08-03-01 | 03 | 2 | Encounter view | type check | `npm run typecheck` | N/A | ⬜ pending |
| 08-04-01 | 04 | 2 | Bridge/CHARON views | type check | `npm run typecheck` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. TypeScript type checking and Vite build are the automated gates.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| View rail renders with icons and tooltips | Layout | Visual UI | Open GM console, verify icon rail appears on left |
| Slide-out panels open/close on click | Layout | Interactive UI | Click tool rail icons, verify panels slide in/out |
| Token drag from slide-out panel to map | Encounter UX | DOM interaction | Open token palette panel, drag token to map grid |
| DISPLAY button pushes view to player terminal | View sync | Multi-client | Click DISPLAY, verify player terminal updates |
| Active indicator shows player's current view | View sync | Multi-client | Push view, verify indicator dot on correct icon |
| Tablet landscape layout | Responsive | Device testing | Use browser responsive mode at iPad dimensions |
| BRIDGE dashboard shows location + ship + crew | Bridge view | Visual UI | Switch to BRIDGE view, verify dashboard panels |
| Right-click context menu on rooms works | Encounter UX | Interactive UI | Right-click room on map, verify menu appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
