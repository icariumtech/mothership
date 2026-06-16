---
phase: 29-interactive-deckplan-map-editor-with-live-preview-yaml-sync-
plan: "03"
subsystem: frontend/deckplan-editor
tags: [live-preview, deck-selector, editor-mode, poi-drag, split-pane, monaco]
dependency_graph:
  requires: [29-02]
  provides: [DeckSelector, DeckplanPreviewPane, isDeckplan, editable-poi-props]
  affects:
    - src/components/domain/encounter/EncounterMapRenderer.tsx
    - src/components/gm/MapPreview.tsx
    - src/components/gm/views/deckplan/DeckSelector.tsx
    - src/components/gm/views/deckplan/DeckplanPreviewPane.tsx
    - src/components/gm/views/FileEditorView.tsx
    - src/components/gm/views/FileEditorView.css
tech_stack:
  added: []
  patterns:
    - editor-mode POI interaction layer (editable prop gates all callbacks)
    - document-level pointer events for POI drag (mirrors TokenLayer pattern)
    - pendingDrag ref + DRAG_THRESHOLD=5 for click vs drag discrimination
    - amber #c9a050 drag outline in editor mode (vs token mode color)
    - debounced YAML re-parse (200ms) with last-good-parse retention
    - localStorage-persisted split ratio (60/40 default)
    - isDeckplan(path) basename gate for preview pane visibility
key_files:
  created:
    - src/components/gm/views/deckplan/DeckSelector.tsx
    - src/components/gm/views/deckplan/DeckplanPreviewPane.tsx
  modified:
    - src/components/domain/encounter/EncounterMapRenderer.tsx
    - src/components/gm/MapPreview.tsx
    - src/components/gm/views/FileEditorView.tsx
    - src/components/gm/views/FileEditorView.css
decisions:
  - "Document-level pointer events for POI drag tracking (same pattern as TokenLayer) rather than per-element onPointerMove — ensures drag tracking survives when pointer leaves the POI element"
  - "DeckplanPreviewPane uses last-good-parse ref (not state) for zero-render-cycle retention on parse error"
  - "Custom button row for DeckSelector instead of Ant Design Tabs — simpler, avoids antd style override churn for 1-4 tabs"
  - "44px resize handle hit target (4px visual via ::after pseudo-element) per mobile-friendly Spacing exceptions in UI-SPEC"
  - "splitRatioRef mirrors splitRatio state for use in stable resize callbacks without closure staleness"
  - "TODO(29-04) comment in FileEditorView marks exact wiring point for Plan 04 POI/room callbacks"
metrics:
  duration: "~35 minutes"
  completed: "2026-06-16"
  tasks: 3
  files: 6
---

# Phase 29 Plan 03: Live Map Preview Surface Summary

**One-liner:** Editor-mode POI callback surface (editable/onPoiClick/onPoiMove/onEmptyCellClick) on EncounterMapRenderer + MapPreview; DeckSelector amber tab strip; DeckplanPreviewPane with parse-error-resilient 200ms debounce; 60/40 resizable Monaco/preview split in FileEditorView.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add editor-mode POI props to EncounterMapRenderer + MapPreview | ba6af77 | `EncounterMapRenderer.tsx`, `MapPreview.tsx` |
| 2 | Build DeckSelector + DeckplanPreviewPane | d451790 | `DeckSelector.tsx`, `DeckplanPreviewPane.tsx` |
| 3 | Mount preview below Monaco in FileEditorView | ccbc92a | `FileEditorView.tsx`, `FileEditorView.css` |

## Verification Results

- `pnpm run typecheck` — clean, no new errors
- `pnpm run build` — success, 4129 modules transformed
- `isDeckplan()` returns true only for `deckplan.yaml` basename (verified by grep)
- Editor-mode props appear in both EncounterMapRenderer (36 matches) and MapPreview (13 matches)
- DeckplanPreviewPane.tsx — 259 lines (above 40-line minimum artifact requirement)
- DeckSelector.tsx — 108 lines
- FileEditorView.css — 151 lines with split-pane + resize-handle rules

## Deviations from Plan

### Plan Adjustments

**1. [Rule 2 - Auto-fix] Document-level pointer events for POI drag**
- **Found during:** Task 1 (after initial inline onPointerMove implementation)
- **Issue:** POI `onPointerMove` on the `<g>` element stops firing when the pointer exits the element during a drag — same problem TokenLayer solves with document-level handlers
- **Fix:** Added `useEffect`-attached document-level `pointermove`/`pointerup` handlers (active only when `editable=true`); POI element only needs `onPointerDown` to arm `poiPendingDrag`
- **Files modified:** `EncounterMapRenderer.tsx`
- **Commit:** ba6af77 (incorporated into Task 1 commit)

## Known Stubs

**1. Plan 04 TODO in FileEditorView.tsx (line 292)**
- `onRoomClick`, `onPoiClick`, `onPoiMove`, `onEmptyCellClick` are passed as `undefined` to `DeckplanPreviewPane` (no-op placeholders)
- The `TODO(29-04)` comment marks the wiring point
- This is explicitly planned: "Plan 04 wires those callbacks to Monaco edits" per plan objective
- The preview renders correctly; clicking/dragging POIs calls props that currently do nothing (no crash, no blank)

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns. All new code operates entirely on client-side in-memory YAML text and SVG rendering.

## Self-Check: PASSED

- `src/components/gm/views/deckplan/DeckSelector.tsx` — FOUND
- `src/components/gm/views/deckplan/DeckplanPreviewPane.tsx` — FOUND
- `src/components/gm/views/FileEditorView.css` — FOUND (with split-pane rules)
- Commit ba6af77 — FOUND (feat: editor-mode POI props)
- Commit d451790 — FOUND (feat: DeckSelector + DeckplanPreviewPane)
- Commit ccbc92a — FOUND (feat: mount preview in FileEditorView)
- TypeScript typecheck — CLEAN
- Production build — SUCCESS (54s, no errors)
