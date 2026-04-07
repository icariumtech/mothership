---
plan: 14-01
phase: 14
status: complete
completed: 2026-04-07
---

# Plan 14-01 Summary: Extend Ship Data Model

## What Was Built

Extended the ship data pipeline across all layers to support a 5th system (reactor) and a new resources block (fuel, food, O2, cryopods, escape pods).

## Key Files

### Created / Modified
- `data/campaign/ship.yaml` — added reactor system (ONLINE/100/nominal) and resources block with 5 resource types; armor kept per D-08
- `src/types/shipStatus.ts` — added ResourceValue, ResourceCount, ShipResources interfaces; added reactor to systems map and resources to ShipStatusData
- `terminal/data_loader.py` — added save_ship_resource() method after save_ship_integrity
- `terminal/views.py` — added reactor to valid_systems in api_ship_toggle_system; added api_ship_update_resource endpoint with @login_required, allowlist validation, int casting, SSE broadcast
- `terminal/urls.py` — registered api/gm/ship-status/resource/ route
- `src/services/gmConsoleApi.ts` — added updateShipResource() function and exported it

## Verification

- YAML: reactor system and resources block present; armor preserved
- Django: api_ship_update_resource importable; URL registered; load_ship_status() returns resources in payload
- TypeScript: `npm run typecheck` passes with zero errors

## Self-Check: PASSED

All acceptance criteria met. Data pipeline established for Wave 2 plans (player UI and GM controls).
