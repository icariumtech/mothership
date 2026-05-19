---
phase: 24-janus-skills-claude-code-skill-library-for-ai-driven-campaign-data-management
plan: "05"
subsystem: infra
tags: [janus-skills, skills, mcp, claude-code, campaign-data, ships, galaxy, session-prep]

# Dependency graph
requires:
  - phase: 24-02
    provides: "5 condensed schema resource files under ~/mothership/janus-skills/resources/"
  - phase: 24-04
    provides: "4 SKILL.md files (janus-add-npc, janus-add-location, janus-add-system, janus-add-body) establishing the frontmatter pattern"
provides:
  - "4 SKILL.md files: janus-add-ship, janus-update-galaxy, janus-generate-context, janus-session-prep"
  - "D-17: /janus-add-ship — registers ships/<slug>/location.yaml with body_slug self-injection onto orbit map"
  - "D-18: /janus-update-galaxy — galaxy painter: nebulae, routes, system visual props in star_map.yaml"
  - "D-11: /janus-generate-context — Obsidian→janus.yaml pipeline core skill"
  - "D-14: /janus-session-prep — read-only GM brief composer using get_session_context()"
  - "8-skill MVP set complete (D-11..D-18)"
affects:
  - "Future campaign management sessions: all 8 skills now installable via install.sh"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Slug-pointer model: ships use body_slug/system_slug instead of galaxy directory nesting"
    - "READ-ONLY skill pattern: janus-session-prep declares no write_file — only get_session_context/list_files/read_file"
    - "Dual-schema include: janus-generate-context includes both schema-galaxy.md and schema-janus-context.md"
    - "PyYAML hex-color caveat documented in janus-update-galaxy for star_map.yaml roundtrip fidelity"

key-files:
  created:
    - /home/gjohnson/mothership/janus-skills/skills/janus-add-ship/SKILL.md
    - /home/gjohnson/mothership/janus-skills/skills/janus-update-galaxy/SKILL.md
    - /home/gjohnson/mothership/janus-skills/skills/janus-generate-context/SKILL.md
    - /home/gjohnson/mothership/janus-skills/skills/janus-session-prep/SKILL.md
  modified: []

key-decisions:
  - "janus-add-ship: allowed-tools is [list_files, read_file, write_file] — list_files for collision check, read_file for P5 system validation"
  - "janus-update-galaxy: allowed-tools is [read_file, write_file] — list_files not needed; star_map.yaml read covers all lookups"
  - "janus-generate-context: dual schema @-includes (schema-galaxy.md + schema-janus-context.md) because it reads location.yaml (galaxy schema) and writes janus.yaml (context schema)"
  - "janus-session-prep: NO write_file in allowed-tools — enforced read-only constraint prevents accidental file modification during session review"
  - "P5 enforcement in janus-add-ship: verifies body_slug is direct child of system via list_files (not just a warning — it refuses and explains)"

patterns-established:
  - "READ-ONLY skill: session-prep omits write_file to enforce browse-only mode for GM briefing"
  - "Pitfall P5 hard enforcement: list_files the system dir and refuse if body_slug not in direct children"
  - "PyYAML hex caveat pattern: documented for any skill that roundtrips star_map.yaml"

requirements-completed: []

# Metrics
duration: 3min
completed: "2026-05-19"
---

# Phase 24 Plan 05: Remaining 4 Skills (D-11, D-14, D-17, D-18) Summary

**4 SKILL.md files written for ship registration, galaxy painting, context generation, and session briefing — completing the 8-skill MVP set — committed as ffb51ae on janus-skills main**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-19T14:49:24Z
- **Completed:** 2026-05-19T14:52:23Z
- **Tasks:** 3 of 3
- **Files modified:** 4 created in janus-skills

## Accomplishments

