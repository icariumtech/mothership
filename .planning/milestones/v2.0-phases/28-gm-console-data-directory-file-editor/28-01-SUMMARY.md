---
phase: 28-gm-console-data-directory-file-editor
plan: "01"
subsystem: backend-api + frontend-service + gm-console-ui
tags: [api, file-editor, view-rail, gmconsole, data-directory]
dependency_graph:
  requires: []
  provides:
    - api_gm_data_list returns {name, type} entries including directories
    - listDataDir('') returns HTTP 200 with data root listing
    - gmConsoleApi.listDataDir / readDataFile / writeDataFile
    - GMViewType includes FILE_EDITOR
    - ViewRail FILE_EDITOR button at bottom; DISPLAY disabled when active
  affects:
    - core/views/gm_data.py (api_gm_data_list)
    - src/services/gmConsoleApi.ts
    - src/components/gm/layout/ViewRail.tsx
    - src/components/gm/layout/ViewRail.css
tech_stack:
  added: []
  patterns:
    - Django JsonResponse with list of dicts (dirs+files sorted by type then name)
    - axios GET with params for directory listing; GET with responseType text for file read; PUT with raw text body for file write
    - Standalone JSX button outside VIEW_ITEMS map loop for bottom-rail placement
key_files:
  created: []
  modified:
    - core/views/gm_data.py
    - src/services/gmConsoleApi.ts
    - src/components/gm/layout/ViewRail.tsx
    - src/components/gm/layout/ViewRail.css
decisions:
  - "FILE_EDITOR button rendered as standalone JSX element below a second separator — not added to VIEW_ITEMS array — to keep the map loop clean and support bottom-rail placement via margin-top: auto"
  - "DISPLAY button disabled with pointer-events: none on the CSS class; also sets disabled attribute on the button element for accessibility"
  - "listDataDir passes dir param even when empty string; axios serializes params: { dir: '' } as ?dir= which the backend accepts"
metrics:
  duration: "~20min"
  completed: "2026-06-01T20:55:46Z"
  tasks_completed: 2
  files_modified: 4
---

# Phase 28 Plan 01: Backend List API + gmConsoleApi Data Methods + FILE_EDITOR ViewRail Summary

**One-liner:** Backend directory listing extended to return `{name, type}` objects with empty-dir-as-root support; three data-file API methods added to gmConsoleApi; FILE_EDITOR GMViewType + standalone bottom-rail button added to ViewRail.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend api_gm_data_list to return dirs+files; allow empty dir as root | c7d410b | core/views/gm_data.py |
| 2 | Add listDataDir, readDataFile, writeDataFile to gmConsoleApi + FILE_EDITOR to ViewRail | 2ce1f99 | src/services/gmConsoleApi.ts, src/components/gm/layout/ViewRail.tsx, src/components/gm/layout/ViewRail.css |

## What Was Built

### Task 1 — api_gm_data_list (core/views/gm_data.py)

The existing function returned HTTP 400 for empty `dir` param and returned bare filenames without type info. Two changes applied:

1. **Root listing**: Empty/omitted `dir` now sets `target = data_root` directly (no traversal check needed). Non-empty `dir` still goes through the path-traversal guard unchanged.
2. **Return shape**: Now returns `[{"name": "campaign", "type": "directory"}, ..., {"name": "janus.yaml", "type": "file"}]`. Sorted: directories first (alphabetical), then files (alphabetical). Broken symlinks filtered via `entry.exists()`.

### Task 2 — gmConsoleApi.ts + ViewRail

**gmConsoleApi.ts:**
- Added `DataDirEntry` interface: `{ name: string; type: 'file' | 'directory' }`
- Added `listDataDir(dir)` → GET `/api/gm/data/` with `{ params: { dir } }`
- Added `readDataFile(path)` → GET `/api/gm/data/{path}` with `responseType: 'text'`
- Added `writeDataFile(path, content)` → PUT `/api/gm/data/{path}` with `Content-Type: text/plain; charset=utf-8`
- All three added to the `gmConsoleApi` export object

**ViewRail.tsx:**
- `GMViewType` extended: `'STANDBY' | 'BRIDGE' | 'ENCOUNTER' | 'FILE_EDITOR'`
- `CodeOutlined` imported from `@ant-design/icons`
- DISPLAY button: `disabled={gmView === 'FILE_EDITOR'}` + CSS class `view-rail__display--disabled` when disabled
- FILE_EDITOR button is a standalone JSX element in `<div className="view-rail__file-editor-section">` — not in VIEW_ITEMS
- Layout order: DISPLAY → separator → view-rail__views (STANDBY/BRIDGE/ENCOUNTER) → separator → view-rail__file-editor-section

**ViewRail.css:**
- `.view-rail__display--disabled`: `opacity: 0.3; cursor: not-allowed; pointer-events: none`
- `.view-rail__file-editor-section`: `display: flex; flex-direction: column; align-items: center; margin-top: auto; padding-bottom: 4px`

## Verification Results

- Django test `test_list_files_returns_json`: PASS
- Full `GmDataApiTests` suite (9 tests, 1 skipped): PASS
- `pnpm run typecheck`: exits 0, no errors

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no stub patterns in modified files.

## Threat Flags

No new threat surface beyond the plan's threat register. The api_gm_data_list change is covered by T-28-01-01 (empty-string case explicitly rooted at data_root; path traversal guard preserved for non-empty paths).

## Self-Check: PASSED
