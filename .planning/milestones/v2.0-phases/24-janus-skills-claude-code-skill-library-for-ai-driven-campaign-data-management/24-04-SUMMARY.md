---
phase: 24-janus-skills-claude-code-skill-library-for-ai-driven-campaign-data-management
plan: "04"
subsystem: infra
tags: [janus-skills, skills, mcp, claude-code, campaign-data, galaxy-data]

# Dependency graph
requires:
  - phase: 24-02
    provides: "5 condensed schema resource files under ~/mothership/janus-skills/resources/"
provides:
  - "4 SKILL.md files: janus-add-npc, janus-add-location, janus-add-system, janus-add-body"
  - "D-12: /janus-add-npc — creates data/campaign/npcs/<id>.yaml with id=filename rule"
  - "D-13: /janus-add-location — creates galaxy location dir + location.yaml"
  - "D-15: /janus-add-system — appends star_map.yaml + scaffolds system dir"
  - "D-16: /janus-add-body — updates system_map.yaml or orbit_map.yaml + creates location.yaml"
affects:
  - "24-05 (remaining 4 skills): establishes frontmatter pattern and mcp__JanusGM__ prefix convention"
  - "24-03 install.sh: install.sh symlinks these skill dirs into ~/.claude/skills/"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SKILL.md structure: YAML frontmatter (name/description/argument-hint/allowed-tools) + objective + schema + process"
    - "Schema @-include: @$HOME/.claude/janus-skills/resources/schema-*.md (HOME-anchored for portability)"
    - "Minimal tool surface: each skill declares only tools it actually uses (no unused tools in allowed-tools)"
    - "Process step pattern: verify parent exists before writing, derive slug deterministically, check collision, then write"

key-files:
  created:
    - /home/gjohnson/mothership/janus-skills/skills/janus-add-npc/SKILL.md
    - /home/gjohnson/mothership/janus-skills/skills/janus-add-location/SKILL.md
    - /home/gjohnson/mothership/janus-skills/skills/janus-add-system/SKILL.md
    - /home/gjohnson/mothership/janus-skills/skills/janus-add-body/SKILL.md
  modified: []

key-decisions:
  - "janus-add-npc: allowed-tools is exactly [list_files, write_file] — read_file not needed since list_files gives collision check"
  - "janus-add-location: allowed-tools includes read_file for verifying parent system exists before writing"
  - "janus-add-system: allowed-tools is exactly [read_file, write_file] — list_files not needed; star_map.yaml read covers collision check"
  - "janus-add-body: allowed-tools is [list_files, read_file, write_file] — list_files for sibling slug collision, read_file for map files"
  - "janus-add-body moon path builds new orbit_map.yaml scaffold if file does not exist (not error-abort)"
  - "System slug collision on add-system: refuse + ask user (unlike NPC suffix-append) — systems must be unique + human-readable"

patterns-established:
  - "Pitfall P1 warning embedded in slug derivation step for all galaxy skills"
  - "Pitfall P2 warning embedded in id derivation step for NPC skill"
  - "Pitfall P5 warning in janus-add-body confirmation step for moon type"
  - "Parent verification pattern: read parent map file first; abort with helpful message if not found"

requirements-completed: []

# Metrics
duration: 10min
completed: "2026-05-19"
---

# Phase 24 Plan 04: Creation Skills (D-12, D-13, D-15, D-16) Summary

**4 SKILL.md files written for NPC creation, galaxy location creation, star system scaffolding, and body addition — all using mcp__JanusGM__ prefix and HOME-anchored schema @-includes — committed as 563b06b on janus-skills main**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-19T14:43:00Z
- **Completed:** 2026-05-19T14:47:03Z
- **Tasks:** 2 of 2
- **Files modified:** 4 created in janus-skills

## Accomplishments

- 4 SKILL.md files created under `/home/gjohnson/mothership/janus-skills/skills/` — one per skill directory
- All frontmatter valid YAML, parseable by `python3 -c 'import yaml; yaml.safe_load(...)'`
- All `allowed-tools` entries use `mcp__JanusGM__` prefix (case-sensitive, verbatim)
- All schema @-includes use `@$HOME/.claude/janus-skills/resources/` (HOME-anchored, not CWD-relative)
- No forbidden `@./resources/` or `@resources/` patterns in any file
- All 4 files committed in one atomic commit `563b06b` to janus-skills main

## SKILL.md Line Counts

| Skill | Lines | Within 40–150 range |
|---|---|---|
| janus-add-npc | 68 | Yes |
| janus-add-location | 69 | Yes |
| janus-add-system | 75 | Yes |
| janus-add-body | 107 | Yes |

## Frontmatter Validation

All 4 SKILL.md files pass the Task 1 / Task 2 validation scripts:

```
OK skills/janus-add-npc/SKILL.md
OK skills/janus-add-location/SKILL.md
OK skills/janus-add-system/SKILL.md
OK skills/janus-add-body/SKILL.md
```

Each: valid YAML frontmatter, name matches directory, description contains "Use when",
all allowed-tools start with `mcp__JanusGM__`.

## Final Allowed-Tools List Per Skill

| Skill | allowed-tools |
|---|---|
| janus-add-npc | `mcp__JanusGM__list_files`, `mcp__JanusGM__write_file` |
| janus-add-location | `mcp__JanusGM__list_files`, `mcp__JanusGM__read_file`, `mcp__JanusGM__write_file` |
| janus-add-system | `mcp__JanusGM__read_file`, `mcp__JanusGM__write_file` |
| janus-add-body | `mcp__JanusGM__list_files`, `mcp__JanusGM__read_file`, `mcp__JanusGM__write_file` |

Plan 24-05 can use this table to verify tool prefix consistency for the remaining 4 skills
(janus-generate-context, janus-session-prep, janus-add-ship, janus-update-galaxy).

## Commit

janus-skills repo: `563b06b feat(skills): add 4 creation skills (D-12, D-13, D-15, D-16)`

## Tasks

1. **Task 1: janus-add-npc and janus-add-location** — both SKILL.md files written, all
   acceptance criteria passed. NPC skill documents Pitfall P2 (id=filename) and status enum.
   Location skill documents Pitfall P1 (slug lowercase/hyphens) and parent verification step.

2. **Task 2: janus-add-system and janus-add-body** — both SKILL.md files written, all
   acceptance criteria passed. System skill preserves existing star_map.yaml data (camera/routes/nebulae).
   Body skill branches on type (planet/station vs moon) and documents Pitfall P5 moon warning.
   All 4 files committed in one atomic commit per plan instruction.

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
- FOUND: /home/gjohnson/mothership/janus-skills/skills/janus-add-npc/SKILL.md
- FOUND: /home/gjohnson/mothership/janus-skills/skills/janus-add-location/SKILL.md
- FOUND: /home/gjohnson/mothership/janus-skills/skills/janus-add-system/SKILL.md
- FOUND: /home/gjohnson/mothership/janus-skills/skills/janus-add-body/SKILL.md

Commit exists: 563b06b (verified via `git log --oneline | head -1`)

*Phase: 24-janus-skills-claude-code-skill-library-for-ai-driven-campaign-data-management*
*Completed: 2026-05-19*