- 4 SKILL.md files created: janus-add-ship, janus-update-galaxy, janus-generate-context, janus-session-prep
- All frontmatter valid YAML, parseable by `python3 -c 'import yaml; yaml.safe_load(...)'`
- All `allowed-tools` entries use `mcp__JanusGM__` prefix (case-sensitive, verbatim)
- All schema @-includes use `@$HOME/.claude/janus-skills/resources/` (HOME-anchored, not CWD-relative)
- No forbidden `@./resources/` or `@resources/` patterns in any file
- All 4 files committed in one atomic commit `ffb51ae` to janus-skills main
- 8-skill MVP set fully complete (D-11 through D-18)

## SKILL.md Line Counts and Tool Surface

| Skill | Lines | Allowed-Tools Count | Schema Includes (distinct) |
|---|---|---|---|
| janus-add-ship | 92 | 3 (list_files, read_file, write_file) | 1 (schema-ships.md) |
| janus-update-galaxy | 80 | 2 (read_file, write_file) | 1 (schema-galaxy.md) |
| janus-generate-context | 80 | 2 (read_file, write_file) | 2 (schema-galaxy.md + schema-janus-context.md) |
| janus-session-prep | 77 | 3 (get_session_context, list_files, read_file) | 1 (schema-janus-context.md) |

## Sanity Table

| Skill | Allowed-Tools Count | Schema Includes | Notes |
|---|---|---|---|
| janus-add-ship | 3 | 1 | Only skill with all 3 CRUD tools; Pitfall P5 hard-enforced |
| janus-update-galaxy | 2 | 1 | No list_files needed; star_map.yaml read covers all existence checks |
| janus-generate-context | 2 | 2 | Only skill with dual schema include (galaxy + janus-context) |
| janus-session-prep | 3 | 1 | Only skill with get_session_context; only skill with NO write_file |

## Frontmatter Validation

All 8 SKILL.md files (plan 24-04 + plan 24-05) pass the validation loop:

```
OK janus-add-body
OK janus-add-location
OK janus-add-npc
OK janus-add-ship
OK janus-add-system
OK janus-generate-context
OK janus-session-prep
OK janus-update-galaxy
```

Each: valid YAML frontmatter, name matches directory, description contains "Use when",
all allowed-tools start with `mcp__JanusGM__`.

## Commit

janus-skills repo: `ffb51ae feat(skills): add 4 remaining skills (D-11, D-14, D-17, D-18)`

## Tasks

1. **Task 1: janus-add-ship and janus-update-galaxy** — both SKILL.md files written.
   janus-add-ship documents the slug-pointer model, Pitfall P5 hard enforcement (refuses if
   body_slug is not a direct system child), and orbit defaults. janus-update-galaxy documents
   the three sub-actions (add-nebula, add-route, edit-system) and the PyYAML hex-color caveat.

2. **Task 2: janus-generate-context and janus-session-prep** — both SKILL.md files written.
   janus-generate-context includes two schema @-includes (galaxy + janus-context) per the
   RESEARCH.md mapping, and documents the overwrite-vs-merge prompt for existing janus.yaml.
   janus-session-prep is the only read-only skill (no write_file), explicitly enforced in both
   the objective and the final process step.

3. **Task 3: Commit all 4 skills** — staged and committed as one atomic commit. Working tree
   clean. All 8 SKILL.md files confirmed present and passing frontmatter validation.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all 4 SKILL.md files are complete skill documents with no placeholder content.

## Threat Flags

None — this plan creates markdown content files only. No new network endpoints, auth paths,
file access patterns, or schema changes at trust boundaries.

---

## Self-Check: PASSED

Files exist:
- FOUND: /home/gjohnson/mothership/janus-skills/skills/janus-add-ship/SKILL.md
- FOUND: /home/gjohnson/mothership/janus-skills/skills/janus-update-galaxy/SKILL.md
- FOUND: /home/gjohnson/mothership/janus-skills/skills/janus-generate-context/SKILL.md
- FOUND: /home/gjohnson/mothership/janus-skills/skills/janus-session-prep/SKILL.md

Commit exists: ffb51ae (verified via `git -C /home/gjohnson/mothership/janus-skills log --oneline | head -1`)

*Phase: 24-janus-skills-claude-code-skill-library-for-ai-driven-campaign-data-management*
*Completed: 2026-05-19*
