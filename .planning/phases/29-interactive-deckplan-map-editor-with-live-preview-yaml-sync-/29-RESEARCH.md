# Phase 29: Interactive deckplan map editor with live preview, YAML sync, and POI placement - Research

**Researched:** 2026-06-13
**Domain:** React/TypeScript SVG map rendering + Monaco editor text manipulation + Django YAML data layer cleanup
**Confidence:** HIGH

## Summary

This phase has two distinct halves with very different risk profiles. **Plan 1 (legacy
format removal)** is a mechanical but well-bounded refactor: the codebase already has
`load_deckplan()` as the canonical loader and most of `core/views/encounter.py` already
has deckplan-first logic with legacy fallback branches that can be deleted. The only real
migration work is converting `data/ships/somnus/map/manifest.yaml` + `main_deck.yaml` into
a single `data/ships/somnus/deckplan.yaml` (straightforward 1:1 field mapping — verified
below) and deleting ~6 dead methods/branches plus the `map/` directory.

**Plan 2+ (the editor)** is the higher-complexity half but the codebase already has all the
building blocks: `FileEditorView.tsx` (Monaco + tree + save+SSE from Phase 28),
`MapPreview.tsx` / `EncounterMapRenderer.tsx` (SVG rendering with pan/zoom and existing
token drag-and-drop via pointer events), and the `yaml` npm package (v2.9.0, already a
dependency) which provides exactly the AST/CST + `LineCounter` API needed for accurate
line/column mapping of deck-scoped `id:` and `position:` YAML nodes — **verified working
in this session** against flow-style (`{x: 1, y: 2}`) POI entries, which is the format
this codebase uses. Monaco's `revealLineInCenter` + `deltaDecorations` + model
`applyEdits`/`pushEditOperations` are the standard, stable APIs (unchanged across
@monaco-editor/react 4.x) for click-to-jump and surgical text patches.

**Primary recommendation:** Use the `yaml` package's `parseDocument({ lineCounter })` +
CST node `.range` to build a deck-scoped id→range map (and POI `position` value ranges)
on every Monaco content change; drive click-to-jump via `revealRangeInCenter` +
`deltaDecorations`, and drive POI move/add via `editor.executeEdits()` replacing only the
narrow `x`/`y` value text spans (or inserting a new flow-map item into the `poi:` sequence)
— never call `YAML.stringify()` on the whole document.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Legacy loader removal (`load_map`/`load_encounter_manifest`/`load_deck_map`) | API/Backend | — | Pure Django data-loader cleanup; no frontend contract change since `load_deckplan()` already serves the same shape |
| Somnus migration to `deckplan.yaml` | Database/Storage (data files) | API/Backend | File-format change in `data/`; loader already reads it via `load_deckplan()` |
| Live map preview pane | Browser/Client | — | Pure React rendering inside `FileEditorView`, reuses existing `MapPreview`/`EncounterMapRenderer` SVG components |
| Deck selector | Browser/Client | — | Local UI state in `FileEditorView`; parses `decks:` from the in-editor YAML text, no API call |
| Map → YAML click-to-jump (Monaco reveal/highlight) | Browser/Client | — | Monaco editor model API; id→range map built client-side from Monaco's current buffer text |
| Surgical POI drag/add text patches | Browser/Client | — | `editor.executeEdits()` on Monaco's in-memory model; persisted via existing save flow |
| Save / persistence | API/Backend | — | Reuses `PUT /api/gm/data/{path}` unchanged (D-15) — raw text write + YAML-validity check + SSE broadcast |
| Schema documentation | Database/Storage (docs) | — | `docs/schemas/schema-encounters.md` — already mostly deckplan-only; small edits to remove remaining manifest/deck-file references |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `yaml` | 2.9.0 (already installed) [VERIFIED: package.json + pnpm view] | Parse Monaco buffer into a CST/AST with source ranges; `LineCounter` converts byte offsets → line/col | Already a project dependency; only YAML library with first-class lossless CST + source-range API needed for surgical edits |
| `@monaco-editor/react` | 4.7.0 (already installed) [VERIFIED: package.json + pnpm view] | Editor component; exposes the underlying `monaco-editor` instance via `onMount` | Already used by `FileEditorView.tsx` from Phase 28 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | — | All required functionality is covered by existing dependencies (`yaml`, `@monaco-editor/react`, `antd`, React) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `yaml` CST/LineCounter | Regex-based line scanning | Regex is fragile against nested `id:` keys that repeat across decks (D-09 explicitly calls out deck-scoped collision); CST gives exact, unambiguous node ranges |
| `editor.executeEdits()` | `model.setValue(fullNewYaml)` after `YAML.parse`→mutate→`YAML.stringify` | Reserialize loses flow-style formatting (`- [7.0, 10.0]`, `{x: 1, y: 2}`) and comments — explicitly forbidden by D-12 |

**Installation:**
```bash
# No new packages required — yaml and @monaco-editor/react already present
```

**Version verification:** `pnpm view yaml version` → `2.9.0`; `pnpm view @monaco-editor/react version` → `4.7.0`. Both match `package.json` — no upgrade needed.

## Package Legitimacy Audit

No new external packages are introduced by this phase. `yaml` and `@monaco-editor/react`
are pre-existing dependencies already vetted in Phase 28/earlier phases.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
[GM opens deckplan.yaml in FileEditorView]
        │
        ▼
