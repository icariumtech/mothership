# Phase 28: GM Console Data Directory File Editor — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 28-gm-console-data-directory-file-editor
**Areas discussed:** Layout / container, Navigation model, Editor richness, Scope of operations, Frameworks

---

## Layout / Container

| Option | Description | Selected |
|--------|-------------|----------|
| Wide SlideOutPanel (600px) | Widen existing SlideOutPanel for this tool only. Tree + editor side-by-side. | |
| Full-screen GM view | New GMViewType like EncounterView/BridgeView. Full canvas. | ✓ |
| Split modal/drawer | Ant Design Drawer from the right. Self-contained, dismissable. | |

**User's choice:** Full-screen GM view

| Option | Description | Selected |
|--------|-------------|----------|
| ViewRail entry (top-level) | Same level as Bridge/Encounter. DISPLAY button disabled. | ✓ |
| ToolRail tool (full-screen overlay) | Opens on top of current view without switching views. | |
| You decide | Either works architecturally. | |

**User's choice:** ViewRail entry — at the **bottom** of the ViewRail

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled / hidden when in this view | File editing is GM-only. DISPLAY button greyed out. | ✓ |
| Has no effect (keeps current player view) | Player terminal stays on whatever was showing. | |

**User's choice:** Disabled when in the view

| Option | Description | Selected |
|--------|-------------|----------|
| Split pane: tree left, editor right | Tree ~250-300px, editor fills the rest. IDE-style. | ✓ |
| Two-step: browse then edit | Full browser screen, then full editor screen. Simpler state. | |

**User's choice:** Split pane: tree left, editor right

| Option | Description | Selected |
|--------|-------------|----------|
| Full data/ directory | Shows galaxy/, campaign/, ships/ at top level. | ✓ |
| Campaign-focused default | Starts in data/campaign/ with nav-up option. | |
| You decide | Defer to planning. | |

**User's choice:** Full data/ directory

---

## Navigation Model

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy load on expand | Each folder loads children on click via API. Scalable. | ✓ |
| Load full tree upfront | Recursive fetch on mount. Always fully visible. | |
| You decide | Either works. | |

**User's choice:** Lazy load on expand

| Option | Description | Selected |
|--------|-------------|----------|
| YAML + Markdown only | Hide non-editable files. Focused and safe. | |
| All files | Show everything including images, scripts. | ✓ |
| You decide | Defer to planner. | |

**User's choice:** All files

| Option | Description | Selected |
|--------|-------------|----------|
| Show read-only preview or info | Images as `<img>`, binary as "cannot edit" message. | ✓ |
| Open but block save | Load content, disable Save for unsupported types. | |
| You decide | Defer to planner. | |

**User's choice:** Show read-only preview or info

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — filter input above the tree | Type to filter tree nodes by filename. | ✓ |
| No — tree browsing only | Navigate by expanding folders. | |
| You decide | Defer to planner. | |

**User's choice:** Yes — filter input above the tree

---

## Editor Richness

| Option | Description | Selected |
|--------|-------------|----------|
| Monaco Editor (@monaco-editor/react) | VS Code editor. YAML highlighting, error squiggles, ~2MB. | ✓ |
| CodeMirror 6 | Lighter (~300KB). YAML + Markdown support. | |
| Plain textarea | No new deps. Retro aesthetic. No syntax help. | |

**User's choice:** Monaco Editor (@monaco-editor/react)

| Option | Description | Selected |
|--------|-------------|----------|
| Custom CRT theme (teal/amber) | Match project palette via Monaco defineTheme(). | |
| vs-dark (Monaco built-in) | Standard dark theme. Ships out-of-the-box. | ✓ |
| You decide | Defer theming to Claude. | |

**User's choice:** vs-dark (Monaco's built-in dark)

| Option | Description | Selected |
|--------|-------------|----------|
| No — raw edit only | Markdown as raw text in Monaco. Consistent with YAML. | ✓ |
| Split Markdown preview | Rendered preview alongside editor for .md files. | |
| You decide | Defer to planner. | |

**User's choice:** No — raw edit only

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit save button + Ctrl+S | GM edits then explicitly saves. Unsaved changes indicator. | ✓ |
| Auto-save on blur | Saves when clicking away from editor. | |

**User's choice:** Explicit save button + Ctrl+S

| Option | Description | Selected |
|--------|-------------|----------|
| Show error inline, block save | Backend error in red banner. File not saved. | ✓ |
| Show error but allow force-save | Error + "Save Anyway" button for work-in-progress. | |
| You decide | Defer to planner. | |

**User's choice:** Show error inline, block save

---

## Scope of Operations

| Option | Description | Selected |
|--------|-------------|----------|
| Create new file | New file button in tree. GM enters filename. | |
| Create new directory | New folder button. Creates empty directory. | |
| Delete file | Delete with confirmation. Needs new DELETE endpoint. | |
| Read + edit only for now | No create or delete. Can add later. | ✓ |

**User's choice:** Read + edit only for now

---

## Frameworks

| Option | Description | Selected |
|--------|-------------|----------|
| Ant Design Tree + Monaco is the right stack | Existing Ant Design Tree + @monaco-editor/react. | ✓ |
| I have something specific in mind | Another tool or constraint. | |

**User's choice:** Ant Design Tree + Monaco — looks complete

---

## Claude's Discretion

- Exact ViewRail icon for the file editor view
- Whether to persist last-opened file path in localStorage
- Exact split pane sizing (250px vs 300px for tree panel)
- Whether to show file path as breadcrumb above the editor
- Error banner auto-dismiss timing
- Ctrl+S keyboard shortcut implementation details

## Deferred Ideas

- Create new file / new directory operations
- Delete file with confirmation (needs new DELETE endpoint)
- Custom Monaco CRT theme (teal/amber on dark)
- Markdown split preview rendering
- File rename / move operations
