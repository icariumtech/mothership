---
phase: 17-characters-per-entity-files
verified: 2026-04-18T12:30:00Z
status: human_needed
score: 7/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Hit the active-view API endpoint and compare crew/npcs array structure to expected shape"
    expected: "Response contains crew array with 4 members (alex_novak, elena_vasquez, marcus_chen, sarah_kim) and npcs array with 4 entries (captain_harrow, dr_yuki_tanaka, ewan_mcgregor, lucia_vance) — each item a flat dict with id, name, role, and other character fields at top level (no wrapper key in the payload)"
    why_human: "Requires a running Django server; cannot invoke the endpoint programmatically during static verification"
  - test: "Open GM Console in a browser, navigate to BRIDGE view, open the PERSONNEL tab"
    expected: "All 4 crew members and all 4 NPCs are listed with names, roles, and portraits rendered correctly — no blank panels, no console errors"
    why_human: "Visual rendering of the React component requires a live browser session; cannot assert UI correctness from static code analysis"
---

# Phase 17: Characters Per-Entity Files Verification Report

**Phase Goal:** Split monolithic crew.yaml and npcs.yaml into per-entity files, and update DataLoader to load from the new directories.
**Verified:** 2026-04-18T12:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | data/campaign/crew/ directory contains one .yaml file per crew member | VERIFIED | `ls data/campaign/crew/` shows 4 files: alex_novak.yaml, elena_vasquez.yaml, marcus_chen.yaml, sarah_kim.yaml |
| 2 | data/campaign/npcs/ directory contains one .yaml file per NPC | VERIFIED | `ls data/campaign/npcs/` shows 4 files: captain_harrow.yaml, dr_yuki_tanaka.yaml, ewan_mcgregor.yaml, lucia_vance.yaml |
| 3 | data/campaign/crew.yaml deleted | VERIFIED | `ls data/campaign/crew.yaml` returns "deleted: OK" — file does not exist |
| 4 | data/campaign/npcs.yaml deleted | VERIFIED | `ls data/campaign/npcs.yaml` returns "deleted: OK" — file does not exist |
| 5 | load_crew() globs campaign/crew/*.yaml with no crew: wrapper key | VERIFIED | `DataLoader().load_crew()` returns 4 flat dicts; all have `id` directly at top level; `all('id' in c for c in crew)` is True; code at lines 451-470 uses `crew_dir.glob('*.yaml')` and calls `yaml.safe_load(f)` directly (no `['crew']` key access) |
| 6 | load_npcs() globs campaign/npcs/*.yaml with no npcs: wrapper key | VERIFIED | `DataLoader().load_npcs()` returns 4 flat dicts; all have `id` directly at top level; code at lines 480-498 mirrors same pattern |
| 7 | id uniqueness enforced in load_crew() and load_npcs() | VERIFIED | Both methods maintain a `seen_ids` set (lines 450, 479); duplicate IDs trigger `logger.warning(f"Duplicate ... — skipping")` and the entry is skipped; missing `id` field also warned and skipped (lines 462, 491) |
| 8 | API responses for crew and NPCs are structurally identical to before | ? NEEDS HUMAN | Cannot verify without running server; DataLoader returns correct data but full API response shape (JSON serialization in the view) requires a live endpoint check |

**Score:** 7/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `data/campaign/crew/alex_novak.yaml` | Per-character file, flat dict | VERIFIED | id, name, role, class, stats, saves, health, status fields present |
| `data/campaign/crew/elena_vasquez.yaml` | Per-character file, flat dict | VERIFIED | id, name, role, class, portrait, stats, saves, health, status fields present |
| `data/campaign/crew/marcus_chen.yaml` | Per-character file, flat dict | VERIFIED | id, name, role, class, portrait, stats, saves, health, status fields present |
| `data/campaign/crew/sarah_kim.yaml` | Per-character file, flat dict | VERIFIED | id, name, role, class, portrait, stats, saves, health, status fields present |
| `data/campaign/npcs/captain_harrow.yaml` | Per-NPC file, flat dict | VERIFIED | id, name, role, faction, location, status, description fields present |
| `data/campaign/npcs/dr_yuki_tanaka.yaml` | Per-NPC file, flat dict | VERIFIED | id, name, role, location, status, description fields present |
| `data/campaign/npcs/ewan_mcgregor.yaml` | Per-NPC file, flat dict | VERIFIED | id, name, role, faction, location, status, description fields present |
| `data/campaign/npcs/lucia_vance.yaml` | Per-NPC file, flat dict | VERIFIED | id, name, role, faction, location, portrait, status, description fields present |
| `terminal/data_loader.py` (load_crew + load_npcs) | Updated to glob directories | VERIFIED | Both methods rewritten at lines 439-498; error handling, uniqueness guards, and missing-id guards added beyond the plan spec |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `load_crew()` | `data/campaign/crew/*.yaml` | `Path.glob('*.yaml')` + `yaml.safe_load` | WIRED | Line 451: `sorted(crew_dir.glob('*.yaml'))` iterates all files; each loaded with `yaml.safe_load(f)` |
| `load_npcs()` | `data/campaign/npcs/*.yaml` | `Path.glob('*.yaml')` + `yaml.safe_load` | WIRED | Line 480: `sorted(npcs_dir.glob('*.yaml'))` iterates all files; each loaded with `yaml.safe_load(f)` |
| `DataLoader.load_crew()` result | API response | Django view calls `dl.load_crew()` | NEEDS HUMAN | View code not read in this phase; runtime verification of full chain requires running server |

### Data-Flow Trace (Level 4)

Not applicable — `data_loader.py` is a backend data loading module, not a UI component. The data-flow chain from YAML files through DataLoader to the API response to the React PERSONNEL tab requires a running server for full end-to-end validation (covered in human verification items).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| DataLoader.load_crew() returns 4 crew members | `python3 -c "from terminal.data_loader import DataLoader; print(len(DataLoader().load_crew()))"` | 4 | PASS |
| DataLoader.load_npcs() returns 4 NPCs | `python3 -c "from terminal.data_loader import DataLoader; print(len(DataLoader().load_npcs()))"` | 4 | PASS |
| crew ids match expected slugs | `python3 -c "..."` | ['alex_novak', 'elena_vasquez', 'marcus_chen', 'sarah_kim'] | PASS |
| npc ids match expected slugs | `python3 -c "..."` | ['captain_harrow', 'dr_yuki_tanaka', 'ewan_mcgregor', 'lucia_vance'] | PASS |
| No crew: wrapper key in output | all('id' in c for c in crew) | True | PASS |
| crew.yaml deleted | `ls data/campaign/crew.yaml` | not found | PASS |
| npcs.yaml deleted | `ls data/campaign/npcs.yaml` | not found | PASS |

### Requirements Coverage

No requirement IDs specified for this phase.

### Anti-Patterns Found

None. No TODOs, FIXMEs, placeholders, empty returns, or hardcoded stubs found in the modified files. The implementation in `terminal/data_loader.py` adds defensive error handling (try/except on file reads, missing-id guard) that exceeds the plan spec.

### Human Verification Required

**1. API Response Structure Check**

**Test:** With server running (`./start_server.sh`), run `curl http://localhost:8000/api/active-view/` and inspect the JSON response.
**Expected:** `crew` array contains 4 objects with flat character fields (id, name, role, stats, etc. at top level — not nested under a `crew:` key). `npcs` array contains 4 objects with flat NPC fields. Structure matches what the frontend PERSONNEL tab expects.
**Why human:** Requires a running Django server; also validates the view layer's serialization of DataLoader output which was not changed in this phase but must still pass data through correctly.

**2. GM Console PERSONNEL Tab Render**

**Test:** Open `http://localhost:8000/gmconsole/` in a browser, switch to BRIDGE view, click the PERSONNEL tab.
**Expected:** All 4 crew members (Dr. Elena Vasquez, Marcus Chen, Lt. Sarah Kim, Alex Novak) and all 4 NPCs (Dr. Lucia Vance, Ewan McGregor, Dr. Yuki Tanaka, Captain Dex Harrow) are displayed with their names and roles. Portraits render for crew members that have portrait paths. No blank panels, no JavaScript console errors.
**Why human:** Visual rendering cannot be asserted from static code analysis; React component rendering and CSS layout require a live browser session.

### Gaps Summary

No blocking gaps. All 7 programmatically verifiable must-haves pass. Truth #8 (API response structure identical to before) requires a running server to confirm end-to-end — the DataLoader output is correct, but the view layer's JSON serialization is outside the scope of static analysis. Both human verification items are routine smoke tests, not indicators of a broken implementation.

---

_Verified: 2026-04-18T12:30:00Z_
_Verifier: Claude (gsd-verifier)_
