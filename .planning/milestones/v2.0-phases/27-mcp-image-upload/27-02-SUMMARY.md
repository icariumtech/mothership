---
phase: 27-mcp-image-upload
plan: 02
subsystem: api
tags: [fastmcp, httpx, mcp, image-upload, django]

# Dependency graph
requires:
  - phase: 27-01
    provides: Django POST /api/gm/upload-image/ endpoint that this MCP tool delegates to
provides:
  - upload_image MCP tool in mcp_server.py — the interface janus-skills and Claude Code agents call to upload images
affects:
  - 27-03-PLAN.md (janus-skills skill implementation calls this tool)
  - Any future skill that uploads campaign imagery

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MCP tool as thin HTTP delegate: @mcp.tool async def -> httpx.AsyncClient POST -> return r.json()"
    - "httpx timeout=60.0 for Pillow-heavy endpoints (image conversion can take several seconds)"

key-files:
  created: []
  modified:
    - mcp_server.py

key-decisions:
  - "timeout=60.0 on AsyncClient (not default) because Pillow amber-gradient 512x512 conversion can take several seconds on large inputs"
  - "convert: bool = True default matches Django view default — portrait auto-converts unless caller opts out"
  - "JSON body passes all four params unchanged; Django view is the authoritative validation and path-traversal guard per threat model T-27-02-01"

patterns-established:
  - "upload_image follows identical structure to existing five tools: @mcp.tool -> async with httpx.AsyncClient -> raise_for_status -> return response"

requirements-completed: [D-02, D-03]

# Metrics
duration: 1min
completed: 2026-05-27
---

# Phase 27 Plan 02: MCP Image Upload Tool Summary

**upload_image @mcp.tool added to mcp_server.py — thin httpx delegate to Django /api/gm/upload-image/ with 60s timeout and four image_type routing values**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-05-27T20:28:51Z
- **Completed:** 2026-05-27T20:29:32Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added sixth `@mcp.tool` function `upload_image` to `mcp_server.py`
- Follows exact pattern of the five existing tools; no changes to other functions, imports, or `__main__` block
- `httpx.AsyncClient(timeout=60.0)` used (not default no-timeout) to accommodate Pillow conversion time
- Docstring documents all four `image_type` values, their destination paths, and `convert` parameter semantics

## Task Commits

Each task was committed atomically:

1. **Task 1: Add upload_image tool to mcp_server.py** - `48b310d` (feat)

**Plan metadata:** _(to be added by final commit)_

## Files Created/Modified
- `mcp_server.py` - Added `upload_image` async MCP tool (lines 74–116)

## Decisions Made
- Used `httpx.AsyncClient(timeout=60.0)` instead of default no-timeout form because Pillow amber-gradient conversion is CPU-bound and can take several seconds on large portraits
- `convert: bool = True` default matches Django view default, so callers get conversion automatically unless they opt out
- All four parameters passed through to Django unchanged — Django view (Plan 01) is the authoritative security and validation boundary per threat model

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

`python` command not found on system PATH (WSL environment); used `python3` for syntax check. Import check skipped (httpx not in system Python — runs inside Docker). Syntax-only AST parse confirmed `syntax OK`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `upload_image` MCP tool is ready for Plan 03 (janus-skills skill implementation)
- Tool callable as: `upload_image(filename, content_base64, image_type, convert=True)`
- Requires the Docker stack (`app` + `mcp`) to be running for end-to-end testing

---
*Phase: 27-mcp-image-upload*
*Completed: 2026-05-27*
