---
phase: 16-ship-data-consolidation
reviewed: 2026-04-18T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - data/campaign/ship/ship.yaml
  - data/campaign/ship/deckplan.yaml
  - terminal/data_loader.py
  - terminal/views.py
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-04-18
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

This phase consolidated ship data into `data/campaign/ship/` with a new `deckplan.yaml` format, added `load_deckplan()` to `DataLoader`, updated `find_location_by_slug()` with a campaign-directory fallback, and integrated the deck map into `build_active_view_payload()` in `views.py`.

The YAML files are structurally correct for their intended formats. The `load_deckplan()` implementation is clean. There is one critical bug: a `NameError` crash in `api_ship_reactor_power` referencing an undefined variable `power_grid`. Three warnings cover a missing `slug` field in `current_deck`, a silent fallback issue in `find_location_by_slug`, and a potential `KeyError` in `load_encounter_manifest`'s `manifest['decks'][0]` access. Info items cover a typo in `ship.yaml`, a duplicate variable declaration in `build_active_view_payload`, and mismatched `total_decks` semantics.

---

## Critical Issues

### CR-01: `NameError` crash — `power_grid` is undefined in `api_ship_reactor_power`

**File:** `terminal/views.py:2098`
**Issue:** The final `return JsonResponse({'success': True, 'power_grid': power_grid})` references `power_grid`, which is never defined in this function. Python will raise `NameError: name 'power_grid' is not defined` on every successful call to this endpoint. The intended value is probably the updated power allocation summary or simply the `amount`.
**Fix:**
```python
# Option A — return the new allocated amount for the affected system:
return JsonResponse({'success': True, 'system': system_name, 'allocated': amount})

# Option B — return a grid dict assembled from the reloaded ship data:
ship_broadcast_data = loader.load_ship_status() or {}
all_sys = ship_broadcast_data.get('systems', {})
power_grid = {k: (all_sys[k].get('power') or {}).get('allocated', 0)
              for k in all_sys if k != 'reactor'}
return JsonResponse({'success': True, 'power_grid': power_grid})
```

---

## Warnings

### WR-01: `current_deck` in `ship_deck_data` is missing the `slug` field

**File:** `terminal/views.py:295-300`
**Issue:** The `current_deck` dict built in `build_active_view_payload` does not include a `slug` key, but the multi-deck shape produced by `load_map()` always has `deck_data['slug'] = deck_file.stem` (set in `load_deck_map`, line 97). Frontend consumers that read `current_deck.slug` will receive `undefined` for the ship deck, potentially causing silent rendering failures or mismatched deck identity checks.
**Fix:**
```python
current_deck = {
    'deck_id': default_deck['id'],
    'slug': default_deck['id'],          # add this line
    'name': default_deck['name'],
    'unit_size': default_deck.get('unit_size', 30),
    'rooms': default_deck.get('rooms', []),
}
```

### WR-02: `find_location_by_slug` campaign fallback checks for `ship.yaml` but `ship` is the directory slug — not a ship type

