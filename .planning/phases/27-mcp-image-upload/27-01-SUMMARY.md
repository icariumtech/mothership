---
phase: 27-mcp-image-upload
plan: "01"
subsystem: api
tags: [django, pillow, image-upload, base64, mcp, file-storage]

requires:
  - phase: 23-gm-data-api
    provides: gm_data.py module pattern and path-traversal guard idiom
provides:
  - POST /api/gm/upload-image/ Django endpoint accepting base64-encoded images
  - Pillow>=10.0.0 pinned in requirements.txt (enables portrait conversion in Docker)
  - data/campaign/images/logos/, maps/, misc/ directories tracked in git
affects: [27-mcp-image-upload, mcp-tools, janus-skills]

tech-stack:
  added: [Pillow>=10.0.0]
  patterns:
    - "base64 binary upload via JSON body (filename + content_base64 + image_type + convert)"
    - "ALLOWED_IMAGE_TYPES frozenset allowlist for image_type validation"
    - "bool normalization: str(convert).lower() not in ('false','0','no') for MCP string-bool compat"
    - "Non-fatal portrait conversion with conversion_warning fallback"

key-files:
  created:
    - core/tests/test_upload_image.py
    - data/campaign/images/logos/.gitkeep
    - data/campaign/images/maps/.gitkeep
    - data/campaign/images/misc/.gitkeep
  modified:
    - requirements.txt
    - core/views/gm_data.py
    - core/views/__init__.py
    - core/urls.py

key-decisions:
  - "Filename safety check uses character-in-string test for '/', '\\\\', '..' (not regex) — simpler and covers all traversal vectors"
  - "Portrait conversion is non-fatal: exceptions log a warning and set conversion_warning in response, not 500"
  - "validate=False for base64.b64decode — lenient decode; binascii.Error caught for explicit 400"
  - "Scripts path added to sys.path with if-guard to avoid duplicate entries"

patterns-established:
  - "Pattern: binary upload via base64 JSON body — used by MCP clients that cannot send multipart"
  - "Pattern: type_dirs dict mapping image_type enum to DATA_DIR-relative path"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-06]

duration: 2min
completed: 2026-05-27
---

# Phase 27 Plan 01: Django image upload endpoint with Pillow dependency and campaign image directories

**POST /api/gm/upload-image/ Django endpoint with path-traversal guard, image_type allowlist, optional portrait conversion via scripts/convert_npc_portraits.py, and Pillow>=10.0.0 added to requirements.txt**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-27T20:24:36Z
- **Completed:** 2026-05-27T20:26:55Z
- **Tasks:** 2
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments
- Added Pillow>=10.0.0 to requirements.txt — closes the portrait conversion gap in Docker builds
- Created git-tracked image subdirectories: logos/, maps/, misc/ under data/campaign/images/
- Implemented api_gm_upload_image with full security checks (filename safety, image_type allowlist, base64 validation)
- Wired endpoint into core/views/__init__.py and core/urls.py; all 7 non-skipped tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Pillow dependency + image directories** - `e3043f0` (chore)
2. **Task 2 RED: Failing tests** - `3d97883` (test)
3. **Task 2 GREEN: Upload view implementation** - `4a5d608` (feat)

**Plan metadata:** (docs: complete plan — added after this summary)

_Note: Task 2 follows TDD — test commit (RED) then feat commit (GREEN)_

## Files Created/Modified
- `requirements.txt` - Added Pillow>=10.0.0
- `data/campaign/images/logos/.gitkeep` - Git-tracked logos directory
- `data/campaign/images/maps/.gitkeep` - Git-tracked maps directory
- `data/campaign/images/misc/.gitkeep` - Git-tracked misc directory
- `core/views/gm_data.py` - Added api_gm_upload_image + base64/binascii/sys imports + updated docstring
- `core/views/__init__.py` - Added api_gm_upload_image to gm_data import block
- `core/urls.py` - Added path('api/gm/upload-image/') after gm_data_schema

## Decisions Made
- Filename safety check uses character-in-string membership test (`any(c in filename for c in ('/', '\\', '..'))`) rather than regex — simpler, zero-overhead, covers all traversal vectors
- Portrait conversion (convert_portrait call) is non-fatal: failures log a warning and set `conversion_warning` in the response instead of returning 500, so the raw image is always saved even if conversion fails
- `base64.b64decode(content_base64, validate=False)` — lenient decoding; invalid characters raise `binascii.Error` which is caught and returned as 400
- Scripts/ path added with if-guard (`if scripts_dir not in sys.path`) to avoid duplicate entries across requests

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- POST /api/gm/upload-image/ is live and tested
- Ready for Plan 02: MCP tool wrapping this endpoint (fastmcp tool definition in the MCP server)
- Portrait conversion path verified: view calls convert_portrait(str(dest_path), str(output_path)) — Plan 02 can rely on this

## Threat Flags

No new threat surface beyond what was planned in the STRIDE register. All T-27-01-01 and T-27-01-02 mitigations implemented (filename blocklist + image_type allowlist).

## Self-Check: PASSED

- [x] requirements.txt contains `Pillow>=10.0.0`
- [x] data/campaign/images/logos/.gitkeep exists
- [x] data/campaign/images/maps/.gitkeep exists
- [x] data/campaign/images/misc/.gitkeep exists
- [x] core/views/gm_data.py exports api_gm_upload_image
- [x] core/views/__init__.py imports api_gm_upload_image
- [x] core/urls.py has path('api/gm/upload-image/')
- [x] All 7 non-skipped tests in test_upload_image.py pass
- [x] python manage.py test core.tests exits 0 (14 tests, 3 skipped)

---
*Phase: 27-mcp-image-upload*
*Completed: 2026-05-27*