DataFileTree.onSelectFile ──► gmConsoleApi.readDataFile(path)
        │                              │
        │                              ▼
        │                     GET /api/gm/data/{path}  (raw text)
        │                              │
        ▼                              ▼
  setContent(text) ──────────► Monaco <Editor value={content} onChange=...>
        │
        │  isDeckplan(path) === true (filename === 'deckplan.yaml')
        ▼
  parseDocument(content, {lineCounter})   ◄── re-run on every onChange (debounced)
        │
        ├──► decks[] list ──────────► Deck selector (tabs/dropdown), default = first/`default:true`
        │
        ├──► id→range map (deck-scoped: rooms[].id, poi[].id)
        │
        └──► selected deck's rooms/doors/vents/poi  ──► adapt to GridEncounterMapData shape
                     │
                     ▼
        <MapPreview mapData={...} fill isGM ... />
                     │
        ┌────────────┼─────────────────────────────┐
        │            │                              │
   click room/POI   drag POI                  click empty cell
        │            │                              │
        ▼            ▼                              ▼
  look up range  compute new {x,y} grid coords  build POI stub object
  in id→range map      │                              │
        │              ▼                              ▼
        │       find poi.position value range   find/insert poi: list range
        │              │                              │
        ▼              ▼                              ▼
  editor.revealRangeInCenter()   editor.executeEdits()  [{range, text: newYamlFragment}]
  + deltaDecorations(highlight)            │
                                            ▼
                                  onChange fires → setContent(newText)
                                            │
                                            ▼
                                  Ctrl+S / Save button → handleSave()
                                            │
                                            ▼
                          PUT /api/gm/data/{path}  (raw text, unchanged)
                                            │
                                  safe_write_yaml(): yaml.safe_load() validity check
                                  → atomic write → SSE 'data-changed' broadcast
```

### Recommended Project Structure
```
src/components/gm/views/
├── FileEditorView.tsx          # add: isDeckplan(path) branch, preview pane mount
├── FileEditorView.css          # add: split-pane layout (Monaco top, preview bottom)
└── deckplan/                   # NEW folder for editor-specific logic
    ├── useDeckplanModel.ts     # parse buffer → decks[], id→range map, poi ranges (hook)
    ├── deckplanYamlEdits.ts    # pure functions: buildPositionEdit(), buildAddPoiEdit()
    ├── DeckSelector.tsx         # tabs/segmented control over decks[]
    └── DeckplanPreviewPane.tsx  # wraps MapPreview, wires click/drag callbacks to Monaco
```

### Pattern 1: Deck-scoped id→range map via `yaml` CST
**What:** Re-parse the Monaco buffer text with `parseDocument(text, { lineCounter })` on
every change (debounced ~150-300ms). Walk `decks[i].rooms[]`, `decks[i].doors[]`,
`decks[i].poi[]`, and per-room `poi[]` (normalized server-side but may exist in source
YAML too) collecting `{ deckIndex, kind, id, range }` where `range` is the CST node's
`[start, valueEnd, end]` byte-offset triple. Convert to line/col via `lineCounter.linePos()`.

**When to use:** Rebuild this map whenever `content` changes (it already changes on every
keystroke via Monaco's `onChange`). Keep the map in a `ref` to avoid re-render storms;
only the *selected deck's* derived `GridEncounterMapData` needs to trigger a preview
re-render.

**Example:**
```typescript
// Verified working in this session against:
// "decks:\n- id: main\n  rooms:\n  - id: bridge\n    poi:\n    - {icon: airlock, position: {x: 1, y: 2}}\n"
import { parseDocument, LineCounter } from 'yaml';

const lineCounter = new LineCounter();
const doc = parseDocument(yamlText, { lineCounter, keepSourceTokens: true });

