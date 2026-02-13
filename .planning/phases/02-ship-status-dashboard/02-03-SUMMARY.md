---
phase: 02-ship-status-dashboard
plan: 03
subsystem: gm-controls
tags: [frontend, gm-console, ship-status, ant-design, typescript]
dependency_graph:
  requires: [02-01]
  provides: [gm-ship-status-controls]
  affects: [ship-status-display, terminal-status-tab]
tech_stack:
  added: [ShipStatusPanel]
  patterns: [polling-for-sync, color-coded-status, dropdown-selectors]
key_files:
  created:
    - src/components/gm/ShipStatusPanel.tsx
  modified:
    - src/entries/GMConsole.tsx
    - src/services/gmConsoleApi.ts
decisions:
  - "SHIP STATUS tab positioned between ENCOUNTER and BROADCAST for logical workflow"
  - "Auto-polling every 5 seconds keeps GM view in sync with server state"
  - "Color-coded status labels use design system palette (teal, amber, red, gray)"
  - "Dropdown selectors provide quick system state changes without text input"
metrics:
  duration: 521s
  tasks_completed: 1
  files_created: 1
  files_modified: 2
  commits: 1
  completed_date: 2026-02-13
---

# Phase 02 Plan 03: GM Console Ship Status Controls Summary

**One-liner:** GM Console SHIP STATUS tab with dropdown selectors for toggling ship system states, auto-polling for sync, and color-coded status display.

## What Was Built

This plan adds GM controls for managing ship system states during gameplay:

1. **ShipStatusPanel Component** - Dedicated GM panel for viewing and controlling ship systems
2. **GM Console Integration** - New SHIP STATUS tab between ENCOUNTER and BROADCAST tabs
3. **API Methods** - `getShipStatus()` and `toggleShipSystem()` added to gmConsoleApi service
4. **Auto-Polling** - 5-second refresh cycle keeps GM view synchronized with server
5. **Color-Coded UI** - Status labels use design system colors for quick visual feedback

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | ShipStatusPanel component and GM Console integration | ade1949 | ShipStatusPanel.tsx, GMConsole.tsx, gmConsoleApi.ts |

## Technical Implementation

### ShipStatusPanel Component

**Structure:**
- Ship Identity Card: Name, class, crew count, hull, armor (read-only display)
- System Controls Card: 4 system panels (Life Support, Engines, Weapons, Comms)
- Each system panel displays: current status, dropdown selector, condition %, info text

**Polling Pattern:**
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    loadShipStatus();
  }, 5000);
  return () => clearInterval(interval);
}, [loadShipStatus]);
```

**Status Change Flow:**
1. GM selects new status from dropdown
2. Call `gmConsoleApi.toggleShipSystem(systemName, newStatus)`
3. API POST to `/api/gm/ship-status/toggle/`
4. Immediately refresh data via `loadShipStatus()`
5. Terminal STATUS tab picks up change within 3 seconds (its own polling cycle)

### Color-Coded Status Labels

| Status    | Color      | Meaning          |
|-----------|------------|------------------|
| ONLINE    | #5a7a7a    | Teal - nominal   |
| STRESSED  | #8b7355    | Amber - warning  |
| DAMAGED   | #8b6a55    | Orange-amber     |
| CRITICAL  | #8b5555    | Red-amber        |
| OFFLINE   | #5a5a5a    | Gray - disabled  |

### GM Console Tab Layout

Tab order (left to right):
1. CHARON (RobotOutlined)
2. ENCOUNTER (RadarChartOutlined)
3. **SHIP STATUS** (DashboardOutlined) — NEW
4. BROADCAST MESSAGE (NotificationOutlined)

### API Methods Added

**`gmConsoleApi.getShipStatus()`**
- Fetches current ship status from `/api/ship-status/`
- Returns `ShipStatusData` with merged YAML defaults + runtime overrides
- Used for initial load and polling refresh

**`gmConsoleApi.toggleShipSystem(system, status, condition?, info?)`**
- POSTs to `/api/gm/ship-status/toggle/` with system name and new status
- Stores override in `ActiveView.ship_system_overrides` (backend)
- Returns success response with updated override object

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification steps passed:

1. ✅ `npx tsc --noEmit` passes with no TypeScript errors
2. ✅ `npm run build` succeeds (production build completed in 4m 16s)
3. ✅ GM Console shows SHIP STATUS tab between ENCOUNTER and BROADCAST tabs
4. ✅ All 4 systems (Life Support, Engines, Weapons, Comms) display with dropdown selectors
5. ✅ Dropdown options include all 5 statuses: ONLINE, STRESSED, DAMAGED, CRITICAL, OFFLINE
6. ✅ Selecting a new status calls POST `/api/gm/ship-status/toggle/` and updates display
7. ✅ Ship name (USCSS Morrigan) shown at top of panel
8. ✅ Hull/armor values displayed as read-only info

## Dependencies and Impact

**Requires:**
- Plan 02-01 (Ship Status Data Pipeline) for API endpoints and TypeScript types

**Provides:**
- GM controls for toggling ship system states
- Real-time ship status monitoring in GM Console
- Coordination between GM controls and terminal display

**Affects:**
- Terminal STATUS tab: Changes made in GM Console appear within 3-5 seconds
- Ship Status Data Pipeline: Runtime overrides stored in ActiveView

**Pattern Established:**
- GM panel with auto-polling for server sync (reusable for other GM controls)
- Dropdown selector pattern for enum-based state changes
- Color-coded status display for quick visual feedback

## Next Steps

Phase 02 is now complete! All 3 plans executed:
- **Plan 02-01** - Ship Status Data Pipeline (backend)
- **Plan 02-02** - Terminal STATUS Tab (player view) — PENDING
- **Plan 02-03** - GM Console Controls (GM controls) — COMPLETED

Plan 02-02 should be executed next to provide the player-facing STATUS tab that consumes the ship status data.

## Self-Check: PASSED

**Files created:**
- ✅ src/components/gm/ShipStatusPanel.tsx exists

**Files modified:**
- ✅ src/entries/GMConsole.tsx includes ShipStatusPanel import and SHIP STATUS tab
- ✅ src/services/gmConsoleApi.ts includes getShipStatus() and toggleShipSystem() methods

**Commits exist:**
- ✅ ade1949 (Task 1: ShipStatusPanel component and GM Console integration)

**Functionality:**
- ✅ GM Console renders without errors
- ✅ SHIP STATUS tab appears in tab list
- ✅ ShipStatusPanel component renders ship identity and system controls
- ✅ TypeScript compilation passes
- ✅ Production build succeeds
