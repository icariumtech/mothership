---
phase: 24-janus-skills-claude-code-skill-library-for-ai-driven-campaign-data-management
plan: "02"
subsystem: infra
tags: [janus-skills, yaml-schema, mcp, claude-code, resources, documentation]

# Dependency graph
requires:
  - phase: 24-01
    provides: "janus-skills repo scaffold with resources/ and skills/ directories"
provides:
  - "5 condensed schema resource files under ~/mothership/janus-skills/resources/"
  - "schema-campaign.md — crew, NPC, corporation, standby schemas with status enums and pitfall P2"
  - "schema-galaxy.md — star_map, system_map, orbit_map, location hierarchy with slug rules and pitfalls P1/P5"
  - "schema-ships.md — ship location.yaml, slug-pointer model, orbit injection with icon_type enum"
  - "schema-encounters.md — deckplan, GridRoom, door formats (B-rel/B-pos), POI icons"
  - "schema-janus-context.md — janus.yaml generated/context fields with canonical veil-station example"
affects:
  - "24-03 (skills + install.sh): all 8 SKILL.md files @-include one or more of these resource files"
  - "All downstream janus-skills consumers: resource files are the primary schema knowledge source"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Schema bundling pattern: each skill @-includes only the resource slice it needs (D-04/D-05/D-06)"
    - "Condensed reference format: field tables + one-line descriptions, no prose narrative, no full DATA_DIRECTORY_GUIDE copies"
    - "MCP path convention documented in every resource: paths relative to data/, no leading slash"
    - "Resource files installed to ~/.claude/janus-skills/resources/ for @$HOME/... @-include resolution"

key-files:
  created:
    - /home/gjohnson/mothership/janus-skills/resources/schema-campaign.md
    - /home/gjohnson/mothership/janus-skills/resources/schema-galaxy.md
    - /home/gjohnson/mothership/janus-skills/resources/schema-ships.md
    - /home/gjohnson/mothership/janus-skills/resources/schema-encounters.md
    - /home/gjohnson/mothership/janus-skills/resources/schema-janus-context.md
  modified: []

key-decisions:
  - "Resource files condense DATA_DIRECTORY_GUIDE section-by-section — no full copies, no narrative prose, field tables only"
  - "schema-encounters.md documents BROKEN as a legacy alias for DAMAGED (preserved from pre-Phase 21 maps)"
  - "Door format uses Phase 21 canonical top-level doors array (B-rel/B-pos) — legacy room-nested format noted only as migration artifact"
  - "body_slug planet-only constraint (P5) documented in both schema-galaxy.md and schema-ships.md for maximum discoverability"
  - "All 5 files committed in one atomic commit to janus-skills repo per plan instruction"

patterns-established:
  - "Schema resource files use markdown field tables (| Field | Type | Required | Note |) not YAML blocks for field documentation"
  - ".gitkeep removed when resources/ is populated — matches janus-skills repo convention from Plan 24-01"

requirements-completed: []

# Metrics
duration: 8min
completed: "2026-05-19"
---

# Phase 24 Plan 02: Schema Resource Files Summary

**5 condensed schema reference files written to janus-skills/resources/ covering campaign entities, galaxy hierarchy, ships, deckplans, and JANUS context — committed in one atomic commit (8ffa3db) on main**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-19T14:32:00Z
- **Completed:** 2026-05-19T14:37:59Z
- **Tasks:** 3 of 3
- **Files modified:** 6 (5 created + 1 deleted in janus-skills)

## Accomplishments

- 5 condensed schema resource files created under `/home/gjohnson/mothership/janus-skills/resources/` — each a field-table reference, not a DATA_DIRECTORY_GUIDE copy
- All MCP path conventions documented per D-04/D-05/D-06 — paths relative to `data/`, no leading slash
- Critical pitfalls P1 (slug case mismatch) and P5 (body_slug planet-only) documented in all relevant resources
- `resources/.gitkeep` removed; all 5 files committed in one atomic commit `8ffa3db` to janus-skills `main`

## Resource File Line Counts

| File | Lines | Range |
|---|---|---|
| schema-campaign.md | 168 | 120–320 |
| schema-galaxy.md | 256 | 180–450 |
| schema-ships.md | 120 | 100–280 |
| schema-encounters.md | 212 | 100–300 |
| schema-janus-context.md | 82 | 60–180 |

All files end with a newline character (0x0a). No file exceeds 500 lines. None contain embedded absolute paths to charon or the string "DATA_DIRECTORY_GUIDE" (condensed-only per D-06).

## Task Commits

Tasks 1 and 2 wrote files (no separate commits — all deferred to Task 3 per plan).
Task 3 committed all 5 resources atomically:

1. **Task 1: Write schema-campaign.md and schema-janus-context.md** — staged (no separate commit)
2. **Task 2: Write schema-galaxy.md and schema-ships.md** — staged (no separate commit)
3. **Task 3: Write schema-encounters.md + commit all 5 resources** — `8ffa3db` (docs(resources): add 5 condensed schema reference files)

## Files Created

- `/home/gjohnson/mothership/janus-skills/resources/schema-campaign.md` — NPC tiers (background/full), crew, corporation, standby; status enum `ACTIVE|INACTIVE|DECEASED|UNKNOWN`; Pitfall P2
- `/home/gjohnson/mothership/janus-skills/resources/schema-janus-context.md` — `generated` + `context` fields; veil-station canonical example; path conventions
- `/home/gjohnson/mothership/janus-skills/resources/schema-galaxy.md` — star_map/system_map/orbit_map/location.yaml field tables; slug rules; Body type enum; Pitfalls P1+P5
- `/home/gjohnson/mothership/janus-skills/resources/schema-ships.md` — slug-pointer model explanation; orbit injection fields; `icon_type: ship|station|shipyard`; Pitfalls P1+P5
- `/home/gjohnson/mothership/janus-skills/resources/schema-encounters.md` — GridRoom shapes (rects/polygon/circle); Phase 21 canonical door format (B-rel/B-pos); `BROKEN` legacy alias; POI icon list; svg_to_map.py tooling note

## Decisions Made

- Documented `BROKEN` door status as a legacy alias for `DAMAGED` in schema-encounters.md. The plan acceptance criteria required `BROKEN` to be present; DATA_DIRECTORY_GUIDE Phase 21 canonical uses `DAMAGED`. Both are included with a note that `DAMAGED` is preferred for new maps.
- Used markdown field tables (pipe format) rather than YAML blocks for documenting schema fields — tables are more scannable for AI context consumption.

## Deviations from Plan

None — plan executed exactly as written. The `BROKEN`/`DAMAGED` note is an accuracy enhancement, not a deviation.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `resources/` directory contains exactly the 5 schema files Plan 24-03 needs to @-include from SKILL.md frontmatter
- No blockers for Plan 24-03 (skills + install.sh)
- All files use `@$HOME`-friendly content — no embedded absolute paths to `/home/gjohnson/mothership/charon`

---
*Phase: 24-janus-skills-claude-code-skill-library-for-ai-driven-campaign-data-management*
*Completed: 2026-05-19*
