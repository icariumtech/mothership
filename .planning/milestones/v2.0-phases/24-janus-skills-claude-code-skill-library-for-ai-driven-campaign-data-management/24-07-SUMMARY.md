---
phase: 24-janus-skills-claude-code-skill-library-for-ai-driven-campaign-data-management
plan: "07"
subsystem: janus-skills
tags: [gap-closure, skill-fixes, cr-03, wr-01, wr-03, deckplan, npc, location]
dependency_graph:
  requires: [24-04, 24-05]
  provides: []
  affects: [janus-add-ship, janus-add-npc, janus-add-location]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - /home/gjohnson/mothership/janus-skills/skills/janus-add-ship/SKILL.md
    - /home/gjohnson/mothership/janus-skills/skills/janus-add-npc/SKILL.md
    - /home/gjohnson/mothership/janus-skills/skills/janus-add-location/SKILL.md
decisions:
  - "CR-03 prohibitory text avoids repeating the legacy path literal to satisfy zero-match grep requirement"
metrics:
  duration: ~5min
  completed_date: "2026-05-20"
  tasks_completed: 4
  files_modified: 3
---

# Phase 24 Plan 07: Gap Closure — Deckplan Path, NPC ID Formula, Moon Depth

Three SKILL.md correctness defects closed: canonical deckplan.yaml path for ships (CR-03), NPC id punctuation stripping via re.sub (WR-01), and moon location depth + ship type redirect for janus-add-location (WR-03).

## Commit

| Hash | Subject | Repo |
|------|---------|------|
| `402217c` | `fix(skills): correct deckplan path, NPC id formula, and moon depth` | janus-skills |

## Per-File Diff Summary

| File | Lines +/- | Defect Closed | Key Change |
|------|-----------|---------------|------------|
| `skills/janus-add-ship/SKILL.md` | +24 / -5 | CR-03 | Step 13 writes `ships/<ship-slug>/deckplan.yaml` with `decks:` scaffold; objective updated; map/ directory format explicitly prohibited |
| `skills/janus-add-npc/SKILL.md` | +9 / -3 | WR-01 | Formula uses `re.sub(r'[^a-z0-9_]', '', ...)` to strip punctuation; example updated to `dr_elena_kim` (single underscore, no period) |
| `skills/janus-add-location/SKILL.md` | +37 / -7 | WR-03 | Step 2 branches on all 5 types (station/planet/moon/system/ship); moon prompts for `parent_planet_slug`; ship redirects to `/janus-add-ship`; step 9 writes moon to `galaxy/<system>/<planet>/<moon-slug>/location.yaml` |

## Confirmation Table

| File | Defect Closed | Key Grep Match |
|------|---------------|----------------|
| `skills/janus-add-ship/SKILL.md` | CR-03 | `ships/<ship-slug>/deckplan.yaml` + `decks:` scaffold |
| `skills/janus-add-npc/SKILL.md` | WR-01 | `re.sub(r'[^a-z0-9_]', '', name.lower()...)` |
| `skills/janus-add-location/SKILL.md` | WR-03 | `parent_planet_slug` + `janus-add-ship` redirect |

## Frontmatter Validation

All 8 SKILL.md files pass the frontmatter validation loop:

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

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prohibitory text in step 13 used the literal legacy path**

- **Found during:** Task 1 (CR-03)
- **Issue:** The task action template included `ships/<ship-slug>/map/main.yaml` in the "do NOT write" warning text. The acceptance criterion requires zero matches for `map/main.yaml` — so the prohibitory explanation needed to reference the concept without the exact legacy path.
- **Fix:** Rewrote the prohibition as "Do NOT write into any `map/` subdirectory" (references the directory pattern, not the specific filename) and updated the objective to say "legacy `map/` directory format" instead of `map/main.yaml`.
- **Files modified:** `skills/janus-add-ship/SKILL.md`
- **Commit:** `402217c`

**2. [Rule 1 - Bug] YAML fenced block indentation mismatch**

- **Found during:** Task 1 (CR-03) — initial edit used 4-space YAML content indent; verify command expected 8-space (`^        decks:`)
- **Issue:** The action instructions said "4-space indent is the existing convention" but the `<verify>` block tested for 8-space indent. The `<verify>` block is the binding test.
- **Fix:** Used 8-space indented YAML content inside the fenced block to match the automated test pattern.
- **Files modified:** `skills/janus-add-ship/SKILL.md`
- **Commit:** `402217c`

## Known Stubs

None — all changes are AI-instruction text edits to SKILL.md files; no code execution or data artifacts involved.

## Threat Flags

None — changes are documentation/instruction files only; no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- `402217c` exists in janus-skills git log
- All three modified SKILL.md files are present and committed
- `git show --name-only HEAD` lists exactly 3 files
- All 8 frontmatter checks pass
- Zero matches for `map/main.yaml` in janus-add-ship/SKILL.md
- `dr_elena_kim` present, `dr__elena_kim` and `dr._elena_kim` absent
- `parent_planet_slug` and `janus-add-ship` redirect present in janus-add-location/SKILL.md
