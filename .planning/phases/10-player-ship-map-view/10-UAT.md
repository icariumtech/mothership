---
status: complete
phase: 10-player-ship-map-view
source: 10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md
started: 2026-03-24T03:28:18Z
updated: 2026-03-24T03:35:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Player STATUS Tab — Ship Deck Map Renders
expected: In the player terminal's BRIDGE view, open the STATUS tab. The Morrigan deck map should appear below the hull/armor/system status panels — rendered as an SVG with 6 labeled polygon rooms: BRIDGE, MEDICAL BAY, CARGO BAY, AIRLOCK, CREW QUARTERS, and ENGINEERING.
result: pass

### 2. Player STATUS Tab — Layout
expected: The STATUS tab has two tabs. Systems are on the left side, and the ship deck map is in the middle.
result: pass

### 3. GM BridgeView — Ship Panel Deck Map
expected: In the GM console BRIDGE view, the right-side Ship panel shows ship system toggles (comms, engines, etc.) at the top and the Morrigan deck map rendered below them in the same panel.
result: pass

### 4. Set Ship Location — Right-Click Context Menu Appears
expected: In the GM console Locations panel, right-click any location node (e.g. a planet or station). A small context menu appears near the cursor showing the location name at the top and a "SET SHIP HERE" button below it.
result: pass

### 5. Set Ship Location — Saves and Shows Toast
expected: Click "SET SHIP HERE" in the context menu. The menu closes, and a success toast appears confirming the ship location was updated. The change persists — check data/campaign/ship.yaml and the location_slug field should reflect the chosen location.
result: pass

### 6. Set Ship Location — Context Menu Dismissal
expected: Right-click a location node to open the context menu, then click somewhere else on the page (or press Escape). The context menu closes without triggering any action.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
