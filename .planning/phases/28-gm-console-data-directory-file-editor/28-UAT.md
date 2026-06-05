---
status: complete
phase: 28-gm-console-data-directory-file-editor
source: [28-01-SUMMARY.md, 28-02-SUMMARY.md, 28-03-SUMMARY.md]
started: 2026-06-02T00:00:00Z
updated: 2026-06-05T18:40:29Z
---

## Tests

### 1. FILE_EDITOR button in ViewRail
expected: In the GM Console, the left ViewRail has a code/editor icon button at the very bottom (below a separator, separate from STANDBY/BRIDGE/ENCOUNTER buttons). It stays at the bottom regardless of other buttons.
result: pass

### 2. DISPLAY button disabled in file editor
expected: When the FILE_EDITOR view is active, the DISPLAY button (top of ViewRail) is visually grayed out / disabled and cannot be clicked to push to players.
result: pass

### 3. File Editor opens full-screen split pane
expected: Clicking the FILE_EDITOR button opens a full-screen view with two panels: a narrow file tree on the left (~272px wide) and a large editor area on the right. The view fills the GM Console content area completely with no black bar or blank space.
result: pass

### 4. Data directory tree loads
expected: The left panel shows the JANUS data directory contents — folders like "campaign", "galaxy", "ships" with folder icons. Files appear with their filename and extension. Directories are listed before files.
result: pass

### 5. Lazy folder expansion
expected: Clicking a folder in the tree expands it and loads its children from the server (first click triggers loading). Sub-folders and files appear inside. Clicking again collapses the folder.
result: pass

### 6. Open a YAML file — editable in Monaco
expected: Clicking a .yaml or .yml file in the tree loads its content into the Monaco editor on the right. The editor is editable (cursor appears, text can be typed). The file path is displayed above the editor.
result: pass

### 7. Dirty indicator — amber save button
expected: After editing text in the Monaco editor, the Save button changes from teal/normal to amber, indicating unsaved changes. Before editing, the Save button is in its clean (non-amber) state.
result: pass

### 8. Save with Ctrl+S
expected: While the Monaco editor is focused and the file has unsaved changes (amber button), pressing Ctrl+S saves the file. The save button briefly flashes green then returns to clean state. The file on disk is updated.
result: pass
notes: disk write verified — recently modified YAML files found on disk (campaign/crew/alex_novak.yaml and others) within seconds of save

### 9. Open a Markdown file — editable
expected: Clicking a .md file in the tree loads its content into Monaco as editable (not read-only). The editor allows typing and editing.
result: pass

### 10. Image file preview
expected: Clicking an image file (.jpg, .png, .gif, etc.) in the tree displays the image in the right panel (as an <img> preview) instead of the Monaco editor. No error is shown.
result: pass

### 11. localStorage persistence
expected: Open a file in the editor, then navigate away (switch to BRIDGE view) and come back to FILE_EDITOR. The same file that was last opened is automatically re-loaded in the editor.
result: pass

## Summary

total: 11
passed: 11
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

No gaps — all 11 tests passed.
