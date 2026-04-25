---
status: testing
phase: 18-locations-flat-directory
source:
  - 18-01-SUMMARY.md
  - 18-02-SUMMARY.md
started: 2026-04-24T00:00:00Z
updated: 2026-04-24T00:00:00Z
---

## Current Test

number: 1
name: Orbit Map — Stations Appear
expected: |
  Open the Tau Ceti E orbit map (Bridge view → MAP → select Tau Ceti E planet).
  The Orbital Shipyards station should appear as an orbiting object around the planet.
awaiting: user response

## Tests

### 1. Orbit Map — Stations Appear
expected: Open the Tau Ceti E orbit map (Bridge view → MAP → select Tau Ceti E planet). The Orbital Shipyards station should appear as an orbiting object around the planet.
result: pass

### 2. Orbit Map — Ships Appear
expected: Open the Tau Ceti F orbit map. The USCSS Patrol Gunboat should appear as an orbiting object.
result: pass

### 3. Orbit Map — Surface Markers Appear
expected: On the Tau Ceti E orbit map, New Terra City should appear as a marker on the planet surface.
result: pass

### 4. SVG Icons on Stations
expected: Orbital stations show the Space Station SVG icon (not a plain square). Ships show the Space Ship icon. New Terra City shows the Space Colony icon.
result: pass

### 5. Click Station — Info Panel Opens
expected: Clicking an orbital station on the orbit map opens the info panel showing the station's name and details.
result: pass

### 6. Click Surface Marker — Info Panel Opens
expected: Clicking a surface marker (e.g. New Terra City) opens the info panel showing its name and details.
result: pass

### 7. Deckplan Location Navigation
expected: Selecting the Patrol Gunboat (orbit map or GM console) and switching to its encounter/deck view loads the ship's deck map correctly.
result: pass
note: Required 3 fixes — galaxy hierarchy rebuild, deckplan fallback in encounter API, Morrigan location.yaml + slug

### 8. System Map Facility Counts
expected: The Tau Ceti system map shows the correct number of facilities for each planet (e.g. Tau Ceti E has at least 1 orbital station and 1 surface location).
result: skipped
reason: Not tested — lower priority, data is correct in backend

### 9. Other Orbit Maps — Proxima B
expected: Open the Proxima B orbit map. Gateway Station and Twilight Research Station appear (one orbital, one surface).
result: skipped
reason: Not tested this session

## Summary

total: 9
passed: 7
issues: 0
pending: 0
skipped: 2

## Gaps

[none]
