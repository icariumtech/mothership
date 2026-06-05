# Phase 29: Interactive deckplan map editor with live preview, YAML sync, and POI placement - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Give the GM a visual way to author deckplan maps. Two parts:

1. **Consolidate on `deckplan.yaml` (prerequisite cleanup).** Remove the legacy
   `map/manifest.yaml` + per-deck `map/*.yaml` format so the editor targets a
   single canonical format.
2. **Map editor (built on the clean base).** Extend Phase 28's `FileEditorView`
   so that opening a `deckplan.yaml` shows a live rendered map preview below the
   Monaco editor. The GM can switch decks, click a map element to jump to its
   YAML, and place/move POIs visually — with changes written back as surgical
   text edits.

**In scope:** legacy-format removal + somnus migration; live preview pane;
deck selector; map→YAML click-to-jump; POI drag-to-move and click-to-add;
room click-to-jump.

**Out of scope (deferred):** dedicated widget-editor GMViewType; bidirectional
(Monaco caret → map) sync; room/hull geometry reshaping; token editing;
POI rename/type/icon/delete via UI (stays in text editor for v1).

</domain>

<decisions>
## Implementation Decisions

### Phase Structure
- **D-01:** Legacy removal is **Plan 1** of this phase. Build the editor (Plans 2+)
  on a single-format base. (User chose "First plan of Phase 29".)

