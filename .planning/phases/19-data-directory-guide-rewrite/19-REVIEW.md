---
phase: 19-data-directory-guide-rewrite
reviewed: 2026-05-06T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - DATA_DIRECTORY_GUIDE.md
findings:
  critical: 4
  warning: 7
  info: 3
  total: 14
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-05-06
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

`DATA_DIRECTORY_GUIDE.md` is a developer-facing reference document. The review verified every factual claim against the actual codebase: directory structure, backend data_loader.py behavior, frontend type defaults, and YAML schemas. Four critical factual errors were found — three of which will cause silent failures for developers who follow the guide literally. Seven additional warnings cover incomplete or misleading documentation. The `manifest.yaml` denial and the `unit_size` default contradiction are the most dangerous findings.

---

## Critical Issues

### CR-01: Guide Falsely States manifest.yaml No Longer Exists

**File:** `DATA_DIRECTORY_GUIDE.md:101`
**Issue:** Section 3 states "No `manifest.yaml` — it no longer exists. Multi-deck maps use a `decks:` list in a single `deckplan.yaml`." This is factually false. `data/galaxy/tau-ceti/somnus/map/manifest.yaml` exists and is actively loaded by `terminal/data_loader.py:load_encounter_manifest()` (line 122). The function is called from `load_map()` and `load_deck_map()` and is the only mechanism for the Somnus location's encounter map. A developer who reads this statement and migrates Somnus to deckplan format will break that location, while a developer creating a new location using the old map/ + manifest.yaml format will be told they are doing it wrong when their approach actually works.

**Fix:** Replace the denial with an accurate description of both supported formats:

```markdown
Two encounter map formats are supported:

**New format (preferred):** Single `deckplan.yaml` at the location root with a `decks:` list.
Place it at `data/ships/{slug}/deckplan.yaml` or `data/campaign/ship/deckplan.yaml`.

**Legacy format (still works):** A `map/` directory containing `manifest.yaml` (deck index)
and individual per-deck YAML files referenced by `file:` in the manifest.
Existing locations using this format (e.g., `data/galaxy/tau-ceti/somnus/`) do not need to be migrated.
```

---

### CR-02: JANUS Designation Is Wrong

**File:** `DATA_DIRECTORY_GUIDE.md:700`
**Issue:** Section 12 documents the JANUS AI designation as "Computerized Heuristic Autonomous Resource Operations Network." The actual value in `data/janus/context.yaml` is "Joint Autonomous Networked Universal System." A developer copying the guide's schema example verbatim will silently set the wrong designation in the live AI configuration file.

**Fix:** Change line 700 to:
```yaml
designation: "Joint Autonomous Networked Universal System"
```

---

### CR-03: unit_size Default Is Wrong (Backend Contradicts Frontend)

**File:** `DATA_DIRECTORY_GUIDE.md:305`
**Issue:** Section 7 schema documents `unit_size` as "optional: pixels per grid cell (default 40)." The backend default in `terminal/views.py:308` is `default_deck.get('unit_size', 30)` — default **30**, not 40. The frontend default in `EncounterMapRenderer.tsx:568` and `MapPreview.tsx:138,204` is `?? 40`. This means a deckplan without an explicit `unit_size` will produce different rendering depending on which code path is taken: backend-served decks use 30px cells, frontend-only rendering uses 40px cells. The guide's stated default of 40 matches neither authoritatively. All production deckplan files in the repo set `unit_size: 30` explicitly, which masks the discrepancy — but a developer who omits `unit_size` based on the guide's "default 40" claim will get unexpected results from the backend.

**Fix:** State the actual behavior and recommend always setting explicitly:
```markdown
unit_size: 30   # pixels per grid cell — always set explicitly; backend default is 30, frontend default is 40
```

---

### CR-04: ship body_slug Injection Only Works One Level Deep (Undocumented Limitation)

**File:** `DATA_DIRECTORY_GUIDE.md:46-57`
**Issue:** Section 2 describes the galaxy tree injection mechanism for mobile ships but does not document a critical limitation: `body_index` is populated only with **direct children of system nodes** (i.e., planets/bodies at depth 1). A ship with `body_slug: verdant` (a moon nested under a planet) will NOT find a match in `body_index` because moons are grandchildren of system nodes. The data_loader code at line 50 only iterates `sys_node.get('children', [])` — one level. Such a ship silently falls through to `system_index` lookup (if `system_slug` matches) or gets appended to the galaxy tree root (else clause, line 81), rather than appearing under the moon. No error is logged.

**Fix:** Add a warning after the `body_slug` description in Section 2:

```markdown
> **Depth limitation:** `body_slug` matching only resolves planets and bodies that
> are direct children of a system (depth 1). Moons and installations nested deeper
> than one level under a system cannot be used as `body_slug` targets. Use the
> parent planet's slug instead (e.g., `body_slug: tau-ceti-f` to orbit a moon of Tau Ceti f).
```

