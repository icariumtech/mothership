---
status: passed
phase: 14-rework-bridge-status-tab-ship-systems-remove-armor-add-react
source: 14-01-SUMMARY.md, 14-02-SUMMARY.md, 14-03-SUMMARY.md
started: 2026-04-07T21:00:00Z
updated: 2026-04-15T00:35:00Z
---

## Tests

### 1. STATUS Tab — Dual Panel Layout
expected: Open the Bridge view and navigate to the STATUS tab. Instead of the old card-grid layout, you should see two floating terminal-style panels side by side over the deck map background. They should have dark semi-transparent backgrounds, blurred backdrops, and chamfered (angled) corner cuts — not rounded corners.
result: pass

### 2. Left Panel — Ship Stats and Systems
expected: The left panel shows: Thrusters, Battle, and Systems stats rows, then 5 system rows in order: Reactor, Life Support, Engines, Weapons, Comms. At the bottom is a footer showing "X/5 OPERATIONAL" (where X is the count of online systems). Note: Hull and Armor were replaced with ship stats (Thrusters/Battle/Systems) during implementation.
result: pass

### 3. Right Panel — Resources and Crew
expected: The right panel shows 5 resource rows: Fuel, Food, O2, Cryopods, Escape Pods — each with a fill bar. A CREW footer appears at the bottom of the right panel.
result: pass

### 4. System Status Colors
expected: System rows change color based on their status. Online = teal/green tone. Stressed/Damaged = amber/yellow tone. Critical = orange/red tone. Offline = grey/dim. Toggle a system in the GM console and the player view updates with the correct color.
result: pass

### 5. Resource Threshold Colors
expected: Resource rows shift color when low or critical. A resource at 100% looks normal (teal). Drop it to a low value (e.g. 20%) in the GM panel — the bar should shift to amber/orange. Drop to critical (e.g. 5%) — it should shift to red/danger color.
result: pass

### 6. Row Stagger Animation
expected: When the STATUS tab is first opened (or the tab is switched to it), the rows fade and slide in one after another with a slight delay between each row — not all appearing at once.
result: pass

### 7. Crisis Tint
expected: When hull integrity drops below 50% OR any resource drops below 25%, a reddish crisis tint overlay appears on the STATUS panel(s). Above those thresholds, no tint.
result: pass

### 8. GM — Reactor System Toggle
expected: In the GM console ship panel, Reactor appears in the system toggle list alongside Life Support, Engines, Weapons, and Comms. Toggling Reactor changes its state (e.g. ONLINE → OFFLINE) and the player STATUS tab reflects the change in real time.
result: pass

### 9. GM — Resource Controls
expected: In the GM console ship panel, there are InputNumber controls for all 5 resources: Fuel, Food, O2, Cryopods, Escape Pods. Changing a value (by blurring the field or pressing Enter) updates the resource in the player STATUS tab in real time via SSE.
result: pass

### 10. SSE Live Update
expected: With both the GM console and the player terminal open, changing any ship system or resource in the GM panel updates the player STATUS tab without a page reload — within a couple of seconds.
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
