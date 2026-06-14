# Phase 29: Interactive Deckplan Map Editor - Pattern Map

**Mapped:** 2026-06-13
**Files analyzed:** 13
**Analogs found:** 11 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `core/data_loader.py` (remove `load_map`/`load_encounter_manifest`/`load_deck_map`, `loc['map']`/`has_map`/`maps`) | model/loader | CRUD (file I/O) | same file, `load_deckplan()` (lines 767-792) | exact (in-file refactor) |
| `core/views/encounter.py` (remove legacy fallback branches) | controller/route | request-response | same file, deckplan-first branch (lines ~432-461, 513-545) | exact (in-file refactor) |
| `core/views/navigation.py` (rewrite `load_deck_map` caller at lines 68-80) | controller/route | event-driven (view-switch side effect) | same file, deckplan-equivalent loop pattern in `api_encounter_all_decks` (encounter.py ~513-545) | role-match |
| `data/ships/somnus/deckplan.yaml` (new, migrated) | config/data | file-I/O (static data) | `data/ships/patrol_gunboat/deckplan.yaml` | exact |
| `docs/schemas/schema-encounters.md` (edit) | config/docs | file-I/O | same file (existing deckplan sections) | exact |
| `src/components/gm/views/FileEditorView.tsx` (add `isDeckplan()` branch + preview mount) | component/view | request-response + streaming (SSE save) | same file (Phase 28 base) | exact |
| `src/components/gm/views/FileEditorView.css` (add split-pane layout) | config/style | n/a | same file | exact |
| `src/components/gm/views/deckplan/useDeckplanModel.ts` (new hook) | hook | transform (YAML parse → id/range map) | `src/utils/svgCoordinates.ts` (pure transform utils) + `yaml` CST per RESEARCH Pattern 1 | partial (new pattern, composes existing utils) |
| `src/components/gm/views/deckplan/deckplanYamlEdits.ts` (new) | utility | transform (pure edit-builders) | `src/utils/svgCoordinates.ts` (pure function module style) | role-match |
| `src/components/gm/views/deckplan/DeckSelector.tsx` (new) | component | request-response (local UI state) | `src/components/gm/views/FileEditorView.tsx` breadcrumb/toolbar (tab-like UI) | partial |
| `src/components/gm/views/deckplan/DeckplanPreviewPane.tsx` (new) | component | event-driven (click/drag → Monaco edits) | `src/components/gm/MapPreview.tsx` | exact |
| `src/components/domain/encounter/EncounterMapRenderer.tsx` (add `onPoiClick`/editable POI layer props) | component | event-driven | same file, `renderPoi` (lines 934-1000) + `TokenLayer.tsx` (drag pattern) | exact |
| `src/types/encounterMap.ts` (no new types expected; reuse `PoiData`, `GridEncounterMapData`) | model/types | n/a | same file | exact |

## Pattern Assignments

### `src/components/gm/views/FileEditorView.tsx` (component, request-response + SSE save)

**Analog:** itself (Phase 28 base) — extend in place.

**Imports pattern** (lines 1-12):
```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { Button, Tooltip } from 'antd';
import {
  SaveOutlined,
  FolderOpenOutlined,
  FileOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { DataFileTree } from '../DataFileTree';
import { gmConsoleApi } from '@/services/gmConsoleApi';
import './FileEditorView.css';
```
New imports needed: `MapPreview` (or new `DeckplanPreviewPane`), `parseDocument`/`LineCounter` from `yaml`, and a new `isDeckplan()` helper alongside `getLanguage()`/`isImage()`.

**File-type detection pattern** (lines 19-32) — add `isDeckplan` the same way:
```typescript
function getLanguage(path: string): 'yaml' | 'markdown' | 'plaintext' {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (ext === 'yaml' || ext === 'yml') return 'yaml';
  if (ext === 'md') return 'markdown';
  return 'plaintext';
}

function isImage(path: string): boolean {
  return IMAGE_EXTENSIONS.some(e => path.toLowerCase().endsWith(e));
}
```
Per RESEARCH Code Examples — add:
```typescript
function isDeckplan(path: string): boolean {
  return path.split('/').pop() === 'deckplan.yaml';
}
```

