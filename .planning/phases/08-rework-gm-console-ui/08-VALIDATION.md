---
phase: 8
slug: rework-gm-console-ui
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-09
audited: 2026-03-16
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
| 08-01-01 | 01 | 1 | GMUI-LAYOUT, GMUI-VIEWRAIL, GMUI-TOOLRAIL, GMUI-SLIDEOUT | type check | `npm run typecheck` | N/A | ✅ green |
| 08-02-01 | 02 | 1 | GMUI-ENCOUNTER, GMUI-TOOLPANELS, GMUI-MAPFULLSCREEN | type check | `npm run typecheck` | N/A | ✅ green |
| 08-03-01 | 03 | 2 | GMUI-BRIDGE, GMUI-CHARON, GMUI-STANDBY, GMUI-DISPLAY | type check | `npm run typecheck` | N/A | ✅ green |
| 08-04-01 | 04 | 3 | All GMUI-* (human verify) | manual | — | N/A | 🔲 manual-only |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · 🔲 manual-only*

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
| All 4 views work via icon rail navigation | Plan 04 | Interactive UI | See 08-04-PLAN.md checkpoint task for full checklist |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete

---

## Validation Audit 2026-03-16

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated to manual-only | 1 (Plan 04 — `checkpoint:human-verify` by design) |
| `npm run typecheck` | ✅ clean |
| `npm run build` | ✅ clean |
