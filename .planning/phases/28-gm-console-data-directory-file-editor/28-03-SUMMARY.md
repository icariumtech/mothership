---
phase: 28-gm-console-data-directory-file-editor
plan: "03"
subsystem: frontend/gm-console
tags: [react, monaco-editor, typescript, file-editor, gm-console, ant-design]

requires:
  - phase: 28-01
    provides: gmConsoleApi.writeDataFile/readDataFile/listDataDir; FILE_EDITOR GMViewType in ViewRail
  - phase: 28-02
    provides: DataFileTree component with lazy-load, filter, onSelectFile callback

provides:
  - FileEditorView component: full-screen split-pane editor (272px tree + Monaco fill)
  - Three-way file routing: YAML/MD editable, plaintext read-only in Monaco, images as img preview, binaries as cannot-edit panel
  - Save button with amber/teal state, Ctrl+S keyboard shortcut via Monaco addCommand
  - Error banner with 8s auto-dismiss for YAML validation failures
  - localStorage persistence of last-opened file path (janus_file_editor_last_path)
  - GMConsole.tsx wired: FILE_EDITOR case + handleDisplay guard

affects:
  - src/entries/GMConsole.tsx (FILE_EDITOR view wired)
  - src/components/gm/views/FileEditorView.tsx (created)
  - src/components/gm/views/FileEditorView.css (created)

tech-stack:
  added:
    - "@monaco-editor/react 4.7.0 (already installed before this plan)"
  patterns:
    - "Monaco Editor mounted via @monaco-editor/react with onMount ref pattern to avoid stale Ctrl+S closure"
    - "isDirty derived as content !== savedContent (not separate state variable)"
    - "useRef for handleSaveRef updated every render — safe Ctrl+S registration"
    - "Three-way file routing: getLanguage() / isImage() / isBinaryOrUnknown() pure functions"
    - "BINARY_EXTENSIONS allowlist for true binaries; all other non-image extensions render as plaintext in Monaco (read-only)"

key-files:
  created:
    - src/components/gm/views/FileEditorView.tsx
    - src/components/gm/views/FileEditorView.css
  modified:
    - src/entries/GMConsole.tsx

key-decisions:
  - "isBinaryOrUnknown uses explicit BINARY_EXTENSIONS allowlist — all unknown extensions fall through to Monaco plaintext (read-only), not binary panel. Safer default: users can still see the content."
  - "handleSaveRef pattern: useRef updated each render, onEditorMount closes over ref not the function — avoids stale isDirty/content in Ctrl+S handler"
  - "FILE_EDITOR case in handleDisplay returns immediately — no player push, consistent with ViewRail DISPLAY disabled state"
  - "Monaco height/width='100%' props passed to fill .gm-file-editor-view__monaco container (flex: 1, overflow: hidden)"

patterns-established:
  - "GM view CSS class prefix: gm-file-editor-view (not file-editor-view — collision guard per MEMORY.md)"
  - "File classification: getLanguage() returns 'yaml'|'markdown'|'plaintext'; isImage() and isBinaryOrUnknown() are pure boolean helpers"

requirements-completed: [D-01, D-02, D-03, D-04, D-05]

duration: ~25min
completed: 2026-06-01
---

# Phase 28 Plan 03: FileEditorView + GMConsole Wiring Summary

**Full-screen Monaco-based file editor wired into GM Console: YAML/MD editable, plaintext read-only, images as img preview, binaries as cannot-edit panel — with Ctrl+S, amber dirty indicator, error banner, and localStorage persistence.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-01
- **Completed:** 2026-06-01
- **Tasks:** 2/3 automated tasks complete (Task 3 is checkpoint:human-verify — awaiting)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- FileEditorView.tsx (279 lines): self-contained split-pane editor with DataFileTree on left and Monaco on right
- Three-way file routing: editable YAML/MD, read-only plaintext, image preview, binary panel
- Save button state machine: teal (clean) → amber (dirty) → loading (in-flight) → 150ms green flash (success)
- Ctrl+S registered in Monaco addCommand using a ref to avoid stale closure over isDirty/content state
- YAML validation error banner with 8s auto-dismiss via setTimeout
- localStorage persistence: janus_file_editor_last_path written on open, read on mount
- GMConsole.tsx: FileEditorView import + view-switcher case + handleDisplay guard

## Task Commits

1. **Task 1: Build FileEditorView** - `1e16124` (feat)
2. **Task 2: Wire into GMConsole.tsx** - `b685925` (feat)
3. **Task 3: Human verification checkpoint** - awaiting

## Files Created/Modified

- `src/components/gm/views/FileEditorView.tsx` - Full-screen split-pane editor component (279 lines)
- `src/components/gm/views/FileEditorView.css` - Layout: .gm-file-editor-view, tree panel, editor area, toolbar, error banner, empty state classes
- `src/entries/GMConsole.tsx` - Added FileEditorView import, FILE_EDITOR view-switcher case, FILE_EDITOR guard in handleDisplay

## Decisions Made

- `isBinaryOrUnknown` uses an explicit BINARY_EXTENSIONS allowlist (`.exe`, `.bin`, `.dll`, `.so`, `.dylib`, `.zip`, `.tar`, `.gz`, `.db`, `.sqlite`, `.pak`). All other non-image extensions render in Monaco as plaintext (read-only). This is a safer default than binary panel — the GM can still see the content.
- `handleSaveRef` pattern: a `useRef` is updated to `handleSave` every render. The `onEditorMount` closure captures the ref (not the function). This ensures Ctrl+S always calls the current version of `handleSave` with up-to-date state.
- `FILE_EDITOR` case added at the top of the `handleDisplay` switch with `return` — consistent with ViewRail's visual disabled state.
- Monaco `height="100%"` and `width="100%"` props passed explicitly to fill the flex container.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — FileEditorView is fully wired. DataFileTree lazy-loads from the live API. readDataFile and writeDataFile call the real Django endpoints.

## Threat Flags

No new threat surface beyond the plan's threat register. T-28-03-01 (path-traversal guard) is enforced by the backend. T-28-03-02 (localStorage) is GM-only and stores relative path only. T-28-03-03 (Monaco readOnly) is enforced by the `isReadOnly` flag derived from `getLanguage()`.

## Self-Check: PASSED

- [x] `src/components/gm/views/FileEditorView.tsx` exists (279 lines, above 150 minimum)
- [x] `src/components/gm/views/FileEditorView.css` exists with `.gm-file-editor-view` class
- [x] `src/entries/GMConsole.tsx` contains `FILE_EDITOR` (2 occurrences: view-switcher + handleDisplay)
- [x] Commit `1e16124` exists in git log
- [x] Commit `b685925` exists in git log
- [x] `pnpm run typecheck` exits 0
- [x] `pnpm run build` exits 0 (4114 modules transformed)
