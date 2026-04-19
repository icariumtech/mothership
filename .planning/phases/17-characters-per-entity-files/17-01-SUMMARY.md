---
plan: "17-01"
phase: "17-characters-per-entity-files"
status: complete
completed: "2026-04-18"
---

# Summary: 17-01 Characters Per-Entity Files

## What Was Built

Split monolithic `data/campaign/crew.yaml` and `data/campaign/npcs.yaml` into per-entity YAML files. Updated `DataLoader.load_crew()` and `DataLoader.load_npcs()` to glob the new directories instead of reading single wrapper files.

## Key Files

### Created
- `data/campaign/crew/elena_vasquez.yaml`
- `data/campaign/crew/marcus_chen.yaml`
- `data/campaign/crew/sarah_kim.yaml`
- `data/campaign/crew/alex_novak.yaml`
- `data/campaign/npcs/lucia_vance.yaml`
- `data/campaign/npcs/ewan_mcgregor.yaml`
- `data/campaign/npcs/dr_yuki_tanaka.yaml`
- `data/campaign/npcs/captain_harrow.yaml`

### Modified
- `terminal/data_loader.py` — `load_crew()` and `load_npcs()` rewritten to glob `*.yaml` from directories

### Deleted
- `data/campaign/crew.yaml`
- `data/campaign/npcs.yaml`

## Verification

- `DataLoader.load_crew()` returns 4 crew members (alex_novak, elena_vasquez, marcus_chen, sarah_kim)
- `DataLoader.load_npcs()` returns 4 NPCs (captain_harrow, dr_yuki_tanaka, ewan_mcgregor, lucia_vance)
- Old monolithic files deleted
- ID uniqueness enforced with duplicate detection

## Deviations

None. Implemented exactly as specified in the plan.

## Self-Check: PASSED
