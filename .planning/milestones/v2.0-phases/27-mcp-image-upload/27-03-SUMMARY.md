---
phase: 27-mcp-image-upload
plan: "03"
subsystem: skills
tags: [mcp, upload, portrait, image, base64, janus-skills]

# Dependency graph
requires:
  - phase: 27-mcp-image-upload
    provides: "upload_image MCP tool in mcp_server.py (plan 02)"
provides:
  - "/janus-upload-portrait slash command with amber-gradient conversion workflow"
  - "/janus-upload-image slash command for logo/map/misc assets"
affects: [janus-skills, campaign-images, npc-portraits]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SKILL.md format: YAML frontmatter + @-include + <objective> + numbered <process>"
    - "Base64 encoding via python3 one-liner before MCP tool call"

key-files:
  created:
    - /home/gjohnson/mothership/janus-skills/skills/janus-upload-portrait/SKILL.md
    - /home/gjohnson/mothership/janus-skills/skills/janus-upload-image/SKILL.md
  modified: []

key-decisions:
  - "Portrait skill uses convert=true as default, with explicit note on skipping conversion"
  - "Generic image skill rejects portrait type — redirects users to /janus-upload-portrait"
  - "Both skills document the convert flag scope: conversion is portrait-only server-side"

patterns-established:
  - "Upload skills: encode file to base64 locally, then call upload_image MCP tool"
  - "Skill process steps reference $ARGUMENTS for file path parsing"

requirements-completed: [D-07, D-08]

# Metrics
duration: 1min
completed: 2026-05-27
---

# Phase 27 Plan 03: MCP Image Upload Skills Summary

**Two janus-skills SKILL.md files exposing upload_image MCP tool as /janus-upload-portrait and /janus-upload-image slash commands with base64 encoding workflow**

## Performance

- **Duration:** 1 min
- **Started:** 2026-05-27T20:30:55Z
- **Completed:** 2026-05-27T20:31:54Z
- **Tasks:** 2
- **Files modified:** 2 (created)

## Accomplishments
- `/janus-upload-portrait` skill: uploads NPC portrait, triggers amber-gradient conversion by default, explains two-path source/converted workflow
- `/janus-upload-image` skill: uploads logo/map/misc assets with explicit destination directory table and convert-flag scope clarification
- Both skills include concrete base64 encoding command (python3 one-liner) and follow exact SKILL.md format from existing skills

## Task Commits

Each task was committed atomically (in `janus-skills` repo):

1. **Task 1: Write janus-upload-portrait/SKILL.md** - `f4f83d2` (feat)
2. **Task 2: Write janus-upload-image/SKILL.md** - `851eb18` (feat)

## Files Created/Modified
- `skills/janus-upload-portrait/SKILL.md` - NPC portrait upload with amber-gradient conversion via `mcp__JanusGM__upload_image`
- `skills/janus-upload-image/SKILL.md` - Generic logo/map/misc image upload via `mcp__JanusGM__upload_image`

## Decisions Made
- Portrait skill defaults `convert=true` and documents the skip path (`convert=false`) at the bottom as a note, keeping the primary workflow prominent
- Generic image skill explicitly calls out that portrait uploads belong in `/janus-upload-portrait` — prevents misuse
- Both skills clarify that `convert` is portrait-only server-side, so callers of the generic skill know not to pass it

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Skills become available after `install.sh --global` is re-run.

## Next Phase Readiness
- Both slash commands are ready for `install.sh --global` auto-discovery (glob `janus-*/`)
- Phase 27 (MCP image upload) is now complete — all three plans (01 backend, 02 MCP tool, 03 skills) have SUMMARYs
- Ready for next phase

---
*Phase: 27-mcp-image-upload*
*Completed: 2026-05-27*

## Self-Check: PASSED

- FOUND: `/home/gjohnson/mothership/janus-skills/skills/janus-upload-portrait/SKILL.md`
- FOUND: `/home/gjohnson/mothership/janus-skills/skills/janus-upload-image/SKILL.md`
- FOUND commit: `f4f83d2` (feat(27-03): add janus-upload-portrait skill)
- FOUND commit: `851eb18` (feat(27-03): add janus-upload-image skill)