**Editor mount + Ctrl+S command pattern** (lines 105-110) — reuse `editorRef`/`onEditorMount` to get the live `editor`/`monaco` instances needed for `revealRangeInCenter`/`deltaDecorations`/`executeEdits`:
```typescript
const onEditorMount = useCallback<OnMount>((editorInstance, monaco) => {
  editorRef.current = editorInstance;
  editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    handleSaveRef.current?.();
  });
}, []);
```

**Monaco render block** (lines 196-218) — the preview pane mounts as a sibling below this, gated by `isDeckplan(selectedPath) && fileLanguage === 'yaml'`:
```typescript
return (
  <div className="gm-file-editor-view__monaco">
    <Editor
      theme="vs-dark"
      language={fileLanguage}
      value={content}
      onChange={(val) => { if (!isReadOnly) setContent(val ?? ''); }}
      onMount={onEditorMount}
      options={{ minimap: { enabled: false }, scrollBeyondLastLine: false, ... }}
      height="100%"
      width="100%"
    />
  </div>
);
```

**Save pattern (unchanged, D-15)** (lines 48-72) — surgical edits flow through `content` state exactly like manual typing; no new save path:
```typescript
const handleSave = useCallback(async () => {
  if (!selectedPath) return;
  if (getLanguage(selectedPath) === 'plaintext') return;
  if (!isDirty || isSaving) return;
  setIsSaving(true);
  try {
    await gmConsoleApi.writeDataFile(selectedPath, content);
    setErrorMessage(null);
    setSavedContent(content);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 150);
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: { detail?: string; error?: string } } };
    const msg = axiosErr.response?.data?.detail || axiosErr.response?.data?.error || 'Save failed';
    setErrorMessage(msg);
    ...
  } finally {
    setIsSaving(false);
  }
}, [selectedPath, content, isDirty, isSaving]);
```

**Error banner pattern** (lines 257-270) — reuse exact styling for the "MAP SYNC ERROR" message from the UI spec:
```typescript
{errorMessage && (
  <div className="gm-file-editor-view__error-banner">
    <ExclamationCircleOutlined style={{ fontSize: 16, color: '#c0392b', flexShrink: 0, marginTop: 2 }} />
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#c0392b', letterSpacing: '1px', fontFamily: MONOSPACE_FONT }}>
        VALIDATION ERROR
      </div>
      <div style={{ fontSize: 12, color: '#7ab8b8', fontFamily: MONOSPACE_FONT, marginTop: 2 }}>
        {errorMessage}
      </div>
    </div>
  </div>
)}
```

---

### `src/components/gm/views/FileEditorView.css` (style)

**Analog:** itself.

**Layout pattern to extend** (lines 19-25, 50-53):
```css
.gm-file-editor-view__editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.gm-file-editor-view__monaco {
  flex: 1;
  overflow: hidden;
}
```
New rules needed (per UI-SPEC layout contract, 60/40 split, resizable):
- `.gm-file-editor-view__monaco` becomes `flex: 0 0 60%` (or computed from a stored ratio in `localStorage`, same `LS_KEY`-style persistence as line 17 `LS_KEY = 'janus_file_editor_last_path'`).
- New `.gm-file-editor-view__preview-pane` (`flex: 0 0 40%`, `background: #080e0e`, `border-top: 1px solid #1e3333`).
- New `.gm-file-editor-view__resize-handle` (4px visual, 44px hit target, per spacing exceptions).
- New `.gm-file-editor-view__deck-tabs` (height 32px, `background: #0d1616`, `border-bottom: 1px solid #1e3333`).

**Error banner pattern to reuse for empty-state** (lines 55-63):
```css
.gm-file-editor-view__error-banner {
  padding: 8px 16px;
  background: rgba(192, 57, 43, 0.12);
  border-bottom: 1px solid #8b2020;
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
```
"NO PREVIEW AVAILABLE" empty state should reuse `.gm-file-editor-view__empty-state` (lines 65-73) styling/structure.

