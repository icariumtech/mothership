---
phase: 10
slug: player-ship-map-view
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (`npm run typecheck`) + manual browser verification |
| **Config file** | `tsconfig.json` at project root |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run typecheck && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run typecheck && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Behavior | Test Type | Automated Command | Status |
|---------|------|------|----------|-----------|-------------------|--------|
| 10-01-01 | 01 | 1 | DataLoader campaign ship methods + save_ship_location | type-check | `npm run typecheck` | ⬜ pending |
| 10-01-02 | 01 | 1 | api_set_ship_location endpoint + campaign_ship slug resolver | type-check | `npm run typecheck` | ⬜ pending |
| 10-01-03 | 01 | 1 | Morrigan deck YAML + TypeScript type updates (ActiveView) | type-check | `npm run typecheck` | ⬜ pending |
| 10-02-01 | 02 | 2 | ShipDeckPanel component (bridge mode renderer) | type-check | `npm run typecheck` | ⬜ pending |
| 10-02-02 | 02 | 2 | Player STATUS tab ship deck integration | type-check | `npm run typecheck` | ⬜ pending |
| 10-02-03 | 02 | 2 | GmBridgeShipPanel replacing GmBridgeStatusPanel | type-check | `npm run typecheck` | ⬜ pending |
| 10-03-01 | 03 | 3 | LocationTreePanel "Set as ship location" action | type-check | `npm run typecheck` | ⬜ pending |
| 10-03-02 | 03 | 3 | End-to-end human verification | manual | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework installation needed.

- `npm run typecheck` is already configured and working
- `npm run build` is already configured and working

*No Wave 0 file stubs required.*

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| Ship deck YAML loads via DataLoader | No Python test framework in project | Run server, check `/api/active-view/` response includes `ship_deck_data` field |
| `api_set_ship_location` writes to file and broadcasts | File system write + SSE | POST to endpoint, verify `ship.yaml` updated + SSE `ship_status` event received |
| Player STATUS tab renders deck map | Visual/DOM | Load `/terminal/` with BRIDGE view on STATUS tab — deck map renders below status boxes |
| GM bridge right panel shows deck map | Visual/DOM | Load `/gmconsole/` on BRIDGE view — right panel shows deck map below system toggles |
| All rooms visible in bridge mode | Visual | All room polygons rendered in amber; no hidden/gray rooms |
| Zoomable + panable | Interaction | Scroll to zoom, drag to pan on ship deck map |
| "Set ship location" action | Full flow | Click location in GM Locations panel → "Set as ship location" → verify `ship.yaml` `location_slug` field updated |
| campaign_ship slug in encounter mode | Full flow | GM sets encounter location to campaign_ship → full token/door/reveal features work |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
