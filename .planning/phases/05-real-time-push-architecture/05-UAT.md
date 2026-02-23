---
status: complete
phase: 05-real-time-push-architecture
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md
started: 2026-02-23T00:00:00Z
updated: 2026-02-23T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Instant view switch — player terminal
expected: With both the GM console and player terminal open in separate browser tabs/windows, use the GM console to switch the displayed view (e.g., click a location's DISPLAY button or switch from STANDBY to BRIDGE). The player terminal should update within about 1 second — noticeably faster than the old 2-second polling delay. There should be no visible lag waiting for a poll cycle.
result: pass

### 2. Instant view switch — GM console self-update
expected: When the GM takes an action in the GM console (e.g., switches the active view), the GM console's own state should also reflect the change immediately — no 5-second wait for the old polling cycle. If the GMConsole shows the current view state anywhere, it should update right away.
result: pass

### 3. Encounter room reveal propagates in real time
expected: With the player terminal showing the ENCOUNTER view and the GM console open to the EncounterPanel, toggle a room's visibility (reveal a hidden room). The player terminal should show the newly revealed room within ~1 second, without the player needing to wait for a poll.
result: pass

### 4. Token move propagates in real time
expected: In the GM console EncounterPanel, drag a token to a new position. The player terminal should show the token at its new position within ~1 second.
result: pass

### 5. Connection lost warning toast
expected: Stop the Django server while the player terminal or GM console is open. A red warning toast should appear at the top of the page indicating the connection has been lost. When the server restarts, the toast should disappear and state should resume updating normally.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