---

### `src/components/gm/views/deckplan/DeckplanPreviewPane.tsx` (component, event-driven)

**Analog:** `src/components/gm/MapPreview.tsx`

**Imports pattern** (lines 8-29):
```typescript
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import '@/components/domain/encounter/EncounterMapRenderer.css';
import type {
  GridEncounterMapData,
  PoiData,
} from '@/types/encounterMap';
import { isGridEncounterMap } from '@/types/encounterMap';
import { EncounterMapRenderer } from '@/components/domain/encounter/EncounterMapRenderer';
import { getGridCell } from '@/utils/svgCoordinates';
```

**Grid-map sizing/fill pattern** (lines 140-207) — reuse the `fill` outer/inner-div wrapper exactly, mount `EncounterMapRenderer` with `fill={true}`, `isGM={true}`, `roomVisibility={{}}`:
```typescript
const outerStyle: React.CSSProperties = fill
  ? { position: 'absolute', inset: 0, overflow: 'hidden' }
  : { position: 'relative', aspectRatio: `${naturalW} / ${naturalH}`, minHeight: 550, overflow: 'hidden', border: '1px solid #303030' };

return (
  <div style={outerStyle}>
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      background: '#0a0a0a',
    }}>
      <EncounterMapRenderer
        mapData={gridMap}
        hull={effectiveHull}
        roomVisibility={{}}
        isGM={true}
        onRoomToggle={(roomId) => jumpToElement('room', roomId)}
        onPoiClick={(poiId) => jumpToElement('poi', poiId)}     // NEW prop — see gap below
        onPoiMove={(poiId, x, y) => buildPositionEdit(...)}     // NEW prop
        onEmptyCellClick={(x, y) => buildAddPoiEdit(...)}       // NEW prop
      />
    </div>
  </div>
);
```

**Click-to-jump prop wiring** (RESEARCH Code Examples, "Click-to-jump handler wiring"):
```typescript
<MapPreview
  mapData={selectedDeckMapData}
  roomVisibility={{}}
  isGM={true}
  fill={true}
  onRoomToggle={(roomId) => jumpToElement('room', roomId)}
/>
```
**Gap:** `MapPreview`/`EncounterMapRenderer` has no `onPoiClick`/`onPoiMove`/`onEmptyCellClick` — these are new props to add (see EncounterMapRenderer section below).

---

### `src/components/domain/encounter/EncounterMapRenderer.tsx` (component, event-driven — add editor props)

**Analog:** itself, `renderPoi` (lines 934-1000) + `TokenLayer.tsx` drag pattern.

**Existing POI render/hover pattern** (lines 937-999) — extend `onClick`/add a new `onPoiClick` callback prop, and add pointer-down drag-start wiring analogous to `TokenLayer`:
```typescript
const renderPoi = (poi: PoiData) => {
  if (!isGM && !isRoomVisible(poi.room)) return null;
  const center = view.project({ gx: poi.position.x, gy: poi.position.y });
  ...
  return (
    <g
      key={poi.id}
      className={`encounter-map__poi encounter-map__poi--${poi.type}`}
      opacity={opacity}
      style={{ color: poiColor, cursor: 'pointer' }}
      onMouseEnter={handlePoiHover}
      onMouseLeave={() => closePopover()}
      onClick={handlePoiHover}
    >
      ...
    </g>
  );
};
```
**Editor-mode addition** (new prop `editable?: boolean`, `onPoiClick?`, `onPoiMove?`):
- On click (non-drag), call `onPoiClick?.(poi.id)` instead of / in addition to the hover popover when `editable`.
- Wrap with `onPointerDown` using the exact `pendingDrag`/`DRAG_THRESHOLD = 5` pattern from `TokenLayer.tsx` (lines 90-91, 189-268) — a sibling `PoiEditLayer` component is the cleanest approach (RESEARCH Open Question 2 recommendation).

