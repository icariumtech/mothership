---
plan: 14-03
phase: 14
status: complete
completed: 2026-04-07
---

# Plan 14-03 Summary: GM Controls Update

## What Was Built

Updated GM-side ship panel to support reactor system and all 5 resource fields.

## Key Files Modified

- `src/components/gm/views/BridgeView.tsx` — Added `reactor: 'Reactor'` to SYSTEM_LABELS_GM (auto-renders in existing system loop); added `InputNumber` import; added `localResources` state + `handleResourceChange` callback; added 5 resource control sections (fuel, food, O2, cryopods, escape pods) with SSE sync and blur/enter submit pattern; armor integrity controls preserved (D-08)
- `src/components/gm/ShipStatusPanel.tsx` — Added `reactor: 'Reactor'` to SYSTEM_LABELS so reactor renders correctly in legacy panel's system loop

## Verification

- `npm run typecheck` passes with zero errors
- `reactor: 'Reactor'` present in both SYSTEM_LABELS_GM and legacy SYSTEM_LABELS
- `handleResourceChange` calls `gmConsoleApi.updateShipResource`
- 5 InputNumber controls cover fuel/food/o2/cryopods/escape_pods
- cryopods sends `occupied`, escape_pods sends `available`
- `(['hull', 'armor'] as const).map(...)` integrity loop unchanged (D-08)

## Self-Check: PASSED

All acceptance criteria met.
