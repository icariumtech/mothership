# Phase 28: GM Console Data Directory File Editor — Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a full-screen file browser + YAML/Markdown editor as a new GMViewType in the GM Console. The GM can browse the full `data/` directory, open any file, edit YAML/Markdown content in Monaco Editor, and save — triggering SSE broadcast to player terminals without needing SSH or Claude Code.

The backend API is fully built (Phase 23). This phase is 100% frontend + a minor ViewRail entry.

**Out of scope:** Create new files, delete files, directory management, Markdown preview rendering, custom Monaco theme, player-facing UI changes.

</domain>

<decisions>
## Implementation Decisions

### D-01: Layout — Full-Screen GMViewType
- New `GMViewType` similar to `EncounterView` and `BridgeView` — a full-screen view within the GM Console.
- ViewRail entry at the **bottom** of the rail (below existing view icons). Use a folder/file icon.
- Split pane: file tree ~250-300px fixed-width on the left, Monaco editor fills the remaining width.
- DISPLAY button is **disabled** when in the file editor view (GM-only activity, no player push).

### D-02: Navigation — Lazy-Load Tree with Filter
- Ant Design `Tree` component with `loadData` prop for lazy loading. Each folder node fetches children via `GET /api/gm/data/?dir={path}` on expand.
- Root shows full `data/` directory (all of `campaign/`, `galaxy/`, `ships/`, etc.).
- Search/filter input above the tree. Type to filter visible tree nodes by filename.
- **All file types** visible in the tree (YAML, Markdown, images, scripts, etc.).
- Non-YAML/Markdown files: show read-only preview or info panel (images as `<img>`, binary files as "Binary file — cannot edit" message). No write access for non-editable types.

### D-03: Editor — Monaco with vs-dark Theme
- Use `@monaco-editor/react` package. Language detection from file extension:
  - `.yaml` / `.yml` → `yaml`
  - `.md` → `markdown`
  - other text files → `plaintext` (read-only)
- Theme: `vs-dark` (Monaco built-in — no custom theming needed for v1).
- No Markdown split preview — raw edit mode only.

### D-04: Save Workflow
- Explicit save: Save button in the editor header + Ctrl+S keyboard shortcut.
- Unsaved changes indicator (e.g., modified dot in the file title or Save button highlighted amber).
- YAML validation: the backend `PUT /api/gm/data/{path}` already validates. On error, display the backend's error message in a red banner above the editor. File is NOT saved on validation failure. No "Save Anyway" option.
- On successful save: brief success indicator (button flash / "Saved" text). SSE broadcast fires automatically from the backend.

### D-05: Scope — Read + Edit Only
- Read and edit existing files only. No create-file, create-directory, or delete-file operations.
- These can be added in a future phase if the need arises.

### Claude's Discretion
- Exact ViewRail icon to use for the file editor view
- Whether to persist the last-opened file path across sessions (localStorage is fine if easy)
- Exact split pane sizing (250px vs 300px for tree panel)
- Whether to show file path as breadcrumb above the editor
- Error banner auto-dismiss timing
- Exact keyboard shortcut implementation for Ctrl+S in Monaco

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### GM Console Architecture
- `src/entries/GMConsole.tsx` — top-level entry; ViewRail + gm-console__content flex layout
- `src/components/gm/layout/ViewRail.tsx` — add new view icon at the bottom of the rail
- `src/components/gm/layout/ToolRail.tsx` — 48px right rail (not involved in this phase)
- `src/components/gm/views/EncounterView.tsx` — reference implementation for a full-screen GMViewType
- `src/components/gm/views/BridgeView.tsx` — second reference for GMViewType

### Existing File Tree Component (reuse pattern)
- `src/components/gm/LocationTree.tsx` — uses Ant Design `Tree` with custom nodes; lazy-load pattern reference

### Backend API (fully built — Phase 23)
- `core/views/gm_data.py` — Django view implementing all data file endpoints
- `core/urls.py` lines 34–40 — URL patterns for `/api/gm/data/`
- `mcp_server.py` — MCP tools that use the same API (reference for path format and behavior)

### Design System
- `STYLE_GUIDE.md` — teal/amber palette, chamfered panels, fonts
- `src/components/ui/README.md` — DashboardPanel / CompactPanel API

### API Reference (from tests)
- `core/tests/test_gm_api.py` — documents all endpoints with request/response shapes:
  - `GET /api/gm/data/?dir={dir}` — list files (dir relative to `data/`)
  - `GET /api/gm/data/{path}` — read raw file content
  - `PUT /api/gm/data/{path}` — write file with YAML validation + SSE broadcast
  - `GET /api/gm/data-schema` — returns `DATA_DIRECTORY_GUIDE.md` content

### Service Layer
- `src/services/gmConsoleApi.ts` — existing GM API service; new data-file methods should go here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/gm/LocationTree.tsx`: Ant Design `Tree` with `loadData` + custom node rendering — can mirror this pattern for the data file tree. Note: LocationTree is locations-specific; build a new `DataFileTree` component rather than extending it.
- `src/components/gm/panels/DocumentsPanel.tsx`: shows pattern for fetching + displaying a content panel from the GM API.
- `src/services/gmConsoleApi.ts`: add `listDataDir(dir)`, `readDataFile(path)`, `writeDataFile(path, content)` methods following the existing service pattern.

### Established Patterns
- GMViewType enum: new value (e.g., `FILE_EDITOR`) added to existing type; ViewRail maps it to an icon + label.
- CSS class collision rule: GM Console views use `gm-{view}-view` prefix (NOT `{view}-view`) to avoid collision with player terminal's `position:fixed` classes.
- ToolRail/SlideOutPanel: not used for this phase — the editor is a full view, not a panel.
- DISPLAY button disabling: check how existing views handle this; the ViewRail may need a "no-display" flag for this view type.

### Integration Points
- `src/entries/GMConsole.tsx`: wire new `FILE_EDITOR` case in the view-switcher render
- `src/components/gm/layout/ViewRail.tsx`: add icon button at bottom with `FILE_EDITOR` type
- New component: `src/components/gm/views/FileEditorView.tsx` + `FileEditorView.css`
- New component: `src/components/gm/FileTree.tsx` (Ant Design Tree with lazy load + filter)
- New API methods in `gmConsoleApi.ts` or a new `dataFileApi.ts` service

</code_context>

<specifics>
## Specific Ideas

- Monaco `@monaco-editor/react` is the explicit package choice (not raw Monaco or CodeMirror).
- `vs-dark` theme — no custom theming for this phase.
- ViewRail icon at the **bottom** of the rail — below the existing view buttons, near the separator/DISPLAY area.
- Unsaved changes should be clearly indicated (amber highlight or dot).
- The existing `PUT /api/gm/data/{path}` already triggers SSE broadcast — no extra backend work needed for live-update behavior.

</specifics>

<deferred>
## Deferred Ideas

- Create new file / new directory operations — future phase if needed
- Delete file with confirmation — future phase; needs a new DELETE endpoint
- Custom Monaco CRT theme (teal/amber) — aesthetic improvement for a later pass
- Markdown rendered preview (split view) — future enhancement
- Persist last-opened file path to localStorage — Claude's discretion (easy add-on)
- File rename / move operations — future phase

</deferred>

---

*Phase: 28-gm-console-data-directory-file-editor*
*Context gathered: 2026-06-01 via planning discussion*
