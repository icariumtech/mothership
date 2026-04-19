---
status: partial
phase: 17-characters-per-entity-files
source: [17-VERIFICATION.md]
started: 2026-04-18T00:00:00Z
updated: 2026-04-18T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. API Response Structure Check
expected: `curl http://localhost:8000/api/active-view/` returns `crew` and `npcs` arrays containing flat character dicts (no wrapper key), 4 members each
result: [pending]

### 2. GM Console PERSONNEL Tab Render
expected: Open `/gmconsole/` in browser, BRIDGE view, PERSONNEL tab — all 4 crew and 4 NPCs render with names, roles, and portraits; no console errors
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