const decksSeq = doc.get('decks', true); // YAMLSeq, keepNode
for (const deckNode of decksSeq.items) {
  const roomsSeq = deckNode.get('rooms', true);
  for (const roomNode of roomsSeq.items) {
    const idPair = roomNode.items.find(p => p.key.value === 'id');
    const [start] = idPair.key.range;       // byte offset of `id` key
    const { line, col } = lineCounter.linePos(start); // 1-based line/col

    const poiSeq = roomNode.get('poi', true);
    if (poiSeq) {
      for (const poiNode of poiSeq.items) {
        const posNode = poiNode.get('position', true); // YAMLMap (flow-style ok)
        const [posStart, posValEnd] = posNode.range;
        // posStart..posValEnd covers `{x: 1, y: 2}` exactly
      }
    }
  }
}
```
Source: tested directly against the project's installed `yaml@2.9.0` in this research session.

### Pattern 2: Click-to-jump via Monaco reveal + decoration
**What:** On preview click, look up the clicked room/POI's `id` in the deck-scoped map
(scoped to the *currently selected deck index* to handle id collisions per D-09), get its
line/col, call `editor.revealRangeInCenter(range)` and `editor.deltaDecorations(prevIds, [{range, options: {inlineClassName: 'deckplan-highlight-line', isWholeLine: true}}])`.

**When to use:** EDIT-04. Clear the decoration on next click or after a short timeout.

**Example:**
```typescript
// monaco-editor 0.5x API (stable across @monaco-editor/react 4.x) — [CITED: microsoft/monaco-editor README + typings]
const range = new monaco.Range(line, 1, line, 1);
editor.revealRangeInCenter(range, monaco.editor.ScrollType.Smooth);
const decorationIds = editor.deltaDecorations(prevDecorationIds, [
  {
    range: new monaco.Range(line, 1, line, col + idText.length),
    options: { inlineClassName: 'deckplan-jump-highlight', isWholeLine: false },
  },
]);
```

### Pattern 3: Surgical text patch via `executeEdits`
**What:** For POI drag (EDIT-05), compute the new `{x, y}` grid coordinates from the
preview's pointer event (reuse `getGridCell` from `src/utils/svgCoordinates.ts`, same as
`TokenLayer`'s drag handling). Look up the POI's `position` node range from the id→range
map, then replace **only the inner text** of that flow map with new numbers — preserving
whatever style (`{x: 1, y: 2}` vs multi-line) was already there. Simplest robust approach:
replace the *whole* `position: {...}` value span with a freshly-formatted flow map
`{x: <newX>, y: <newY>}` (acceptable — this is a small, self-contained fragment, not a
full-document reserialize, and matches the existing flow-style convention).

**Example:**
```typescript
// model.applyEdits / editor.executeEdits — [CITED: microsoft/monaco-editor api.d.ts IModel.applyEdits]
const model = editor.getModel();
const range = new monaco.Range(startLine, startCol, endLine, endCol); // from posNode.range via lineCounter
model.applyEdits([
  { range, text: `{x: ${newX}, y: ${newY}}` },
]);
```
For EDIT-06 (click-to-add), if the room's `poi:` key doesn't exist, insert a new
`poi:\n    - {icon: ..., position: {x: .., y: ..}}\n` block as a single-range insertion at
the end of the room's mapping (range = room node's `end` offset, adjusted to land after
the last existing key, before the next sibling room's `id`). If `poi:` already exists,
insert a new sequence item at `poiSeq.range[1]` (end of last item) with correct
indentation matched from the first existing item's column.

### Anti-Patterns to Avoid
- **Full YAML reserialize via `YAML.stringify(doc)`:** Destroys flow-style (`- [7.0, 10.0]`),
  comments, and exact formatting that hand-authored deckplans rely on. D-12 explicitly
  forbids this.
- **Building the id→range map from `yaml.parse()` (plain JS object) instead of
  `parseDocument()` (CST):** `parse()` discards source position info entirely — there is
  no way to recover line numbers from it.
- **Matching `id:` by global regex across the whole file:** breaks under D-09's
  deck-scoped collision requirement (same room id, e.g. `corridor_1`, appears on multiple
  decks).
- **Re-fetching `/api/gm/data/{path}` after every Monaco edit to re-render the preview:**
  The preview must render from the **in-memory Monaco buffer** (`content` state), not a
  re-fetch — otherwise unsaved edits wouldn't show in the preview, defeating the "live"
  requirement (EDIT-02).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML line/column lookup for a parsed node | Custom line-counting via string `.split('\n')` + offset math | `yaml`'s `LineCounter` + CST node `.range` | Already handles multi-line flow collections, block scalars, comments correctly; hand-rolled offset math breaks on edge cases (CRLF, tabs in comments, etc.) |
| SVG pan/zoom/grid-cell hit testing | New coordinate transform code in the preview pane | `src/utils/svgCoordinates.ts` (`screenToSVG`, `getGridCell`, `inverseRotatePoint`) + `MapPreview`'s existing pan/zoom state | Already battle-tested for token drag; POI drag is the same coordinate math |
| Drag-vs-click disambiguation | New pointer-event state machine | `TokenLayer.tsx`'s existing pattern (`pendingDrag` ref + `DRAG_THRESHOLD = 5`, pointerdown/pointerup distance check) | Exact same UX problem (click selects, drag-beyond-threshold moves) already solved for tokens |
| Room polygon hit-testing for click-to-jump | New point-in-polygon code | `pointInPolygon` from `src/utils/polygon2d.ts` (already used by `EncounterMapRenderer` for room-at-cell lookups) | Handles polygon, circle (via bounding check), and rect rooms uniformly |

**Key insight:** This phase is almost entirely *composition* of existing primitives
(`yaml` CST, Monaco model API, `EncounterMapRenderer`'s SVG + drag plumbing,
`getGridCell`). The genuinely new code is the **id→range map builder** and the **edit-range
builder functions** — both are pure, easily-unit-testable functions with no DOM
dependency.

## Runtime State Inventory

> Rename/migration phase (Plan 1: somnus migration + legacy loader removal) — answering all 5 categories.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `data/ships/somnus/map/manifest.yaml` (deck list + hull) and `data/ships/somnus/map/main_deck.yaml` (rooms/doors) are the only files on the legacy format `[VERIFIED: file read]`. No database/SQLite references to these paths — `ActiveView`/`Messages` SQLite tables store `encounter_room_visibility`/`encounter_deck_id` by **room id and deck id strings**, which are preserved 1:1 in the migration (same ids: `engineering`, `main_deck`, etc.) — no data migration needed for SQLite state. | Code edit (write new `deckplan.yaml`), then delete `data/ships/somnus/map/` directory |
| Live service config | None — no external services (n8n, Datadog, etc.) reference `data/ships/somnus/map/` paths. The MCP `find_map_element`/`edit_map_element` tools (Phase 30) operate on `deckplan.yaml` paths already per `docs/schemas/schema-encounters.md` MCP path conventions — somnus is currently the **only** location those tools can't target correctly until migrated. | None beyond the migration itself |
| OS-registered state | None — no Task Scheduler/pm2/systemd entries reference map file paths. | None |
| Secrets/env vars | None — no env vars or SOPS keys reference `somnus`, `map/`, `manifest`, or `deckplan` paths. | None |
| Build artifacts / installed packages | None — `data/` is not packaged; no egg-info/dist artifacts reference these paths. | None |

**Additional finding — stale documentation reference (D-06):** `MEMORY.md` line 86 reads
"Somnus map data: `data/galaxy/tau-ceti/somnus/map/` — working" — this path is **wrong even
today** (actual path is `data/ships/somnus/map/`, confirmed by `ls data/ships/somnus/`).
After migration this entire line should be corrected/removed to reference
`data/ships/somnus/deckplan.yaml`.

### Exact migration mapping (somnus → deckplan.yaml)

Compared `data/ships/somnus/map/manifest.yaml` + `main_deck.yaml` against
`data/ships/patrol_gunboat/deckplan.yaml` (canonical structure):

| Source field | Target field | Notes |
|---|---|---|
| `manifest.yaml: name` | `deckplan.yaml: name` | `"Somnus"` |
| `manifest.yaml: facility_type` | `deckplan.yaml: facility_type` | `"ship"` |
| `manifest.yaml: total_decks` | `deckplan.yaml: total_decks` | `1` |
| `manifest.yaml: hull.polygon` | `deckplan.yaml: hull.polygon` | direct copy, same coordinate convention |
| `manifest.yaml: decks[0].{id,name,level,default}` | `deckplan.yaml: decks[0].{id,name,level,default}` | direct copy (`main_deck`, `"Main Deck"`, `1`, `true`) |
| `main_deck.yaml: unit_size` | `deckplan.yaml: decks[0].unit_size` | `30` |
| `main_deck.yaml: rotation` | `deckplan.yaml: decks[0].rotation` | `90` — `GridEncounterMapData.rotation` supports this per `encounterMap.ts` |
| `main_deck.yaml: rooms` | `deckplan.yaml: decks[0].rooms` | direct copy — already `polygon`-shaped `GridRoom[]`, no field changes needed |
| `main_deck.yaml: doors` | `deckplan.yaml: decks[0].doors` | direct copy — already top-level array of `AuthoredDoor` (B-rel `along` form) |
| `main_deck.yaml: deck_id`, `name` (deck-level display name), `location_name` | dropped / superseded | `deckplan.yaml` deck entries don't carry `deck_id`/`location_name` — those are `EncounterMapData` (legacy single-deck API response) fields, not deckplan source fields. Patrol gunboat's deck entries omit them; loader/payload_builder derive `deck_id` from `deck['id']` at read time. |
| `main_deck.yaml: image_path` (computed at load time, not in source file) | n/a | Not a source field — `load_deck_map` computed it by globbing for `main_deck.png` etc.; **no such image exists for somnus** (not in `ls data/ships/somnus/map/`... only the two yaml files were present), so nothing to migrate. |

**Net result:** the migration is a near-mechanical merge — take `manifest.yaml`'s
top-level `name`/`facility_type`/`total_decks`/`hull`/`decks[0].{id,name,level,default}`,
nest `main_deck.yaml`'s `unit_size`/`rotation`/`rooms`/`doors` under that single deck
entry, write to `data/ships/somnus/deckplan.yaml`, delete `data/ships/somnus/map/`.

### Code removal inventory (D-03)

`[VERIFIED: grep across core/]`

| Site | What | Action |
|---|---|---|
| `core/data_loader.py:427-460` | `load_encounter_manifest()`, `load_deck_map()` | Delete both methods |
| `core/data_loader.py:461-512` | `load_map()` (manifest-first + single-deck-fallback logic) | Delete entirely |
| `core/data_loader.py:350` | `loc['map'] = self.load_map(ship_dir)` in `_inject_ship` (mobile ships + campaign ship) | Remove this line and the three lines that build `has_map`/`maps` from it — OR replace with a deckplan-based equivalent if any downstream code still reads `loc['map']`/`loc['has_map']`/`loc['maps']` (see below) |
| `core/data_loader.py:406` | `location_data['map'] = self.load_map(location_dir)` in `load_location_recursive` | Same as above |
| `core/views/encounter.py:432, 465-475` | `api_encounter_map_data`: deckplan-first + `load_deck_map` fallback branch (lines ~465-475) | Delete the `else: deck_data = loader.load_deck_map(...)` branch; keep the deckplan branch as the only path |
| `core/views/encounter.py:425-461` (the `if not map_data and location.get('directory')` deckplan-fallback block) | Currently a *fallback* because `location.get('map')` is checked first | Once `loc['map']` is removed from data_loader, `location.get('map')` will always be falsy for deckplan locations — **this fallback block becomes the primary path**. Consider restructuring so deckplan lookup is the primary branch, not a fallback, for clarity (not strictly required for correctness but improves readability) |
| `core/views/encounter.py:562` (`api_encounter_all_decks`, old-manifest branch `for deck_info in manifest.get('decks', []): deck_data = loader.load_deck_map(...)`) | Legacy multi-deck-via-manifest path | Delete — the deckplan branch above it (lines ~513-545) already covers all decks |
| `core/views/navigation.py:68-78` | `if location and location.get('map'): ... loader.load_deck_map(location_dir, deck_info['id'])` block for initializing `encounter_room_visibility` | Must be rewritten to use `load_deckplan()` — this is **not dead code**, it's the only remaining caller of `load_deck_map` outside data_loader itself, and somnus currently relies on it. After migration, rewrite to iterate `load_deckplan(location_dir)['decks']` directly (each deck dict already has `rooms` inline — no per-deck file load needed) |

**`loc['map']` / `loc['has_map']` / `loc['maps']` downstream usage** — before deleting,
confirm no other code reads these fields:

```bash
grep -rn "\.get('map')\|\['map'\]\|has_map\|\.get('maps')\|\['maps'\]" core/ src/ --include=*.py --include=*.ts --include=*.tsx
```

This check **must be run during planning/implementation** — research did not exhaustively
trace every consumer (e.g. galaxy tree UI may use `has_map` as a "show map icon" flag for
locations, which would need to become `bool(load_deckplan(dir)['decks'])` instead).

## Common Pitfalls

### Pitfall 1: Deck id/index drift between Monaco buffer and rendered preview
**What goes wrong:** GM edits deck order, adds/removes a deck, or renames a deck `id`
while a different deck is selected in the preview — the selected-deck index may now point
at the wrong deck, or the id the selector remembers no longer exists.
**Why it happens:** Deck selector state is independent of the Monaco buffer's `decks[]`
array; edits can change array length/order at any time.
**How to avoid:** Store the selected deck by `id` (not index). On every re-parse, if the
previously-selected id is missing, fall back to `decks[0]` (or the `default: true` deck).
**Warning signs:** Preview shows blank/error after editing deck order; deck selector tab
highlight doesn't match rendered content.

### Pitfall 2: Parse errors during active typing break the preview
**What goes wrong:** While the GM is mid-edit (e.g., just typed `position: {x: 1, y` and
hasn't closed the brace), `parseDocument()` may throw or return a document with errors,
crashing the preview render.
**Why it happens:** `onChange` fires on every keystroke; YAML is frequently invalid
mid-edit.
**How to avoid:** Wrap parse in try/catch; on parse error, **keep showing the last
successfully-parsed preview** (don't blank it) and skip id→range map rebuild for that
tick. Debounce re-parse by ~150-300ms so transient invalid states during fast typing don't
even trigger a parse attempt.
**Warning signs:** Preview flickers to empty/error state while typing in unrelated parts
of the file.

### Pitfall 3: `id:` collisions across decks break click-to-jump
**What goes wrong:** Room id `corridor_1` exists on both Main Deck and Lower Deck. A naive
global id→range map would map clicks to the wrong deck's `corridor_1`.
**Why it happens:** Deckplan ids are only required to be unique *within* a deck (per
`docs/schemas/schema-encounters.md`: "Unique within this deck").
**How to avoid:** D-09 already specifies "deck-scoped id matching" — key the id→range map
by `(deckIndex or deckId, kind, id)`, and always resolve lookups against the **currently
selected deck**.
**Warning signs:** Clicking a room jumps to a different deck's identically-named room.

### Pitfall 4: Monaco model edits and React `content` state getting out of sync
**What goes wrong:** `editor.executeEdits()` mutates Monaco's internal model directly. If
`onChange` doesn't fire synchronously (or fires with stale closure data), the React
`content` state used for `isDirty`/save and for the preview's next parse can desync from
what's actually in the editor.
**Why it happens:** `@monaco-editor/react`'s `onChange` is wired to the model's
`onDidChangeModelContent` event, which **does** fire for programmatic `executeEdits()` —
but if the id→range map used to compute the edit was built from a *stale* `content`
snapshot (e.g., from before a debounce window), the computed range may be off by however
many characters changed since.
**How to avoid:** Always recompute the id→range map from `editor.getValue()` (the live
model value) immediately before building an edit — not from the debounced React `content`
state. Treat the debounced re-parse as "preview-only"; treat a fresh
`editor.getModel().getValue()` + synchronous re-parse as the source of truth at the moment
of an edit-producing interaction (click/drag-end/click-to-add).
**Warning signs:** POI drag occasionally writes the new position into the wrong line, or
slightly corrupts adjacent YAML, especially after rapid successive edits.

### Pitfall 5: Flow-style POI position assumed but room/poi authored in block style
**What goes wrong:** D-12's flow-style example (`- [7.0, 10.0]`) and the patrol gunboat
doors (`{id: ..., rooms: [...], ...}`) are flow-style, but nothing *guarantees* every POI
`position` will be flow-style — a GM could hand-author `position:\n  x: 1\n  y: 2`
(block-style mapping spanning 2 lines).
**Why it happens:** YAML allows both; the schema doc doesn't mandate flow style for
`position`.
**How to avoid:** The replace-the-whole-`position`-value-span approach (Pattern 3) handles
both cases correctly **as long as the replacement range is the full `position:` *value*
node's range** (from `yaml`'s CST, which spans multi-line block mappings too) and the
replacement text is a single-line flow map `{x: .., y: ..}`. This necessarily *does*
reformat that one field from block→flow if it was authored as block — acceptable (it's a
2-number field), but worth noting as a minor, scoped exception to "never reformat."
**Warning signs:** After a drag, a previously multi-line `position:` block becomes a
single flow-style line — expected/acceptable, but should be called out in UAT so it's not
mistaken for a bug.

### Pitfall 6: `total_decks` field becomes stale after deck add/remove (if GM edits decks list directly)
**What goes wrong:** `deckplan.yaml` doesn't actually have a `total_decks` field at the
top level in the patrol_gunboat example — but `load_deckplan()` *computes* `total_decks`
as `len(decks_sorted)` rather than reading it from the file. However, the somnus
`manifest.yaml` **does** have an authored `total_decks: 1` field at the top level of the
old manifest format.
**Why it happens:** Format drift between legacy manifest (`total_decks` authored) and
deckplan (`total_decks` computed, not authored — confirmed: patrol_gunboat's `deckplan.yaml`
has `total_decks: 1` at top level too, actually — re-check below).
**How to avoid:** Re-reading patrol_gunboat's `deckplan.yaml` line 3: `total_decks: 1` **is
present** at the top level. So `deckplan.yaml` format **does** carry an authored
`total_decks`. For the somnus migration, carry `manifest.yaml`'s `total_decks: 1` forward
as `deckplan.yaml`'s top-level `total_decks: 1`. `load_deckplan()`'s returned dict
recomputes `total_decks` as `len(decks_sorted)` for its *return value* (API response
shape) — but the **source file** should still have the authored field. The editor doesn't
need to maintain this field for v1 (POI add/move don't touch deck count), but should not
be surprised that `load_deckplan()`'s in-memory return value's `total_decks` may differ
from the YAML source's authored value if they ever drift (low risk for this phase).
**Warning signs:** N/A for this phase — flagged for completeness, not expected to surface
in EDIT-01..06.

## Code Examples

### Detecting a deckplan file (D-07's "detect by filename")
```typescript
// New helper, alongside getLanguage()/isImage() in FileEditorView.tsx
function isDeckplan(path: string): boolean {
  return path.split('/').pop() === 'deckplan.yaml';
}
```

### Adapting deckplan deck → GridEncounterMapData for MapPreview
```typescript
// MapPreview expects GridEncounterMapData: { name, unit_size, hull?, rooms, doors?, vents?, poi? }
// A parsed deckplan deck (plain JS object from yaml.parse, NOT the CST doc) already has
// rooms/doors/vents/poi inline — shape matches GridEncounterMapData closely.
import { parse as parseYaml } from 'yaml';

function deckToMapData(deckplan: any, deckId: string): GridEncounterMapData | null {
  const deck = deckplan.decks?.find((d: any) => d.id === deckId);
  if (!deck) return null;
  return {
    name: deck.name ?? deckplan.name,
    unit_size: deck.unit_size ?? 40,
    rotation: deck.rotation,
    hull: deck.hull ?? deckplan.hull, // per HULL-01 (future phase) decks may override hull; deckplan-level hull is the v1 fallback
    rooms: deck.rooms ?? [],
    doors: deck.doors ?? [],
    vents: deck.vents ?? [],
    poi: deck.poi ?? [],
  };
}
```

### Click-to-jump handler wiring (EDIT-04)
```typescript
// onRoomToggle is MapPreview's existing room-click callback (currently used for
// reveal/hide toggling in the GM encounter view). For the editor, repurpose/extend
// with a dedicated callback that does NOT toggle visibility — just jumps.
<MapPreview
  mapData={selectedDeckMapData}
  roomVisibility={{}}            // editor doesn't track runtime visibility
  isGM={true}
  fill={true}
  onRoomToggle={(roomId) => jumpToElement('room', roomId)}
  // POI click: MapPreview/EncounterMapRenderer's renderPoi already attaches onClick
  // for the hover popover — needs a new prop e.g. onPoiClick={(poiId) => jumpToElement('poi', poiId)}
/>
```
**Gap identified:** `MapPreview`/`EncounterMapRenderer` currently has **no POI click
callback** — `renderPoi` opens a hover popover but doesn't expose `onPoiClick` to the
parent. This is new prop-plumbing required for EDIT-04 (POI half) and EDIT-05/06 (drag/add
need POI-aware pointer handlers analogous to `TokenLayer`'s).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `map/manifest.yaml` + per-deck `map/*.yaml` files | Single `deckplan.yaml` with inline `decks[].rooms/doors/vents/poi` | Introduced in an earlier v2.0 phase (Phase 21 per code comments); `load_deckplan()` already exists and is the primary path for `patrol_gunboat` | Somnus is the last holdout; this phase finishes the migration and removes the now-dead old code paths |
| Nested `GridRoom.doors[]` | Top-level `doors: AuthoredDoor[]` per deck | Phase 21-04 (per `encounterMap.ts` comments) | Already fully migrated; not a concern for this phase but confirms the file format conventions to follow for the somnus migration |

**Deprecated/outdated:**
- `load_map`, `load_encounter_manifest`, `load_deck_map` in `core/data_loader.py`:
  superseded by `load_deckplan()`; this phase removes them (D-03).
- `map/manifest.yaml` + per-deck files: superseded by `deckplan.yaml`; somnus is the last
  location on this format (D-04).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `monaco-editor`'s `revealRangeInCenter`, `deltaDecorations`, and model `applyEdits`/`executeEdits` APIs are stable and available via the instance returned by `@monaco-editor/react`'s `onMount` — based on training knowledge of monaco-editor's long-stable public API, not re-verified against monaco-editor 0.5x changelog in this session | Code Examples / Pattern 2-3 | Low — these are among the oldest, most-used monaco-editor APIs (pre-1.0 stable surface); even if exact method names shifted slightly, `editor.getModel()` always exposes `pushEditOperations`/`applyEdits` as a fallback |
| A2 | `parseDocument`'s CST `.range` triples remain stable/correct for nested flow-style maps inside block sequences across all realistic deckplan YAML shapes (only tested one synthetic example in this session, matching the project's actual flow-style POI convention) | Pattern 1, Pattern 3 | Medium — if a more complex real deckplan (e.g., POI with `description:` containing special characters, or multi-line block scalars) produces different range behavior, the edit-range computation could be off; recommend a unit test with a real deckplan fixture (e.g. patrol_gunboat's doors array) during implementation |
| A3 | No code outside `core/data_loader.py`/`core/views/encounter.py`/`core/views/navigation.py` reads `location['map']` / `location['has_map']` / `location['maps']` — research grepped but did not exhaustively trace every frontend consumer | Runtime State Inventory | Medium — if e.g. the galaxy tree UI uses `has_map` as an icon-display flag, removing `loc['map']` without a replacement would silently hide map icons for ship locations; planner must run the suggested grep before deleting |

## Open Questions

1. **Does the galaxy/location tree UI (or any frontend component) consume `has_map` /
   `maps` from the location payload?**
   - What we know: `core/data_loader.py` sets `loc['has_map']` and `loc['maps']` from
     `load_map()` for every ship/location.
   - What's unclear: Whether `src/` components branch on these fields (e.g., to show a
     "has deckplan" icon in a location list).
   - Recommendation: Run `grep -rn "has_map\|\.maps\b" src/ core/` during Plan 1 planning;
     if found, replace with a `load_deckplan(dir)['decks'].length > 0` check computed
     alongside the existing `loc['map']` removal, exposed as a new boolean field with a
     clear name (e.g. `has_deckplan`).

2. **Exact POI-click and POI-drag prop API for `MapPreview`/`EncounterMapRenderer`**
   - What we know: `renderPoi` exists and renders POIs with hover popovers; `TokenLayer`
     has a complete drag implementation that could serve as a template.
   - What's unclear: Whether the planner should add a parallel `PoiLayer`-style component,
     or extend `renderPoi`'s inline handlers directly with new props
     (`onPoiClick`, `onPoiMove`, `onEmptyCellClick`) threaded through `MapPreview` →
     `EncounterMapRenderer`.
   - Recommendation: Given D-14 scopes this to "POIs (place/move) + rooms (click-to-jump
     only)" and the existing `TokenLayer` pattern is well-isolated, a sibling
     `PoiEditLayer` (editor-only, gated by an `editable` prop on `MapPreview`) mirroring
     `TokenLayer`'s pointer-event/threshold logic is likely cleanest — but this is an
     implementation-detail decision for the planner, not a research blocker.

3. **Where exactly does the new `poi:` list get inserted for click-to-add (EDIT-06) when
   the room has no existing `poi:` key, in terms of YAML indentation matching?**
   - What we know: `yaml`'s CST gives the room mapping node's range and its existing keys'
     indentation (via each key's `range`/column).
   - What's unclear: The exact insertion-point algorithm (insert after last existing key
     of the room, before the next sibling room's `id:` — need to find the room node's
     `end` offset and back up past any trailing whitespace/newline to avoid swallowing the
     next room's leading `- `).
   - Recommendation: This is implementation detail suitable for the planner to scope as a
     task with a unit test against a real deckplan fixture (e.g., add a `poi:` to
     `cargo_bay` in patrol_gunboat's deckplan, which currently has no `poi:` anywhere).

## Environment Availability

This phase has no new external service/tool dependencies — `yaml` and
`@monaco-editor/react` are already installed (`pnpm view` confirms current versions match
`package.json`). No environment audit needed beyond the existing dev toolchain (`pnpm`,
Vite, Django dev server) already used by Phase 28.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No frontend test runner detected in `package.json` (no `vitest`/`jest` script) [VERIFIED: package.json scripts section contains only `dev`, `build`, `typecheck`, lint] |
| Config file | none — see Wave 0 |
| Quick run command | `pnpm run typecheck` (TypeScript compiler — fastest available signal) |
| Full suite command | `pnpm run typecheck && pnpm run build` (build-time validation of all imports/types) |

Backend: Django has its standard test runner available (`python manage.py test`), but no
existing test files were found under `core/` in this research pass for `data_loader.py`
or `views/encounter.py` — confirm during planning with `find core -path '*test*'`.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EDIT-01 | All locations (incl. somnus) load via `load_deckplan()`; legacy loaders removed | unit/integration | `python manage.py test core.tests.test_data_loader` (or equivalent) | ❌ Wave 0 — no `core/tests/` for data_loader found |
| EDIT-02 | Preview renders below Monaco when `deckplan.yaml` is open | manual / smoke | manual UAT (visual) | ❌ Wave 0 — no frontend test runner |
| EDIT-03 | Deck selector switches rendered deck | manual / smoke | manual UAT | ❌ Wave 0 |
| EDIT-04 | Click room/POI → Monaco reveals+highlights correct line | unit (id→range map) + manual (E2E) | unit test for `buildIdRangeMap()` against fixture YAML | ❌ Wave 0 — needs new test file + fixture |
| EDIT-05 | Drag POI → surgical `position` patch | unit (edit-range builder) + manual | unit test for `buildPositionEdit()` against fixture YAML | ❌ Wave 0 |
| EDIT-06 | Click empty cell → POI stub inserted into `poi:` | unit (edit-range builder) + manual | unit test for `buildAddPoiEdit()` against fixture YAML | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm run typecheck`
- **Per wave merge:** `pnpm run typecheck && pnpm run build`; for Plan 1, also
  `python manage.py test` (if/once backend tests exist) plus a manual check that
  `/api/encounter-map/<somnus-slug>/` and `/api/encounter-map/<somnus-slug>/all-decks/`
  return non-error JSON after migration.
- **Phase gate:** Full suite green + manual UAT walkthrough of EDIT-02..06 before
  `/gsd:verify-work` (this phase has no automated frontend test runner, so UAT carries
  significant weight per D-09/D-12's behavioral requirements).

### Wave 0 Gaps
- [ ] Decide whether to introduce a lightweight unit-test runner (e.g. `vitest`, which
      pairs naturally with Vite — `[ASSUMED]` it isn't installed; confirm with
      `pnpm ls vitest`) for the new pure functions (`buildIdRangeMap`,
      `buildPositionEdit`, `buildAddPoiEdit`). These are prime candidates for fast unit
      tests since they're pure string/CST functions with no DOM dependency.
- [ ] `core/tests/test_data_loader.py` (or wherever Django tests live) — covers EDIT-01
      (load_deckplan path for somnus post-migration, absence of legacy methods)
- [ ] Fixture file: a small representative `deckplan.yaml` (e.g., a 2-room, 1-POI excerpt
      from patrol_gunboat) for frontend unit tests of the id→range and edit-builder
      functions
- [ ] Framework install (if pursuing unit tests): `pnpm add -D vitest` — confirm package
      name and current version via `pnpm view vitest version` before adding

*(If the team decides UAT-only validation is sufficient for this phase, given no existing
frontend test runner, that is a valid and consistent choice — but should be an explicit
decision recorded by the planner, not a silent gap.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | GM Console endpoints are intentionally unauthenticated per existing trust-network model (D-09 of Phase 23/28 lineage) — out of scope for this phase, not re-litigated |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a — no new endpoints introduced (D-15: reuse existing `PUT /api/gm/data/{path}`) |
| V5 Input Validation | yes | `safe_write_yaml()` already validates `.yaml`/`.yml` content via `yaml.safe_load()` before atomic write — surgical edits still flow through this same validation on save, so a malformed edit (e.g., broken bracket) is caught at save time and rejected with a 400, not silently written |
| V6 Cryptography | no | n/a |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via crafted `filepath` to `PUT /api/gm/data/{path}` | Tampering | Already mitigated — `target.is_relative_to(data_root)` guard in `gm_data.py`, unchanged by this phase |
| YAML injection producing unexpected document structure via surgical edit producing invalid/dangerous YAML (e.g., anchors/aliases `&`/`*`, tags `!!python/object`) | Tampering | `yaml.safe_load()` (used by `safe_write_yaml` for validation, and by `load_deckplan`/`parseDocument` defaults) refuses Python-object tags by default — `[VERIFIED: yaml.safe_load and yaml package's parseDocument do not execute arbitrary tags]`. Surgical edits only insert numeric/string literals into `position`/`poi` fragments — no user-controlled YAML tag syntax is constructible through the UI (POI stub fields are fixed templates with GM-chosen `x`/`y` numbers) |
| Frontend XSS via POI `label`/`description`/`icon` fields rendered in hover popovers | Tampering/Information Disclosure | Pre-existing concern, not introduced by this phase — `EncounterMapRenderer`'s `renderPoi` already renders these fields; React's default JSX escaping applies. New click-to-add stub should default to a safe placeholder string (e.g. `"New POI"`) requiring no special handling |

## Sources

### Primary (HIGH confidence)
- `package.json` — confirms `yaml@^2.9.0` and `@monaco-editor/react@^4.7.0` already installed
- `pnpm view yaml version` / `pnpm view @monaco-editor/react version` — confirms `2.9.0` / `4.7.0` resolve on the registry, matching installed versions
- Direct Node execution against installed `yaml@2.9.0` (`parseDocument` + `LineCounter` + CST `.range`) — verified id-key and flow-style `position` range extraction works exactly as needed, including for nested `decks[].rooms[].poi[].position` paths
- `core/data_loader.py`, `core/views/encounter.py`, `core/views/navigation.py` — read in full for relevant sections; confirmed exact line ranges and call-site behavior for D-03 removal targets
- `data/ships/patrol_gunboat/deckplan.yaml`, `data/ships/somnus/map/manifest.yaml`, `data/ships/somnus/map/main_deck.yaml` — read in full; basis for the migration mapping table
- `docs/schemas/schema-encounters.md` — current canonical schema doc; already deckplan-centric, minor edits needed
- `src/components/gm/views/FileEditorView.tsx`, `FileEditorView.css`, `src/components/gm/MapPreview.tsx`, `src/types/encounterMap.ts`, `src/utils/svgCoordinates.ts`, `src/components/domain/encounter/EncounterMapRenderer.tsx`, `TokenLayer.tsx` — read for reuse patterns

### Secondary (MEDIUM confidence)
- Monaco editor API names (`revealRangeInCenter`, `deltaDecorations`, `executeEdits`, `applyEdits`) — based on training knowledge of monaco-editor's long-stable public surface; not re-verified against current monaco-editor docs in this session (see Assumption A1)

### Tertiary (LOW confidence)
- none

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both libraries already installed and version-verified; no new dependencies
- Architecture: HIGH — built entirely on read/verified existing components (`FileEditorView`, `MapPreview`, `EncounterMapRenderer`, `TokenLayer`) plus a directly-tested `yaml` CST pattern
- Pitfalls: HIGH for Plan 1 (exact line-level code inventory done); MEDIUM for Plan 2+ edge cases (Pitfall 2/4/5 are reasoned from API semantics, not exhaustively tested against every YAML shape)

**Research date:** 2026-06-13
**Valid until:** 30 days (stable internal codebase + stable, long-unchanged third-party APIs — low churn risk)