---

## Warnings

### WR-01: `surface` parent_type Is Mentioned But Never Explained

**File:** `DATA_DIRECTORY_GUIDE.md:113`
**Issue:** Section 4 lists `parent_type: surface` as a valid value alongside `orbit`, but provides no schema, example, or explanation for the surface case. The data_loader at lines 640-648 shows that `parent_type: surface` requires a `surface:` block with `latitude`, `longitude`, and `marker_type` fields. The guide only shows an orbit example; a developer trying to add a surface installation has no usable reference.

**Fix:** Add a `surface` example alongside the `orbital:` example in Section 4:

```yaml
# Surface installation example
parent_type: surface
body_slug: tau-ceti-f
system_slug: tau-ceti

surface:
  latitude: 23.5       # degrees, -90 to 90
  longitude: 118.2     # degrees, -180 to 180
  marker_type: base    # base | city | outpost (displayed as map marker)
```

---

### WR-02: NPC Portrait Path Convention Is Inconsistent and Undocumented

**File:** `DATA_DIRECTORY_GUIDE.md:283-284`
**Issue:** Section 6.3 says NPC portrait images should go in `data/campaign/NPCs/images/` (uppercase `NPCs`). But:
1. NPC YAML files live in `data/campaign/npcs/` (lowercase), creating a confusing mixed-case convention.
2. The crew example in Section 6.1 uses `portrait: "/static/portraits/novak.png"` — a completely different path scheme pointing to `terminal/static/portraits/` (which exists but is empty).
3. The actual NPC files in the repo use `portrait: "/data/campaign/NPCs/images/lucia_vance.png"` — the `/data/` URL prefix which works because Django serves the `data/` directory in DEBUG mode.

The guide never explains that `/data/` URLs are served by Django, never warns that `/static/portraits/` would require placing files in `terminal/static/portraits/`, and uses two incompatible portrait path conventions without explaining either.

**Fix:** Unify and explain portrait paths:
```markdown
**Portrait images** are served via the `/data/` URL prefix in development.
Place portraits in `data/campaign/NPCs/images/` and reference them as:
`portrait: "/data/campaign/NPCs/images/lucia_vance.png"`

The `/static/portraits/` path (seen in some older crew files) requires images in
`terminal/static/portraits/` and is not the recommended convention.
```

---

### WR-03: Undocumented POI Icons Available

**File:** `DATA_DIRECTORY_GUIDE.md:395-414`
**Issue:** Section 7.4's icon table is missing six icons that exist in `src/assets/icons/` and are loaded by `EncounterIcons.ts`: `factory`, `full`, `refinery`, `space colony`, `space ship`, `space station`. All are available for use in `poi:` entries but are not listed. A developer searching the guide for available icons will miss these.

**Fix:** Add the missing icons to the table in Section 7.4:
```
| `factory`       | `refinery`     | `space colony`  |
| `space ship`    | `space station`| `full`          |
```

---

### WR-04: Undocumented `icon_type` Value `shipyard` Will Silently Render Nothing

**File:** `DATA_DIRECTORY_GUIDE.md:127,476`
**Issue:** Sections 4 and 8 both use `icon_type: shipyard` in examples. The valid `icon_type` values are defined by `ICON_TYPE_MAP` in `OrbitIcons.ts:25-31`: `ship`, `station`, `refinery`, `factory`, `colony`. The value `shipyard` is not in this map. `getOrbitIconSvg('shipyard')` returns `null` and the orbital icon renders invisible, with no error logged. The documented example actively demonstrates a broken configuration.

**Fix:** Change both examples to use a valid `icon_type`. For an orbital shipyard, `station` is the most appropriate available icon:
```yaml
icon_type: station   # valid: ship | station | refinery | factory | colony
```

---

### WR-05: Old Polygon Door `angle` Convention Is Misleadingly Labelled

**File:** `DATA_DIRECTORY_GUIDE.md:367-374`
**Issue:** The guide presents the angle-only door format (no `x`/`y`) under the heading "You can also use `angle` in degrees (clockwise from east)..." This format uses a centroid-origin ray cast (0=east, CW convention) and is a **legacy fallback** — the MEMORY.md notes it as "Old polygon format (centroid-based angle): still works as fallback." The guide does not label it as legacy or explain the difference in behavior. Developers may use this form when they intend the precise explicit-coordinate form and get incorrect door placement.

**Fix:** Add a legacy warning and contrast the two conventions:
```markdown
> **Legacy format** (centroid-based, less precise): `angle` without `x`/`y` is still accepted
> for polygon/circle rooms and uses 0=east, 90=south (clockwise). The renderer fires a ray from
> the polygon's vertex centroid at this angle to find the door position on the boundary.
> This can be inaccurate for irregular shapes. Prefer the explicit `x`/`y`/`angle` format.
```

