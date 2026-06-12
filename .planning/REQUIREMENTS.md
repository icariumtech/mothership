# Requirements: Mothership GM Terminal — v3.0 Better Deckplans

**Defined:** 2026-06-12
**Core value:** Give the GM a single tool that enhances the tabletop experience with atmospheric digital interfaces without interrupting gameplay flow.

## v3.0 Requirements

### Deckplan Editor (EDIT)

- [ ] **EDIT-01**: All locations load from `deckplan.yaml` only — legacy `map/manifest.yaml` + per-deck `map/*.yaml` loaders removed, somnus migrated to `deckplan.yaml`
- [ ] **EDIT-02**: GM sees a live rendered map preview below Monaco when a `deckplan.yaml` is open in FileEditorView
- [ ] **EDIT-03**: GM can switch which deck the preview renders
- [ ] **EDIT-04**: GM can click a room or POI on the preview to jump to (reveal + highlight) its YAML line in Monaco
- [ ] **EDIT-05**: GM can drag a POI on the preview to move it — written as a surgical `position: {x, y}` text patch into the Monaco buffer
- [ ] **EDIT-06**: GM can click an empty cell on the preview to add a POI stub to the selected deck's `poi:` list

*Constraints (from 29-CONTEXT.md):* map-driven writes are surgical text edits, never a YAML reserialize (D-12); save reuses `PUT /api/gm/data/{path}` (D-15); preview lives inside FileEditorView, not a new GMViewType (D-07); map→YAML sync is one-way for v1 (D-09); POI rename/type/icon/delete stay text-only (D-13).

### Map Detail Linework (DET)

- [ ] **DET-01**: `deckplan.yaml` supports decorative detail linework attached to rooms and to the deck exterior (hull greebles, consoles, beds, furniture)
- [ ] **DET-02**: `svg_to_map.py` converts Inkscape "Details" sublayers into detail linework in the output YAML
- [ ] **DET-03**: Players see a room's interior details only when that room is revealed; exterior/hull details are always visible

### Hull Geometry (HULL)

- [ ] **HULL-01**: A deck can declare its own hull polygon, overriding the location-level hull
- [ ] **HULL-02**: A deck hull can consist of multiple disjoint polygons (pods, nacelles, detached modules)
- [ ] **HULL-03**: `svg_to_map.py` emits per-deck hulls from per-deck Hull sublayers

### Circular Rooms (CIRC)

- [ ] **CIRC-01**: `svg_to_map.py` detects SVG `<circle>`/`<ellipse>` elements in room layers and emits `circle` rooms (renderer support already exists)

### Isometric View (ISO)

- [ ] **ISO-01**: An isometric projection renders any deckplan via the existing `gridProjection`/`mapView` seam — rooms, doors, vents, POIs, tokens, and details all project correctly
- [ ] **ISO-02**: Players can toggle the encounter view between top-down and isometric live
- [ ] **ISO-03**: GM can toggle the GM console map between top-down and isometric live

## Future Requirements (deferred)

- Dedicated map-editor GMViewType with property/widget forms (Phase 29 "v2" idea)
- Bidirectional Monaco caret → map highlight sync
- Room/hull geometry reshaping (polygon vertex drag)
- POI rename/type/icon/delete via UI
- UI audio — AUDI-01..03 (deferred since v1.0)

## Out of Scope

- Token editing in the authoring tool — tokens are runtime encounter state, not map data
- Animated isometric transitions — toggle is a cut, not a tween (CRT aesthetic, avoid RAF competition)
- Per-map projection lock — projection is a live view preference, not YAML data

## Traceability

*(Filled by roadmap)*

| REQ-ID | Phase | Status |
|--------|-------|--------|
| EDIT-01 | Phase 29 | Pending |
| EDIT-02 | Phase 29 | Pending |
| EDIT-03 | Phase 29 | Pending |
| EDIT-04 | Phase 29 | Pending |
| EDIT-05 | Phase 29 | Pending |
| EDIT-06 | Phase 29 | Pending |
| HULL-01 | Phase 31 | Pending |
| HULL-02 | Phase 31 | Pending |
| DET-01 | Phase 31 | Pending |
| DET-03 | Phase 31 | Pending |
| DET-02 | Phase 32 | Pending |
| HULL-03 | Phase 32 | Pending |
| CIRC-01 | Phase 32 | Pending |
| ISO-01 | Phase 33 | Pending |
| ISO-02 | Phase 33 | Pending |
| ISO-03 | Phase 33 | Pending |