### Plan 1 — Consolidate on `deckplan.yaml`
- **D-02:** `deckplan.yaml` (one file per location holding `hull`, `total_decks`,
  and `decks[]` with each deck's `rooms`/`doors`/`vents`/`poi`) is the **sole**
  map format after this phase.
- **D-03:** Remove the legacy `map/` loader paths: `load_map`,
  `load_encounter_manifest`, `load_deck_map` in `core/data_loader.py`, plus the
  `map/`-format fallback branches in `core/views/encounter.py` and
  `core/views/navigation.py`. Confirm/clean the `load_map` callers at
  `core/data_loader.py:350` and `:406` (they store `loc['map']`).
- **D-04:** Migrate `somnus` from `data/ships/somnus/map/manifest.yaml` +
  `main_deck.yaml` → a single `data/ships/somnus/deckplan.yaml`; delete the
  `map/` dir. Somnus is the **only** location still on the legacy format.
- **D-05:** Update `docs/schemas/schema-encounters.md` in the **same commit**
  (schema-sync rule) — drop manifest/deck-file docs, describe `deckplan.yaml`
  as canonical.
- **D-06:** Correct the stale MEMORY note referencing `data/galaxy/tau-ceti/somnus/map/`.

### Plans 2+ — Editor home & layout
- **D-07:** Live preview rendered **below Monaco** inside the existing
  `FileEditorView` (NOT a new dedicated GMViewType). Shown only when the open
  file is a `deckplan.yaml` (detect by filename).
- **D-08:** **Deck selector** (tabs or dropdown) in the preview to choose which
  deck renders — one `deckplan.yaml` contains all decks.

### Plans 2+ — Selection sync
- **D-09:** **Map → YAML, one-way.** Click a POI or room on the map → reveal +
  highlight its line in Monaco. Lookup is **deck-scoped** `id:` matching (ids may
  repeat across decks). Bidirectional (caret → map) is deferred.

### Plans 2+ — POI editing
- **D-10:** **Drag-to-move** a POI → patch its `position: {x, y}` numbers.
- **D-11:** **Click an empty cell → add** a POI stub into the selected deck's
  `poi:` list (create the list if absent).
- **D-12:** All map-driven writes are **surgical text edits into Monaco's buffer**
  — never a full YAML reserialize. This preserves the hand-authored flow-style
  formatting (`- [7.0, 10.0]`) and comments.
- **D-13:** POI rename / type / icon / delete stay in the text editor for v1.

### Plans 2+ — Element scope
- **D-14:** POIs (place/move) + rooms (click-to-jump only). Tokens out. Hull/room
  geometry reshaping deferred.

### Plans 2+ — Save
- **D-15:** Reuse the existing `PUT /api/gm/data/{path}` (raw text → YAML
  validation → SSE broadcast). **No new backend write endpoint.**

### Claude's Discretion
- Deck selector UI form (tabs vs dropdown vs segmented control).
- Preview pane sizing / resizable split vs fixed ratio below Monaco.
- POI add-stub default values (type, icon, placeholder name/id).
- Visual affordance for "this YAML is a deckplan → show preview" (auto vs toggle).
- Exact highlight styling for the jumped-to YAML line.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 28 File Editor (reuse base)
- `src/components/gm/views/FileEditorView.tsx` — Monaco + tree + save+SSE; the
  preview pane and POI editing hang off this.
- `src/components/gm/views/FileEditorView.css`
- `src/components/gm/DataFileTree.tsx` — data-directory tree.
- `.planning/phases/28-gm-console-data-directory-file-editor/28-CONTEXT.md` —
  prior decisions (Monaco `@monaco-editor/react`, `vs-dark`, save via
  `PUT /api/gm/data/{path}`, GM-only no-display view).

### Map rendering (reuse)
- `src/components/gm/MapPreview.tsx` — SVG preview with pan/zoom, token drag,
  door-status popups (`fill` prop for full-container fill).
- `src/components/domain/encounter/EncounterMapRenderer.tsx` / `.css` — core SVG renderer.
- `src/types/encounterMap.ts` — `PoiData` (`id, type, room, position:{x,y}, name,
  icon, status?, description?`), `RoomData`, deck/manifest types, type guards.

### Backend — deckplan format & loaders
- `core/data_loader.py` — `load_deckplan()` (lines ~767–792, canonical loader);
  `load_map`/`load_encounter_manifest`/`load_deck_map` (lines ~427–512, **to remove**).
- `core/views/encounter.py` — endpoints; deckplan-first logic + legacy fallback
  (lines ~415–562, fallback **to remove**).
- `core/views/navigation.py:78` — `load_deck_map` caller (legacy **to remove**).
- `core/payload_builder.py` — consumes `load_deckplan` (lines ~45–169).
- `core/views/gm_data.py` — `PUT /api/gm/data/{path}` (raw write + SSE, the save
  path) and `api_gm_upload_svg_map` (SVG → `deckplan.yaml` converter, ~497–524).

### Data examples
- `data/ships/patrol_gunboat/deckplan.yaml` — canonical structure reference.
- `data/ships/somnus/map/manifest.yaml` + `main_deck.yaml` — legacy to migrate/delete.

### Schema docs (update in same commit when format changes)
- `docs/schemas/schema-encounters.md` — encounter map / deckplan / POI fields.
- `CLAUDE.md` "Schema Sync" table — the rule requiring the above.

### Design system
- `STYLE_GUIDE.md` — teal/amber palette, chamfered panels, monospace fonts.
- `src/components/ui/README.md` — DashboardPanel / CompactPanel API.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FileEditorView.tsx`: already opens files in Monaco, tracks dirty state, saves
  via `gmConsoleApi.writeDataFile()` → `PUT /api/gm/data/{path}` (auto-SSE), with
  Ctrl+S wired. The preview pane + POI editing extend this component.
- `MapPreview.tsx` / `EncounterMapRenderer.tsx`: render deckplan decks as SVG with
  pan/zoom and existing drag (tokens) — the POI drag interaction can follow the
  same coordinate/drag plumbing (`getGridCell`, `svgCoordinates`).
- `load_deckplan()`: already the single source of truth for the new format; the
  removal work deletes the *alternative* paths around it.

### Established Patterns
- CSS collision rule: GM Console views use `gm-{view}-view` prefix to avoid the
  player terminal's `position:fixed` classes.
- Surgical YAML editing: data files are hand-authored flow-style with no
  reserialize tolerance — edits must patch text ranges, not dump the parsed tree.
- Schema-sync rule (`CLAUDE.md`): any change to deckplan YAML shape or loader must
  update `docs/schemas/schema-encounters.md` in the same commit.

### Integration Points
- `FileEditorView.tsx` render: branch on `isDeckplan(path)` to mount the preview
  pane below Monaco.
- Monaco buffer: id→text-range mapping for click-to-jump and surgical POI edits
  (drag/add) — drive via the editor model API (reveal/decorations/edits).
- `core/data_loader.py` + `core/views/encounter.py` + `navigation.py`: remove
  legacy `map/` branches without breaking deckplan-served locations.

</code_context>

<specifics>
## Specific Ideas

- One `deckplan.yaml` = whole ship (hull + all decks + doors + vents + POIs). The
  preview must therefore offer a **deck selector**; "one deck = one file" is the
  old (now-removed) model.
- POIs do **not yet exist** in any deckplan on disk — "POI placement" is genuine
  new authoring, which is why click-to-add is in v1.
- The editor must never reformat the YAML — surgical edits only.

</specifics>

<deferred>
## Deferred Ideas

- **Dedicated map-editor GMViewType** with a property/widget panel (edit POI
  fields via forms, hide YAML) — the richer "v2" product. Revisit once the
  preview-pane v1 validates the render + sync plumbing.
- **Bidirectional sync** — Monaco caret → highlight element on map.
- **Room / hull geometry editing** — polygon vertex drag/reshape.
- **Token editing** in the authoring tool (tokens are runtime encounter state).
- **POI rename / type / icon / delete via UI** (text-only in v1).

None — discussion stayed within phase scope (the legacy-removal was folded in as
Plan 1 by explicit decision, not scope creep).

</deferred>

---

*Phase: 29-interactive-deckplan-map-editor-with-live-preview-yaml-sync-*
*Context gathered: 2026-06-05*
