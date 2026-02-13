---
phase: 02-ship-status-dashboard
plan: 01
subsystem: backend-data-pipeline
tags: [backend, data-loader, api, ship-status, typescript]
dependency_graph:
  requires: []
  provides: [ship-status-api, ship-yaml-schema, runtime-overrides]
  affects: [terminal-status-tab, gm-console-controls]
tech_stack:
  added: [ship.yaml, ship_system_overrides]
  patterns: [yaml-with-runtime-overrides, merge-on-read]
key_files:
  created:
    - data/campaign/ship.yaml
    - src/types/shipStatus.ts
    - terminal/migrations/0014_activeview_ship_system_overrides.py
  modified:
    - terminal/data_loader.py
    - terminal/models.py
    - terminal/views.py
    - terminal/urls.py
    - terminal/templates/terminal/shared_console_react.html
decisions:
  - "Ship data stored in YAML with runtime overrides in ActiveView.ship_system_overrides JSONField"
  - "Override merging happens on read (GET endpoint) - YAML defaults + ActiveView overrides"
  - "Ship systems: life_support, engines, weapons, comms (4 core systems)"
  - "System statuses: ONLINE, STRESSED, DAMAGED, CRITICAL, OFFLINE (5 states)"
metrics:
  duration: 208s
  tasks_completed: 2
  files_created: 3
  files_modified: 5
  commits: 2
  completed_date: 2026-02-13
---

# Phase 02 Plan 01: Ship Status Data Pipeline Summary

**One-liner:** Ship status data pipeline with YAML storage, runtime overrides via ActiveView, and merged API endpoints for terminal and GM control.

## What Was Built

This plan establishes the complete backend data infrastructure for ship status tracking:

1. **Ship Data File** - `data/campaign/ship.yaml` defines the USCSS Morrigan's identity, hull/armor stats, and 4 ship systems
2. **DataLoader Integration** - `load_ship_status()` method follows existing pattern for YAML file loading
3. **TypeScript Types** - `ShipStatusData`, `SystemData`, `SystemStatus` interfaces match YAML schema
4. **ActiveView Runtime Overrides** - `ship_system_overrides` JSONField stores GM-modified system states
5. **API Endpoints** - Public GET `/api/ship-status/` (with override merging) and GM-only POST `/api/gm/ship-status/toggle/`
6. **INITIAL_DATA Wiring** - Ship status available to React components via `window.INITIAL_DATA.shipStatus`

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Ship data file, DataLoader, TypeScript types | eb5c8bd | ship.yaml, data_loader.py, shipStatus.ts |
| 2 | ActiveView model field, API endpoints, INITIAL_DATA wiring | c19bd21 | models.py, views.py, urls.py, template, migration |

## Technical Implementation

### Ship Data Schema

```yaml
ship:
  name: "USCSS Morrigan"
  class: "Hargrave-Class Light Freighter"
  crew_count: 7
  crew_capacity: 12
  hull: { current: 45, max: 60 }
  armor: { current: 8, max: 12 }
  systems:
    life_support: { status: "ONLINE", condition: 100, info: "O2 levels nominal" }
    engines: { status: "STRESSED", condition: 72, info: "Coolant pressure low" }
    weapons: { status: "ONLINE", condition: 100, info: "Defense grid active" }
    comms: { status: "DAMAGED", condition: 45, info: "Long-range offline" }
```

### Override Merging Pattern

**On Read (GET /api/ship-status/):**
1. Load base data from `ship.yaml`
2. Fetch `ActiveView.ship_system_overrides` (e.g., `{"engines": {"status": "CRITICAL", "condition": 30}}`)
3. Merge overrides into base data (override values take precedence)
4. Return merged JSON to client

**On Write (POST /api/gm/ship-status/toggle/):**
1. Validate system name (life_support, engines, weapons, comms)
2. Validate status (ONLINE, STRESSED, DAMAGED, CRITICAL, OFFLINE)
3. Store override in `ActiveView.ship_system_overrides[system_name]`
4. Frontend re-fetches merged data to update display

### API Endpoints

**GET /api/ship-status/** - Public, returns merged ship status
- Used by terminal STATUS tab to display current ship state
- Merges YAML defaults with runtime overrides
- No authentication required (terminal polling)

**POST /api/gm/ship-status/toggle/** - GM only, updates system state
- Validates system name and status enum
- Stores override in ActiveView JSONField
- Returns success + override object

### TypeScript Integration

```typescript
export interface ShipStatusData {
  ship: {
    name: string;
    class: string;
    crew_count: number;
    crew_capacity: number;
    hull: { current: number; max: number };
    armor: { current: number; max: number };
    systems: {
      life_support: SystemData;
      engines: SystemData;
      weapons: SystemData;
      comms: SystemData;
    };
  };
}
```

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification steps passed:

1. ✅ `DataLoader().load_ship_status()` returns "USCSS Morrigan" with 4 systems
2. ✅ `curl http://127.0.0.1:8000/api/ship-status/` returns valid JSON with ship.name, ship.hull, ship.systems
3. ✅ `npx tsc --noEmit` passes with no TypeScript errors
4. ✅ `window.INITIAL_DATA.shipStatus` appears in terminal page source with correct ship data

## Dependencies and Impact

**Provides:**
- Ship status API endpoint for terminal STATUS tab (Plan 02-02)
- GM control endpoint for ship system toggles (Plan 02-03)
- TypeScript types for frontend components
- INITIAL_DATA availability for React components

**Enables:**
- Terminal STATUS tab can display ship stats without additional API calls
- GM Console can add ship system toggle controls
- Real-time ship status updates via ActiveView runtime overrides

**Pattern Established:**
- YAML file + ActiveView runtime overrides pattern (reusable for other campaign data)
- Merge-on-read approach (YAML defaults merged with runtime state)
- Public read / GM-only write API pattern

## Next Steps

**Plan 02-02** will build the terminal STATUS tab UI consuming this API.
**Plan 02-03** will add GM Console controls for toggling ship systems using the POST endpoint.

## Self-Check: PASSED

**Files created:**
- ✅ data/campaign/ship.yaml exists
- ✅ src/types/shipStatus.ts exists
- ✅ terminal/migrations/0014_activeview_ship_system_overrides.py exists

**Commits exist:**
- ✅ eb5c8bd (Task 1: Ship data file, DataLoader, TypeScript types)
- ✅ c19bd21 (Task 2: ActiveView model field, API endpoints, INITIAL_DATA wiring)

**API functionality:**
- ✅ GET /api/ship-status/ returns ship data
- ✅ Ship data includes name, hull, armor, systems
- ✅ window.INITIAL_DATA.shipStatus available in template
