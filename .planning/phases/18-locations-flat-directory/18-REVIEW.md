---
phase: 18-locations-flat-directory
reviewed: 2026-04-20T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - terminal/data_loader.py
  - terminal/views.py
  - data/galaxy/tau-ceti/tau-ceti-e/orbit_map.yaml
  - data/galaxy/tau-ceti/tau-ceti-f/orbit_map.yaml
  - data/galaxy/sol/earth/orbit_map.yaml
  - data/galaxy/sol/saturn/orbit_map.yaml
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-04-20
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 18 moved non-celestial locations from `data/galaxy/` into a flat `data/locations/` directory and updated `data_loader.py` and `views.py` accordingly. The orbit map YAML files are clean — the static `orbital_stations`/`surface_markers` sections have been correctly removed with explanatory comments. The `DataLoader` refactoring is sound overall: `load_all_locations()`, `find_location_by_slug()`, `get_location_path()`, and `get_location_by_path()` all implement the new lookup priority correctly.

One pre-existing crash bug was uncovered in `api_ship_reactor_power` — a reference to an undefined variable `power_grid` that would cause a `NameError` on every successful power allocation. Two logic errors in `build_active_view_payload` and `load_orbit_map` also need attention.

## Critical Issues

### CR-01: `NameError` crash — `power_grid` undefined in `api_ship_reactor_power`

**File:** `terminal/views.py:2080`
**Issue:** The function computes and saves the new power allocation but then references `power_grid` in the success response, which is never defined anywhere in the function. Every successful POST to `/api/ship-reactor-power/` will raise a `NameError`, returning a 500 instead of the expected 200. The broadcast still fires before the crash (line 2073–2078), so state is saved but the caller never gets confirmation.
**Fix:**
```python
# Replace:
return JsonResponse({'success': True, 'power_grid': power_grid})

# With (recalculate after save, or just drop power_grid from the response):
ship_broadcast_data = loader.load_ship_status()
power_grid = {
    k: (ship_broadcast_data.get('systems', {}).get(k, {}).get('power') or {}).get('allocated', 0)
    for k in valid_systems
}
return JsonResponse({'success': True, 'power_grid': power_grid})
```

## Warnings

### WR-01: `parent_slug` set to system slug instead of direct parent body slug

**File:** `terminal/views.py:232`
**Issue:** When building the encounter location payload, `parent_slug` is set to `location_path[0]` (the system slug) rather than `location_path[1]` (the body slug). For a flat location with path `['sol', 'earth', 'research_base_alpha']`, both `system_slug` and `parent_slug` will be `'sol'` — the actual parent body (`'earth'`) is lost. The consumer in `EncounterView.tsx:163` uses `parent_slug` as a fallback for `system_slug`, so the immediate effect is masked, but any consumer that expects `parent_slug` to be the parent body will get incorrect data.
**Fix:**
```python
# Current (line 229-232):
if len(location_path) >= 1:
    response['location_data']['system_slug'] = location_path[0]
if len(location_path) >= 2:
    response['location_data']['parent_slug'] = location_path[0]  # BUG: should be [1]

# Fixed:
if len(location_path) >= 1:
    response['location_data']['system_slug'] = location_path[0]
if len(location_path) >= 2:
    response['location_data']['parent_slug'] = location_path[1]  # direct parent body
```

### WR-02: `load_orbit_map` silently drops surface locations without an `orbital` block

**File:** `terminal/data_loader.py:587-600`
**Issue:** In the injection loop, if a location has `parent_type: surface` and `body_slug` matching the body but no `orbital:` block, it is silently skipped (the `if not orbital_block: continue` guard at line 588 fires). This is correct for orbit-type locations (stations need coordinates), but surface locations without an `orbital` block — such as `research_base_alpha` — will never appear in `surface_markers`. The old static YAML approach would have included them explicitly. If surface locations are expected to appear in the orbit view without needing orbital coordinates, the guard should only apply to `parent_type == 'orbit'` entries.
**Fix:**
```python
# Current (lines 587-600):
for loc in all_locations:
    if loc.get('body_slug') != body_slug:
        continue
    orbital_block = loc.get('orbital', {})
    if not orbital_block:
        continue  # drops surface locations with no orbital: block

# Fixed — only require orbital block for stations that need position data:
for loc in all_locations:
    if loc.get('body_slug') != body_slug:
        continue
    parent_type = loc.get('parent_type', 'orbit')
    orbital_block = loc.get('orbital', {})
    if parent_type == 'orbit' and not orbital_block:
        continue  # orbit stations must have position data
    entry = {
        'slug': loc['slug'],
        'name': loc.get('name', loc['slug']),
        **orbital_block,
    }
    if parent_type == 'orbit':
        orbital_stations.append(entry)
    elif parent_type == 'surface':
        surface_markers.append(entry)
```

## Info

### IN-01: `load_encounter_manifest` is still present and used by `load_map` / `load_deck_map`

**File:** `terminal/data_loader.py:108-114`
**Issue:** The phase notes that `load_encounter_manifest()` calls were replaced with `load_deckplan()`, but `load_encounter_manifest()` itself is retained and is still called internally by `load_map()` (line 153) and `load_deck_map()` (line 118). This is not a bug — those paths handle old-format `manifest.yaml` locations — but the method now has two distinct purposes (old manifest format vs. new deckplan format) and the naming is confusing. Consider either renaming it to `_load_manifest_yaml()` to signal it is an internal implementation detail, or adding a docstring clarifying it is the legacy format handler.

---

_Reviewed: 2026-04-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
