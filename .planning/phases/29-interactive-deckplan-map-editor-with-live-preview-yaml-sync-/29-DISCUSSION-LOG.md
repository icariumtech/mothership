# Phase 29: Interactive deckplan map editor with live preview, YAML sync, and POI placement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 29-interactive-deckplan-map-editor-with-live-preview-yaml-sync-
**Areas discussed:** Data-model correction, Legacy removal sequencing, Editor home, Selection sync, POI editing, Element scope

---

## Data-model correction (raised by user mid-discussion)

The initial analysis assumed the on-disk model was "one deck = one file"
(`map/manifest.yaml` + per-deck `map/*.yaml`). The user corrected this: the live
format is a single `deckplan.yaml` per location holding hull, all decks, doors,
vents, etc. Codebase check confirmed: `deckplan.yaml` is used by every ship except
`somnus`, which still carries the legacy `map/` format. This reshaped the editor
recommendations (multi-deck handling moved back into v1 as a deck selector) and
surfaced the legacy-removal work.

---

## Legacy removal sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| First plan of Phase 29 | Fold removal in as Plan 1 (remove map/ loader paths + fallbacks, migrate somnus), then build the editor on a clean single-format base. | ✓ |
| Quick standalone task now | Do the removal immediately as a separate cleanup commit/PR before planning. | |
| Separate inserted phase | Insert a dedicated cleanup phase (e.g. 28.2) with its own cycle. | |

**User's choice:** First plan of Phase 29.
**Notes:** Keeps cleanup tied to the phase that needs it; editor (Plans 2+) builds on a single canonical format.

---

## Editor home

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated map editor view | New GMViewType with map canvas + property/widget panel on selection. Most room for drag/place UX, bigger build. | |
| Preview pane in file editor | Augment Phase 28's FileEditorView with a live preview below Monaco; click map element → jump to YAML. | ✓ |
| Both / phased | Preview pane v1, dedicated view later. | (effectively chosen — preview v1, dedicated deferred) |

**User's choice:** Preview pane in file editor (after Claude's recommendation).
**Notes:** "Jump to YAML node" only makes sense when YAML is visible — points at the preview-pane model. Reuses Phase 28 tree/open/save+SSE. Dedicated widget view deferred to v2.

---

## Selection sync

| Option | Description | Selected |
|--------|-------------|----------|
| Bidirectional | Map click → YAML highlight AND Monaco caret → map highlight. | |
| Map → YAML only | Click map element → jump to + highlight matching YAML object by id. | ✓ |
| You decide | Defer to planner. | |

**User's choice:** Map → YAML only (one-way), deck-scoped id lookup.
**Notes:** Most of the value; bidirectional is a cheap stretch goal, deferred.

---

## POI editing

| Option | Description | Selected |
|--------|-------------|----------|
| Drag + form, regen YAML | Add/drag/edit via widget panel; regenerate YAML block. Richest, risky round-trip. | |
| Drag-to-move + click-to-add via surgical edits | Drag updates position; click adds stub; rename/type/delete in text; surgical text patches preserve formatting. | ✓ |
| Preview only (no edit) | Read-only preview + click-to-jump; placement deferred. | |

**User's choice:** Drag-to-move + click-to-add via surgical text edits (per Claude's recommendation).
**Notes:** Deck YAML is hand-formatted flow-style; full reserialize would reformat files. POIs don't yet exist on disk, so click-to-add is genuinely useful in v1. Surgical Monaco buffer edits flagged as the main technical risk for research/planning.

---

## Element scope

| Option | Description | Selected |
|--------|-------------|----------|
| POIs | Place/move/edit markers — core request. | ✓ |
| Rooms / corridors | Click-to-jump yes; geometry reshaping deferred. | ✓ (jump only) |
| Tokens | Runtime encounter state, not authoring. | |
| Multi-deck switching | Deck selector — required since one file holds all decks. | ✓ |

**User's choice:** POIs (place/move) + rooms (click-to-jump) + deck selector. Tokens out. Geometry deferred.
**Notes:** Data-model correction pulled deck-switching back into v1.

---

## Claude's Discretion

- Deck selector UI form (tabs / dropdown / segmented).
- Preview pane sizing (resizable vs fixed ratio below Monaco).
- POI add-stub default values.
- Auto-show-preview vs toggle for deckplan files.
- Jumped-to YAML line highlight styling.

## Deferred Ideas

- Dedicated map-editor GMViewType with property/widget panel (v2).
- Bidirectional caret ↔ map sync.
- Room / hull geometry (polygon) editing.
- Token editing in the authoring tool.
- POI rename / type / icon / delete via UI (text-only in v1).