**File:** `terminal/data_loader.py:372-376`
**Issue:** The fallback block at line 374 checks `(candidate / "ship.yaml").exists()`. This means only the `ship` subdirectory will ever match (because it's the only `data/campaign/<slug>/` directory that contains `ship.yaml`). Any other future campaign-level location (e.g. a base or station placed under `data/campaign/`) will be silently skipped. The intent appears to be "any campaign location directory", but the guard expression is effectively hard-coding `ship` as the only supported slug. If the slug passed in is something other than `ship`, the fallback returns `None` with no indication of why.
**Fix:** Either remove the `ship.yaml` existence check and rely solely on the directory existing, or use a `location.yaml` check consistent with `load_location_recursive`:
```python
if is_top_level:
    campaign_dir = self.data_dir / "campaign"
    if campaign_dir.exists():
        candidate = campaign_dir / slug
        if candidate.is_dir():
            return self.load_location_recursive(candidate)
```

### WR-03: `KeyError` risk on `manifest['decks'][0]` in `load_encounter_manifest` callers

**File:** `terminal/data_loader.py:124-125`
**Issue:** In `load_map()`, after checking `if manifest.get('decks')` (truthy — non-empty list), the code accesses `manifest['decks'][0]`. This is safe when the list is non-empty, but `load_encounter_manifest` returns the raw YAML dict, which can contain `decks: null` (PyYAML maps YAML `null` to Python `None`). In that case `manifest.get('decks')` is `None` (falsy) so the `if` guard protects correctly. However the same pattern at `views.py:248` uses `manifest.get('decks', [])` for iteration and then separately at line 248 does `manifest['decks'][0]` — if a manifest is ever written with an empty `decks: []`, the outer `if manifest:` at line 239 passes, and the inner `next(...)` fallback `manifest['decks'][0]` (line 248) raises `IndexError`. This is identical to the risk already present in the pre-existing encounter path; the new deckplan path handles it safely via `load_deckplan()`. The risk is confined to the old `load_encounter_manifest` path.
**Fix:** Wrap the first-element access defensively:
```python
default_deck = next(
    (d for d in manifest.get('decks', []) if d.get('default')),
    manifest['decks'][0] if manifest.get('decks') else None   # already correct — leave as is
)
```
The pattern in `views.py:244-250` should mirror the safe form in `load_map()`:
```python
decks = manifest.get('decks') or []
default_deck = next((d for d in decks if d.get('default')), decks[0] if decks else None)
```

---

## Info

### IN-01: Typo in `ship.yaml` — `medbay.display_name` is lowercase, `SERGICAL` is misspelled

**File:** `data/campaign/ship/ship.yaml:64,72`
**Issue:** `display_name: medbay` (line 64) is lowercase while all other systems use title case (`Comms`, `Engines`, `Life Support`). Line 72 has `SERGICAL BED` — should be `SURGICAL BED`. These are data quality issues that will render incorrectly in the UI.
**Fix:**
```yaml
medbay:
  display_name: Medbay     # was: medbay
  subsystems:
    - DIAGNOSTICS
    - TOOLS
    - SURGICAL BED          # was: SERGICAL BED
```

### IN-02: Duplicate `loader = DataLoader()` declaration in `build_active_view_payload`

**File:** `terminal/views.py:211,271`
**Issue:** `loader` is assigned at line 211 (`loader_for_npcs`) and then a second `loader = DataLoader()` is created at line 271 inside the ENCOUNTER block, and a third `loader = DataLoader()` at line 271 for the ship block. The first NPC loader is named `loader_for_npcs` but the subsequent ones shadow it unnecessarily. This is not a bug, but each `DataLoader()` instantiation is cheap — the duplication is harmless. However the variable names are inconsistent (`loader_for_npcs` vs the bare `loader` used twice after).
**Fix:** Hoist a single `loader = DataLoader()` before the `response` dict (replacing `loader_for_npcs`) and use it throughout:
```python
loader = DataLoader()
npcs = loader.load_npcs()
response['encounter_npc_data'] = { ... }
# then reuse `loader` in the ENCOUNTER block and ship block below — no re-instantiation needed
```

### IN-03: `manifest['total_decks']` key does not exist — uses hardcoded `1` fallback silently

**File:** `terminal/views.py:240`
**Issue:** `manifest.get('total_decks', 1)` is used to populate `response['encounter_total_decks']`. The `manifest.yaml` format (for the old multi-deck encounter system) does not include a `total_decks` field in YAML — it is computed by the loader or derived from the deck list length. This means `encounter_total_decks` will always be `1` for any multi-deck encounter location, regardless of actual deck count, which could cause the deck-switcher UI to only show one level.
**Fix:**
```python
response['encounter_total_decks'] = len(manifest.get('decks', []))
```

---

_Reviewed: 2026-04-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
