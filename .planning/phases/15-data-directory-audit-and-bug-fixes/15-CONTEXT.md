# Phase 15: Data Directory Audit + Bug Fixes — Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix known bugs in `data_loader.py`, strip redundant `has_orbit_map` fields from YAML, and run a TypeScript/YAML alignment audit that documents gaps before the data directory restructure begins (Phases 16–19). No structural changes to data files — read-and-fix only.

</domain>

<decisions>
## Implementation Decisions

### D-01: Audit Findings — TypeScript manifest references
The TypeScript audit (Task 5) will find active `manifest` references in `src/types/gmConsole.ts` and `src/types/encounterMap.ts`. These conflict with Phase 16's planned rename to `deckplan.yaml`.

**Decision: Document only — Phase 16 handles the rename.**
Record the active manifest references in the audit report as a known dependency for Phase 16. Do NOT rename TypeScript types in this phase — that belongs with the data restructure.

### D-02: Unplanned bugs found during audit
If grepping turns up additional bugs beyond the 3 known ones (load_location crash, duplicate return None, load_maps bad path):

**Decision: Fix in-place if small (≤~10 lines), document if large.**
1-line fixes go in. Anything requiring more than ~10 lines of changes gets documented in the audit report (`tools/audit-15.md`) as a Phase 15.1 candidate.

### D-03: load_maps() fix
`load_maps()` is called at `data_loader.py:91` inside `load_location_recursive()`. It searches a `maps/` directory (plural) that doesn't exist — the actual convention is `map/` (singular).

**Decision: Fix the path from `maps/` to `map/` singular. Keep the method.**

### D-04: load_location() self.locations_dir fix
`load_location()` references `self.locations_dir` which is never defined in `__init__`. The method IS called (data_loader.py:769 standalone wrapper, sync_campaign_data.py:47).

**Decision: Inspect callers first to confirm expected path, then define `self.locations_dir` in `__init__`.**
Based on the caller pattern (location slug → location directory), `self.locations_dir = self.galaxy_dir` is the likely fix — but the executor should verify by reading `sync_campaign_data.py` and the line-769 wrapper before setting. Do not delete the method.

### D-05: Fix aggressiveness
**Decision: Minimal fixes only.** Fix exactly what's listed (missing attr, bad path, duplicate return None). Do not refactor, simplify, or restructure adjacent methods.

### D-06: body_slug validation script — form
**Decision: Standalone Python script at `tools/validate_body_slugs.py`.**
Run directly with `python tools/validate_body_slugs.py`. No Django required. Simple, easy to run before Phase 18 migration.

### D-07: Audit output location
**Decision: Write findings to `tools/audit-15.md`.**
A dedicated markdown file in `tools/` — survives past the phase, shows in git history, easy to reference from Phase 16+ plans.

### Claude's Discretion
- Internal structure and formatting of `tools/validate_body_slugs.py` — keep it simple
- Whether to include a short usage comment at the top of `tools/audit-15.md`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data Loader
- `terminal/data_loader.py` — Primary file under modification; read fully before touching anything
- `terminal/management/commands/sync_campaign_data.py` — Caller of `load_location()`, read to confirm expected slug/path behavior
- `terminal/views.py` — Check for any callers of methods being removed or fixed

### TypeScript Types
- `src/types/gmConsole.ts` — Contains active `manifest` reference (document, do not touch)
- `src/types/encounterMap.ts` — Contains active `manifest` / `EncounterManifest` references (document, do not touch)

### Data Structure
- `data/galaxy/` — Check for `has_orbit_map` fields across all system_map.yaml files
- `data/galaxy/tau-ceti/system_map.yaml` — Reference example for has_orbit_map removal

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DataLoader.__init__` already defines `self.galaxy_dir = self.data_dir / "galaxy"` — use this for `self.locations_dir` fix
- `tools/` directory exists and contains `svg_to_map.py` — follow the same standalone script pattern for `validate_body_slugs.py`

### Established Patterns
- All existing data loader methods use `self.data_dir` and subdirs (`self.galaxy_dir`, etc.) — `self.locations_dir` should follow the same pattern
- Return `None` (not raise) for missing resources — matches existing method signatures
- map/ singular convention confirmed across all existing location data

### Integration Points
- `sync_campaign_data.py` is the only management command caller of `load_location()` — verify it passes a galaxy location slug (e.g., `"tau-ceti"`)
- `has_orbit_map` removal: grep confirms occurrences in tau-ceti, proxima-centauri, ross-128, epsilon-eridani, luyten-star, sol system_map.yaml files — strip all of them

</code_context>

<specifics>
## Specific Ideas

- The design proposal `wiggly-beaming-oasis.md` is referenced in the existing plan as the source for the bug list — check if this file exists in the repo for additional context
- The executor should run `grep -rn "has_orbit_map" data/galaxy/` at task start to get the exact file list before editing (there are at least 6 files across 6 star systems)

</specifics>

<deferred>
## Deferred Ideas

- Renaming TypeScript `manifest` → `deckplan` types — Phase 16 is the right home for this
- Any `data_loader.py` refactoring beyond the listed fixes — not in scope

</deferred>

---

*Phase: 15-data-directory-audit-and-bug-fixes*
*Context gathered: 2026-04-17*