**Drag threshold + ghost pattern to copy** (`TokenLayer.tsx` lines 90-91, 189-268):
```typescript
const pendingDrag = useRef<{ id: string; startX: number; startY: number } | null>(null);
const DRAG_THRESHOLD = 5;

const handlePointerMove = useCallback((clientX: number, clientY: number) => {
  if (pendingDrag.current && !isDraggingRef.current) {
    const dx = clientX - pendingDrag.current.startX;
    const dy = clientY - pendingDrag.current.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= DRAG_THRESHOLD) {
      // ... transition to active drag
    }
    return;
  }
  if (!isDraggingRef.current || !dragTokenIdRef.current || !svgElementRef.current) return;
  const svgCoords = screenToSVG(svgElementRef.current, clientX, clientY);
  const unrotated = inverseRotatePoint(svgCoords.x, svgCoords.y, mapRotationRef.current, mapCenterXRef.current, mapCenterYRef.current);
  const snapped = snapToGrid(unrotated.x, unrotated.y, unitSizeRef.current);
  ghostPositionRef.current = snapped;
  setGhostPosition(snapped);
}, []);
```
For POI editor drag: on pointer-up, call `onPoiMove?.(poiId, ghost.gridX, ghost.gridY)` instead of `onTokenMove`. Recolor the ghost/outline to amber `#c9a050` per UI-SPEC (vs. token mode's current color).

**Coordinate utilities** (`src/utils/svgCoordinates.ts`, full file, 151 lines) — reuse directly, no changes:
```typescript
export function screenToSVG(svgElement, screenX, screenY): { x: number; y: number }
export function snapToGrid(svgX, svgY, unitSize): { gridX: number; gridY: number }
export function getGridCell(svgElement, screenX, screenY, unitSize, mapRotation, mapCenterX, mapCenterY): { gridX: number; gridY: number }
```

---

### `src/components/gm/views/deckplan/useDeckplanModel.ts` (hook, transform)

**Analog:** RESEARCH Pattern 1 (`yaml` CST) + `src/utils/svgCoordinates.ts` (pure-function module style, no analog file does this exact thing yet — genuinely new).

**CST id→range map pattern** (RESEARCH lines 161-189, verified working against `yaml@2.9.0`):
```typescript
import { parseDocument, LineCounter } from 'yaml';

const lineCounter = new LineCounter();
const doc = parseDocument(yamlText, { lineCounter, keepSourceTokens: true });

const decksSeq = doc.get('decks', true); // YAMLSeq, keepNode
for (const deckNode of decksSeq.items) {
  const roomsSeq = deckNode.get('rooms', true);
  for (const roomNode of roomsSeq.items) {
    const idPair = roomNode.items.find(p => p.key.value === 'id');
    const [start] = idPair.key.range;
    const { line, col } = lineCounter.linePos(start);

    const poiSeq = roomNode.get('poi', true);
    if (poiSeq) {
      for (const poiNode of poiSeq.items) {
        const posNode = poiNode.get('position', true);
        const [posStart, posValEnd] = posNode.range;
      }
    }
  }
}
```

**Adapter pattern (deck → MapPreview shape)** (RESEARCH Code Examples):
```typescript
import { parse as parseYaml } from 'yaml';

function deckToMapData(deckplan: any, deckId: string): GridEncounterMapData | null {
  const deck = deckplan.decks?.find((d: any) => d.id === deckId);
  if (!deck) return null;
  return {
    name: deck.name ?? deckplan.name,
    unit_size: deck.unit_size ?? 40,
    rotation: deck.rotation,
    hull: deck.hull ?? deckplan.hull,
    rooms: deck.rooms ?? [],
    doors: deck.doors ?? [],
    vents: deck.vents ?? [],
    poi: deck.poi ?? [],
  };
}
```

**Error resilience pattern (Pitfall 2)** — wrap in try/catch, debounce ~200ms, keep last good parse:
```typescript
let lastGoodModel: DeckplanModel | null = null;
try {
  const doc = parseDocument(text, { lineCounter });
  if (doc.errors.length === 0) {
    lastGoodModel = buildModel(doc, lineCounter);
  }
} catch {
  // keep lastGoodModel
}
```

---

### `src/components/gm/views/deckplan/deckplanYamlEdits.ts` (utility, transform — pure functions)

**Analog:** `src/utils/svgCoordinates.ts` (pure-function module pattern: no React, exported named functions, JSDoc per function) + RESEARCH Pattern 3.

**Module style to copy** (`src/utils/svgCoordinates.ts` lines 1-7, 67-76):
```typescript
/**
 * SVG Coordinate Transform Utilities
 *
 * Provides functions for converting between screen coordinates (mouse/touch events)
 * and SVG coordinate space, accounting for viewBox scaling, pan, and zoom.
 */

export function snapToGrid(
  svgX: number,
  svgY: number,
  unitSize: number
): { gridX: number; gridY: number } {
  return {
    gridX: Math.floor(svgX / unitSize),
    gridY: Math.floor(svgY / unitSize),
  };
}
```

**Surgical position-patch pattern** (RESEARCH Pattern 3, lines 211-229):
```typescript
// model.applyEdits / editor.executeEdits
const model = editor.getModel();
const range = new monaco.Range(startLine, startCol, endLine, endCol); // from posNode.range via lineCounter
model.applyEdits([
  { range, text: `{x: ${newX}, y: ${newY}}` },
]);
```

**Click-to-jump decoration pattern** (RESEARCH Pattern 2, lines 199-209):
```typescript
const range = new monaco.Range(line, 1, line, 1);
editor.revealRangeInCenter(range, monaco.editor.ScrollType.Smooth);
const decorationIds = editor.deltaDecorations(prevDecorationIds, [
  {
    range: new monaco.Range(line, 1, line, col + idText.length),
    options: { inlineClassName: 'deckplan-jump-highlight', isWholeLine: false },
  },
]);
```
Per UI-SPEC, highlight uses `background: rgba(201, 160, 80, 0.18)` + `border-left: 2px solid #c9a050`, `isWholeLine: true`, persists until next jump (no auto-clear timer) — define `.deckplan-jump-highlight` in `FileEditorView.css`.

---

### `src/components/gm/views/deckplan/DeckSelector.tsx` (component, request-response/local-state)

**Analog:** No direct tab-strip analog in `gm/` components; closest is the breadcrumb/toolbar pattern in `FileEditorView.tsx` (lines 230-255) for styling conventions (monospace, letter-spacing, color tokens) — Ant Design `Tabs type="card"` per UI-SPEC discretion.

**Styling convention to copy** (`FileEditorView.tsx` lines 230-255, SAVE button):
```typescript
<Button
  size="small"
  style={{
    borderColor: saveFlash ? '#2a5a2a' : (isDirty ? '#c9a050' : '#4a8b8b'),
    color: saveFlash ? '#2a5a2a' : (isDirty ? '#c9a050' : '#4a8b8b'),
    letterSpacing: '1px',
    fontFamily: MONOSPACE_FONT,
  }}
>
  SAVE
</Button>
```
Apply same amber/teal active/inactive convention to deck tabs (active: `#c9a050` text + 2px amber bottom-border; inactive: `#4a7070` text, hover `#7ab8b8`), 11px/600/uppercase/1px letter-spacing (Label role).

**Selection persistence pattern (Pitfall 1)** — key by deck `id`, fall back to `default: true` deck or `decks[0]`:
```typescript
const selectedDeckId = useMemo(() => {
  if (decks.some(d => d.id === prevSelectedId)) return prevSelectedId;
  return decks.find(d => d.default)?.id ?? decks[0]?.id;
}, [decks, prevSelectedId]);
```

---

## Backend Pattern Assignments (Plan 1 — legacy removal)

### `core/data_loader.py`

**Analog:** itself — `load_deckplan()` (lines 767-792) is the target shape; delete `load_encounter_manifest`/`load_deck_map`/`load_map` (lines 427-512).

**Canonical loader to keep as-is**:
```python
def load_deckplan(self, location_dir) -> Dict[str, Any]:
    """Load deckplan.yaml from a location directory.
    ...
    """
    deckplan_path = Path(location_dir) / 'deckplan.yaml'
    if not deckplan_path.exists():
        return {'decks': [], 'hull': None, 'total_decks': 0}
    with open(deckplan_path) as f:
        data = yaml.safe_load(f)
    decks = data.get('decks', [])
    decks_sorted = sorted(decks, key=lambda d: d.get('level', 0))
    hull = data.get('hull', None)
    return {'decks': decks_sorted, 'hull': hull, 'total_decks': len(decks_sorted)}
```

**Sites to remove/replace** (lines 350-352, 406-412):
```python
loc['map'] = self.load_map(ship_dir)
loc['has_map'] = loc['map'] is not None
loc['maps'] = [loc['map']] if loc['map'] else []
```
Replace with a `has_deckplan` boolean computed via `load_deckplan(dir)['decks']`:
```python
deckplan = self.load_deckplan(ship_dir)
loc['has_deckplan'] = len(deckplan['decks']) > 0
```
(Confirm via `grep -rn "has_map\|\.get('maps')\|\['maps'\]" core/ src/` whether any frontend consumes `has_map`/`maps` before removing — RESEARCH Open Question 1 / Assumption A3.)

---

### `core/views/encounter.py`

**Analog:** itself — deckplan-first branches already exist (lines ~432-461, 513-545); delete legacy `else` branches calling `load_deck_map`.

**Branch to keep as primary** (pattern at line 432-433):
```python
deckplan = loader.load_deckplan(location_dir)
if deckplan and deckplan.get('decks'):
    # ... primary path
```

**Branch to delete** (pattern at lines 465-475, 562):
```python
else:
    deck_data = loader.load_deck_map(location_dir, requested_deck_id)
    if deck_data:
        ...
```

---

### `core/views/navigation.py`

**Analog:** `core/views/encounter.py`'s deckplan iteration pattern (lines ~513-545) — rewrite the `load_deck_map` caller at lines 68-80.

**Current (to rewrite)**:
```python
location = loader.find_location_by_slug(new_location_slug)
if location and location.get('map'):
    map_data = location['map']
    all_room_ids = []
    if map_data.get('is_multi_deck'):
        manifest = map_data.get('manifest', {})
        if location.get('directory'):
            location_dir = Path(location['directory'])
            for deck_info in manifest.get('decks', []):
                deck_data = loader.load_deck_map(location_dir, deck_info['id'])
                if deck_data and deck_data.get('rooms'):
                    all_room_ids.extend(r['id'] for r in deck_data['rooms'])
    else:
        if map_data.get('rooms'):
            all_room_ids = [r['id'] for r in map_data['rooms']]
    update_kwargs['encounter_room_visibility'] = {room_id: False for room_id in all_room_ids}
```

**Target shape** (using `load_deckplan()` directly — each deck dict already has `rooms` inline, no per-deck file load needed):
```python
location = loader.find_location_by_slug(new_location_slug)
if location and location.get('directory'):
    deckplan = loader.load_deckplan(Path(location['directory']))
    all_room_ids = [
        r['id']
        for deck in deckplan.get('decks', [])
        for r in deck.get('rooms', [])
    ]
    update_kwargs['encounter_room_visibility'] = {room_id: False for room_id in all_room_ids}
```

---

### `data/ships/somnus/deckplan.yaml` (new — migration target)

**Analog:** `data/ships/patrol_gunboat/deckplan.yaml` (canonical structure — read directly during implementation for exact key ordering/flow-style conventions). Field-mapping table is fully specified in RESEARCH.md "Exact migration mapping (somnus → deckplan.yaml)" — no additional excerpt needed here; planner should follow that table verbatim.

---

## Shared Patterns

### Surgical YAML editing (D-12, all `deckplan/` files)
**Source:** RESEARCH Pattern 1/3, verified against `yaml@2.9.0`.
**Apply to:** `useDeckplanModel.ts`, `deckplanYamlEdits.ts`.
- Always rebuild the id→range map from `editor.getModel().getValue()` at the moment of an edit-producing interaction (Pitfall 4) — not from debounced `content` state.
- Never call `YAML.stringify(doc)` on the whole document — only `model.applyEdits()`/`executeEdits()` with narrow ranges.
- Replace whole `position:` value span with single-line `{x: .., y: ..}` flow map (Pitfall 5 — acceptable scoped reformat).

### GM Console color/typography tokens (all new components)
**Source:** `src/components/gm/views/FileEditorView.tsx` inline styles + UI-SPEC.
**Apply to:** `DeckSelector.tsx`, `DeckplanPreviewPane.tsx`, `FileEditorView.css`.
```typescript
const MONOSPACE_FONT = "'Share Tech Mono', 'Cascadia Code', 'Courier New', monospace";
// Heading/Label: 11px/600/1px letter-spacing, uppercase
// Body: 12px/400
// Amber accent: #c9a050 (active states, highlights)
// Teal: #4a8b8b / #7ab8b8 (inactive/structural)
// Backgrounds: #080e0e (dominant), #0d1616 / #111e1e (secondary), border #1e3333 / #2a4040
```

### Drag-vs-click threshold (POI drag, D-10)
**Source:** `src/components/domain/encounter/TokenLayer.tsx` lines 90-91, 189-268.
**Apply to:** new `PoiEditLayer` (or extended `renderPoi`) in `EncounterMapRenderer.tsx`.
```typescript
const pendingDrag = useRef<{ id: string; startX: number; startY: number } | null>(null);
const DRAG_THRESHOLD = 5;
```

### Coordinate transforms (POI drag/add, D-10/D-11)
**Source:** `src/utils/svgCoordinates.ts` (full file, no modification needed).
**Apply to:** `EncounterMapRenderer.tsx` POI editor layer, `DeckplanPreviewPane.tsx`.
```typescript
import { screenToSVG, snapToGrid, getGridCell, inverseRotatePoint } from '@/utils/svgCoordinates';
```

### Save / SSE persistence (D-15, unchanged)
**Source:** `src/services/gmConsoleApi.ts` lines 178-186, `core/views/gm_data.py` `safe_write_yaml` (line 67) + `api_gm_data_file` (line 322).
**Apply to:** `FileEditorView.tsx` — no changes; all preview-driven edits go through existing `content` state → `handleSave` → `writeDataFile` → `PUT /api/gm/data/{path}`.
```typescript
async function writeDataFile(path: string, content: string): Promise<void> {
  await api.put('/gm/data/' + path, content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/gm/views/deckplan/useDeckplanModel.ts` | hook | transform | No existing hook builds a YAML CST id→range map; genuinely new (composes `yaml` package + `LineCounter`, both already installed). RESEARCH Pattern 1 provides a verified starting point. |
| `src/components/gm/views/deckplan/deckplanYamlEdits.ts` | utility | transform | No existing pure edit-range-builder module exists; follow `svgCoordinates.ts`'s pure-function module convention and RESEARCH Pattern 3. |

## Metadata

**Analog search scope:** `src/components/gm/`, `src/components/domain/encounter/`, `src/types/`, `src/utils/`, `core/data_loader.py`, `core/views/encounter.py`, `core/views/navigation.py`, `core/views/gm_data.py`, `data/ships/`
**Files scanned:** ~12 (FileEditorView.tsx/.css, MapPreview.tsx, EncounterMapRenderer.tsx, TokenLayer.tsx, encounterMap.ts, svgCoordinates.ts, gmConsoleApi.ts, gm_data.py, data_loader.py, encounter.py, navigation.py, deckplan.yaml samples)
**Pattern extraction date:** 2026-06-13
