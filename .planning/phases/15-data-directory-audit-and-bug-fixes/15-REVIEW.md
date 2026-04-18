---
phase: 15-data-directory-audit-and-bug-fixes
reviewed: 2026-04-17T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - tools/validate_body_slugs.py
  - terminal/data_loader.py
  - data/galaxy/tau-ceti/system_map.yaml
  - data/galaxy/proxima-centauri/system_map.yaml
  - data/galaxy/ross-128/system_map.yaml
  - data/galaxy/epsilon-eridani/system_map.yaml
  - data/galaxy/luyten-star/system_map.yaml
  - data/galaxy/sol/system_map.yaml
  - data/galaxy/trappist-1/system_map.yaml
findings:
  critical: 0
  warning: 9
  info: 3
  total: 12
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-04-17
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the data loader, slug validation tool, and all seven system map YAML files. The data loader has two crash-on-None patterns from unguarded `yaml.safe_load()` calls, a silent bug in fault indicator saving, and two more None-expansion risks in the message parsers. Five `location_slug` values in the YAML files point to directories that do not yet exist on disk — these will cause the slug validator to report failures and may break map navigation if those slugs are resolved at runtime. No critical security issues were found.

## Warnings

### WR-01: `load_location_recursive` crashes on empty `location.yaml`

**File:** `terminal/data_loader.py:44-48`
**Issue:** `yaml.safe_load()` returns `None` when the file is empty or contains only comments. The result is immediately assigned without a None guard, so `location_data['slug'] = location_dir.name` on line 48 raises `AttributeError: 'NoneType' object has no attribute '__setitem__'`. Any empty or comment-only `location.yaml` will crash the entire location tree load.
**Fix:**
```python
location_data = yaml.safe_load(f) or {"name": location_dir.name}
```

### WR-02: `load_map` crashes on empty map YAML file

**File:** `terminal/data_loader.py:144-148`
**Issue:** Same unguarded `yaml.safe_load()` pattern. If a `.yaml` file in a `map/` directory is empty (e.g. a stub), `map_data` is `None` and `map_data['slug'] = map_slug` on line 148 raises `AttributeError`. The manifest path (line 93) has the same exposure.
**Fix:**
```python
with open(map_file, 'r') as f:
    map_data = yaml.safe_load(f)

if not map_data:
    return None

map_data['slug'] = map_slug
```
Apply the same guard to line 93 in `load_deck_map`: `deck_data = yaml.safe_load(f) or {}` then check `if not deck_data: return None`.

### WR-03: `parse_message_file` crashes on empty frontmatter block

**File:** `terminal/data_loader.py:322-334`
**Issue:** A message file with an empty frontmatter block (`---\n---\nBody text`) causes `yaml.safe_load(parts[1])` to return `None`. This `None` is then unpacked at line 334 with `**frontmatter`, raising `TypeError: argument after ** must be a mapping, not NoneType`. The same pattern occurs in `parse_session_file` at line 521/533.
**Fix:**
```python
# line 322
frontmatter = yaml.safe_load(parts[1]) or {}
# line 521 (parse_session_file)
frontmatter = yaml.safe_load(parts[1]) or {}
```

### WR-04: `save_system_fault_indicator` silently loses updates when `faults` key is absent

**File:** `terminal/data_loader.py:655-657`
**Issue:** `systems.setdefault(system_name, {}).get('faults', [])` returns a brand-new empty list when the `faults` key is missing. That list is never inserted into `systems[system_name]`, so modifications to `faults_list` are not reflected in `ship_data` and nothing is written to disk. The `_save_ship_yaml` call on line 658 saves unchanged data.
**Fix:**
```python
system_entry = systems.setdefault(system_name, {})
faults_list = system_entry.setdefault('faults', [])
if 0 <= index < len(faults_list):
    faults_list[index]['active'] = active
self._save_ship_yaml(ship_data)
```

### WR-05: `trappist-1f` location slug has no directory