---

### WR-06: JANUS `system_prompt` in Guide Is Truncated / Differs from Actual

**File:** `DATA_DIRECTORY_GUIDE.md:709-720`
**Issue:** The guide's `system_prompt` example shows 5 lines. The actual `data/janus/context.yaml` has a significantly more detailed prompt with both FORMATTING RULES and BEHAVIOR RULES sections, plus CORRECT/WRONG examples. The guide's truncated version is presented as a schema example, so developers may copy it directly and produce a much weaker AI personality. The fallback_responses example shows 2 entries while the real file has 5 (with fuller text).

**Fix:** Note that the schema example is illustrative, not a complete copy-paste template:
```markdown
> The `system_prompt` and `fallback_responses` values shown are abbreviated examples.
> Copy the full content from `data/janus/context.yaml` as a starting template.
```

---

### WR-07: Section 1 Table Omits `data/campaign/` Subdirectory Structure

**File:** `DATA_DIRECTORY_GUIDE.md:24-28`
**Issue:** The Section 1 overview tree and table show `campaign/` as a single unit. The actual `data/campaign/` contains several subdirectories not explained in the guide's structure diagram: `docs/` (campaign markdown documents), `sessions/` (session log files), `images/` (campaign images), and the case-inconsistent `NPCs/` vs `npcs/` pair (see WR-02). Developers exploring the data directory for the first time will encounter these directories with no documentation.

**Fix:** Expand the directory tree in Section 1:
```
data/
├── campaign/
│   ├── ship/       ← player ship (ship.yaml, deckplan.yaml, location.yaml)
│   ├── crew/       ← one YAML file per crew member
│   ├── npcs/       ← one YAML file per NPC
│   ├── NPCs/       ← NPC portrait images (images/ subdirectory)
│   ├── docs/       ← freeform Markdown campaign documents
│   ├── sessions/   ← per-session Markdown logs
│   └── images/     ← campaign images (logos, etc.)
```

---

## Info

### IN-01: `deckplan.yaml` Top-Level `name` and `facility_type` Fields Are Undocumented

**File:** `DATA_DIRECTORY_GUIDE.md:294-308`
**Issue:** The `load_deckplan()` result is used in views.py with `deckplan.get('name', ...)` and `deckplan.get('facility_type', ...)` — meaning these optional top-level keys in `deckplan.yaml` override what the encounter map API reports as the location name and type. The Somnus `manifest.yaml` uses them (`name: "Somnus"`, `facility_type: "ship"`). The guide's deckplan schema does not mention them, so developers cannot use them to customize encounter display names.

**Fix:** Add to the deckplan schema comment block:
```yaml
# Optional top-level overrides for display in encounter map API:
name: "Display Name"         # overrides location.yaml name in encounter API
facility_type: "ship"        # overrides location.yaml type in encounter API
```

---

### IN-02: Texture Category Type Prefix for `gas/` Is `Gas Giant`, Not `Gas`

**File:** `DATA_DIRECTORY_GUIDE.md:754`
**Issue:** Section 14 states the naming pattern as `{Type}-EQUIRECTANGULAR-{N}-2048x1024.png` and gives the example `Terrestrial-EQUIRECTANGULAR-7-...`. For the `gas/` category, the actual filename prefix is `Gas Giant` (with a space), not `Gas`. A developer using the pattern for gas giants would write `texture: "/textures/gas/Gas-EQUIRECTANGULAR-1-2048x1024.png"` which does not exist; the correct path is `/textures/gas/Gas Giant-EQUIRECTANGULAR-1-2048x1024.png`.

**Fix:** Add a gas-specific example:
```yaml
texture: "/textures/gas/Gas Giant-EQUIRECTANGULAR-5-2048x1024.png"   # note: "Gas Giant" not "Gas"
```

---

### IN-03: Guide Says Textures Are Numbered 1-20 But Each Category Has 20 Main + 20 Bump Files

**File:** `DATA_DIRECTORY_GUIDE.md:753`
**Issue:** "Each category contains 20 textures numbered 1–20" is technically correct for the main texture files, but each category also contains 20 `Bump-EQUIRECTANGULAR-{N}` files used for surface normal mapping. The guide does not mention bump maps. A developer wondering what the Bump files are (or whether to reference them in YAML) has no guidance.

**Fix:** Add a note:
```markdown
Each category also contains 20 `Bump-EQUIRECTANGULAR-{N}-2048x1024.png` normal-map files.
These are used internally by the 3D renderer and do not need to be referenced in YAML data files.
```

---

_Reviewed: 2026-05-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
