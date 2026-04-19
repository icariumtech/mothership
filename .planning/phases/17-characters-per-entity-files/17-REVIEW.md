---
phase: 17-characters-per-entity-files
reviewed: 2026-04-18T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - terminal/data_loader.py
  - data/campaign/crew/elena_vasquez.yaml
  - data/campaign/crew/marcus_chen.yaml
  - data/campaign/crew/sarah_kim.yaml
  - data/campaign/crew/alex_novak.yaml
  - data/campaign/npcs/lucia_vance.yaml
  - data/campaign/npcs/ewan_mcgregor.yaml
  - data/campaign/npcs/dr_yuki_tanaka.yaml
  - data/campaign/npcs/captain_harrow.yaml
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-04-18
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the refactored `load_crew()` / `load_npcs()` methods and all eight per-entity YAML files introduced in this phase.

The directory-glob approach is structurally sound and the duplicate-ID guard is a good addition. However, there is one runtime crash bug (`logger` is undefined), three error-handling gaps in the loader, and two data-integrity errors in the YAML files (wrong portrait paths on two crew members).

---

## Critical Issues

### CR-01: `logger` is undefined — duplicate-ID warning crashes at runtime

**File:** `terminal/data_loader.py:455` and `terminal/data_loader.py:477`

**Issue:** Both `load_crew()` and `load_npcs()` call `logger.warning(...)` to report a duplicate ID, but `logger` is never imported or defined anywhere in this module. At runtime, hitting a duplicate ID will raise `NameError: name 'logger' is not defined`, aborting the entire load rather than gracefully skipping the duplicate. The intent (warn and continue) becomes a hard crash.

**Fix:** Either add a standard-library logger at module level, or replace the calls with `print`/`warnings.warn` as a lightweight alternative:

```python
import logging
logger = logging.getLogger(__name__)
```

Place this near the top of the file after the existing imports. No other changes needed — the call sites are already correct once `logger` exists.

---

## Warnings

### WR-01: No exception handling around per-file YAML load — one bad file aborts all

**File:** `terminal/data_loader.py:449-450` and `terminal/data_loader.py:471-472`

**Issue:** The `open()` + `yaml.safe_load()` calls inside the glob loop are unwrapped. A single unreadable file (permissions, encoding error) or malformed YAML will raise an exception that propagates out of `load_crew()` / `load_npcs()` entirely, silently dropping all characters rather than skipping only the bad file. This is especially fragile during content authoring when partial/broken files are common.

**Fix:** Wrap each file load in a `try/except` and log + continue:

```python
for path in sorted(crew_dir.glob('*.yaml')):
    try:
        with open(path) as f:
            character = yaml.safe_load(f)
    except (OSError, yaml.YAMLError) as exc:
        logger.warning(f"Skipping crew file {path}: {exc}")
        continue
    if character is None:
        continue
    # ... rest of loop
```

Apply the same pattern in `load_npcs()`.

---

### WR-02: `None` ID treated as a valid dedup key — second `id`-less file silently dropped

**File:** `terminal/data_loader.py:453-457` and `terminal/data_loader.py:475-479`

**Issue:** When a YAML file has no `id` field, `character.get('id')` returns `None`. `None` is then added to `seen_ids`. If a second file also lacks an `id`, it matches `None in seen_ids` and is dropped as a "duplicate" with no meaningful diagnostic. Both files should be loaded (or explicitly rejected with a clear message), not silently coalesced.

**Fix:** Guard against `None` before the dedup check:

```python
char_id = character.get('id')
if char_id is None:
    logger.warning(f"Crew file {path} missing required 'id' field — skipping")
    continue
if char_id in seen_ids:
    logger.warning(f"Duplicate crew id '{char_id}' in {path} — skipping")
    continue
seen_ids.add(char_id)
```

Apply identically in `load_npcs()`.

---

### WR-03: `elena_vasquez.yaml` — portrait points to Lucia Vance's image

**File:** `data/campaign/crew/elena_vasquez.yaml:5`

**Issue:** `portrait: "/data/campaign/NPCs/images/lucia_vance.png"` is a copy-paste error. Elena Vasquez is being assigned Lucia Vance's portrait. Additionally, the path uses `NPCs` (uppercase) while the actual data directory is `npcs` (lowercase), which will fail on case-sensitive filesystems (Linux).

**Fix:** Either create a dedicated portrait for Elena Vasquez or leave the field absent/null until one exists. If reusing the path, correct the casing:

```yaml
portrait: "/data/campaign/npcs/images/elena_vasquez.png"
```

---

### WR-04: `marcus_chen.yaml` — portrait points to Ewan McGregor's image

**File:** `data/campaign/crew/marcus_chen.yaml:7`

**Issue:** `portrait: "/data/campaign/NPCs/images/ewan_mcgregor.png"` is a copy-paste error. Marcus Chen (crew) is pointing to an NPC's portrait. Same uppercase `NPCs` path casing issue as WR-03.

**Fix:**

```yaml
portrait: "/data/campaign/npcs/images/marcus_chen.png"
```

Or omit the field until a real portrait exists.

---

## Info

### IN-01: `dr_yuki_tanaka.yaml` — `faction` field absent; inconsistent with other NPCs

**File:** `data/campaign/npcs/dr_yuki_tanaka.yaml`

**Issue:** The other three NPC files (`lucia_vance`, `ewan_mcgregor`, `captain_harrow`) all include a `faction` field. `dr_yuki_tanaka` omits it entirely. If any frontend code reads `npc.faction` without a null guard, it will render `undefined` or throw. The omission may be intentional (unknown faction), but should be explicit.

**Fix:** Add an explicit null or descriptive value:

```yaml
faction: null   # or "Unknown" / "Independent"
```

---

### IN-02: `callsign` field only present on `marcus_chen` — inconsistent crew schema

**File:** `data/campaign/crew/marcus_chen.yaml:3`

**Issue:** Only Marcus Chen has a `callsign` field. The three other crew files (`elena_vasquez`, `sarah_kim`, `alex_novak`) omit it. This is not a crash risk since `yaml.safe_load` will simply not include the key, but it creates an inconsistent schema that may cause silent `undefined` renders in the frontend if `callsign` is templated without a null guard.

**Fix:** Either add `callsign: null` to the other three crew files to make the schema explicit, or remove it from `marcus_chen` if callsigns are not a supported field yet.

---

_Reviewed: 2026-04-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