**File:** `data/galaxy/trappist-1/system_map.yaml:80`
**Issue:** `location_slug: "trappist-1f"` is declared for TRAPPIST-1f but `data/galaxy/trappist-1/trappist-1f/` does not exist. `validate_body_slugs.py` will report a MISS, and `DataLoader.find_location_by_slug("trappist-1f")` will return `None`, causing silent failures or errors in any code that assumes the slug resolves.
**Fix:** Create the stub directory and a minimal `location.yaml`:
```
data/galaxy/trappist-1/trappist-1f/location.yaml
```

### WR-06: `sol/mars` location slug has no directory

**File:** `data/galaxy/sol/system_map.yaml:67`
**Issue:** `location_slug: "mars"` is declared for Mars but `data/galaxy/sol/mars/` does not exist. Same resolution failure as WR-05.
**Fix:** Create `data/galaxy/sol/mars/location.yaml` with a stub entry.

### WR-07: `proxima-c` location slug has no directory

**File:** `data/galaxy/proxima-centauri/system_map.yaml:52`
**Issue:** `location_slug: "proxima-c"` is declared but `data/galaxy/proxima-centauri/proxima-c/` does not exist.
**Fix:** Create `data/galaxy/proxima-centauri/proxima-c/location.yaml` with a stub entry.

### WR-08: `tau-ceti-g` location slug has no directory

**File:** `data/galaxy/tau-ceti/system_map.yaml:79`
**Issue:** `location_slug: "tau-ceti-g"` is declared for the outer gas giant but `data/galaxy/tau-ceti/tau-ceti-g/` does not exist.
**Fix:** Create `data/galaxy/tau-ceti/tau-ceti-g/location.yaml` with a stub entry.

### WR-09: `epsilon-eridani-b` location slug has no directory

**File:** `data/galaxy/epsilon-eridani/system_map.yaml:30`
**Issue:** `location_slug: "epsilon-eridani-b"` is declared for Epsilon Eridani b but `data/galaxy/epsilon-eridani/epsilon-eridani-b/` does not exist.
**Fix:** Create `data/galaxy/epsilon-eridani/epsilon-eridani-b/location.yaml` with a stub entry.

## Info

### IN-01: `validate_body_slugs.py` does not scan nested body children

**File:** `tools/validate_body_slugs.py:48-64`
**Issue:** `extract_location_slugs` iterates only the top-level `bodies:` list and the document root `location_slug`. If a future YAML schema nests bodies (e.g. moons as children of planets), their `location_slug` / `body_slug` fields will not be checked.
**Fix:** No immediate action needed. If nested body schemas are added, add recursive traversal or a note to the docstring that nested slugs are out of scope.

### IN-02: `load_all_locations` filters only `__pycache__` at the top level

**File:** `terminal/data_loader.py:31`
**Issue:** The guard `system_dir.name != '__pycache__'` prevents accidentally loading Python cache directories, but `load_location_recursive` called on child dirs (line 67) has no equivalent filter. A stray `__pycache__` inside a location subdirectory would be traversed and attempt to load a `location.yaml` from it.
**Fix:**
```python
# In load_location_recursive, line 65-68, add pycache guard:
for subdir in location_dir.iterdir():
    if subdir.is_dir() and subdir.name not in ['comms', 'map', 'maps', '__pycache__']:
```

### IN-03: Single-deck `load_map` uses first YAML file found without sorting

**File:** `terminal/data_loader.py:142`
**Issue:** `yaml_files = [f for f in map_dir.glob("*.yaml") if f.name != "manifest.yaml"]` followed by `map_file = yaml_files[0]` selects an arbitrary file when multiple non-manifest YAMLs exist. `Path.glob()` order is filesystem-dependent. This is unlikely to matter today but could surface if a map directory gains a second YAML stub.
**Fix:**
```python
yaml_files = sorted(f for f in map_dir.glob("*.yaml") if f.name != "manifest.yaml")
```

---

_Reviewed: 2026-04-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
