# Phase 31: Deckplan Format — Per-Deck Hulls & Detail Linework - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the `deckplan.yaml` schema and `EncounterMapRenderer` so that:

1. **Per-deck hulls (HULL-01/02):** a deck can declare its own hull geometry —
   including multiple disjoint polygons (pods, nacelles, detached modules) and
   holes — rendered in addition to the shared location-level hull.
2. **Detail linework (DET-01/03):** rooms and the deck exterior can carry
   decorative linework (consoles, beds, furniture, hull greebles), with interior
   details gated by room reveal and exterior details always visible.

**In scope:** YAML schema extension + TypeScript types + renderer support +
backend passthrough + hand-authored test data (`patrol_gunboat`) + schema-doc
update (same commit, per the schema-sync rule).

**Out of scope:** the SVG converter emitting these fields (Phase 32); isometric
projection (Phase 33); editor click-to-jump / MCP targeting for detail entries
(existing renderer behavior extends naturally; new editor affordances deferred).

**Note on roadmap wording:** the roadmap says a deck hull "overrides the
location-level hull". Discussion refined this to **additive** semantics (D-02);
success criterion 1 should be read as "a deck can declare its own hull geometry
rendered on that deck".

</domain>

<decisions>
## Implementation Decisions

### Hull YAML shape
- **D-01:** `hull:` gains an optional plural `polygons:` key (a list of polygon
  point-lists) alongside the existing singular `polygon:`. Both forms normalize
  to a list internally. Existing single-polygon data (somnus, patrol_gunboat)
  stays valid — **no migration**.
- **D-02:** **Additive semantics.** The top-level (location) `hull:` is the
  shared silhouette and, when present, renders on **every** deck (current
  behavior unchanged). Each deck may declare its own optional `hull:` whose
  polygons render **in addition** to the shared silhouette (adds pods/nacelles;
  never shrinks the shared outline).
- **D-03:** Top-level and deck-level hulls share the **exact same shape**
  (`polygon:` / `polygons:` / `holes:`) — one `HullDef` type, one normalizer.
- **D-04:** Hulls support **holes/cutouts**: an optional hull-level `holes:`
  list of polygons subtracted from the hull fill (SVG `evenodd` fill-rule).
  Holes are NOT paired to a specific outer polygon — a hole is "inside whichever
  polygon contains it".
- **D-05:** Hand-authored testbed: `data/ships/patrol_gunboat/deckplan.yaml`
  (multi-deck) — add per-deck hull variants including a detached pod to exercise
  HULL-01/02.

### Detail data model
- **D-06:** Details live in a **deck-level `details:` list** (mirrors the `poi:`
  pattern; rooms stay lean).
- **D-07:** Each detail entry is one of two primitives: a **polyline**
  (`points: [[x,y],...]`, optional `closed: true`) or a **circle**
  (`circle: {cx, cy, r}`). Coordinates in grid-cell units. Phase 32 flattens
  Inkscape curves into polyline segments.
- **D-08:** An entry with `room: <id>` is **interior** — reveal-gated per
  DET-03. An entry **without** `room:` is **exterior** — always visible. The
  presence/absence of the room ref IS the gating condition; no separate
  exterior list.
- **D-09:** `id:` is **optional** on detail entries. Hand-authors may name
  important details; Phase 32's converter emits an id only when the Inkscape
  object has a label. Enables future editor/MCP targeting without YAML noise.

### Visual treatment
- **D-10:** **Fixed renderer style** — all detail linework draws in one style
  baked into the renderer: thin stroke (~1/4 wall thickness), dimmer teal from
  the existing palette. No styling fields in YAML; nothing for the converter to
  populate.
- **D-11:** Closed shapes (closed polylines, circles) may set an optional
  `filled: true` for a faint fill (e.g., solid machinery blocks). Default is
  stroke-only linework.
- **D-12:** Interior details render **inside the room's reveal group** so they
  inherit the existing CRT flicker-in cascade when the room reveals — one
  animation system, no separate detail animation.

### Reveal & GM view
- **D-13:** GM visibility **matches room treatment** — details live in the
  room's SVG group, so the GM sees them exactly as the unrevealed room shows on
  the GM console today. No special casing, no extra dimming logic.
- **D-14:** A dangling `room:` ref (typo / renamed room) is **fail-safe**:
  renders nothing for players (a typo can never leak interior details early),
  logs a dev-console warning, GM still sees it.

### Claude's Discretion
- Layer stacking order (details under tokens/labels/doors — decoration below
  interactive elements).
- Where polygon/polygons/holes normalization lives (backend loader vs frontend
  normalizer module à la `doorNormalizer`) — user did not lock this.
- Player payload gating stays consistent with rooms today (client-side reveal
  filtering); server-side filtering was raised but not discussed — keep the
  established pattern unless research finds a strong reason.
- Whether the Phase 29 editor preview needs anything beyond automatically
  rendering the new fields via the shared renderer (render-only is enough).
- Whether somnus also gets hand-authored details/hulls (patrol_gunboat is the
  required testbed; somnus adoption optional).
- Exact hull-hole rendering technique (single `<path>` with evenodd vs mask),
  detail stroke color token, filled-shape opacity.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Frontend — types & renderer (the core of this phase)
- `src/types/encounterMap.ts` — `HullDef` (line ~271, single `polygon:` today,
  extend with `polygons:`/`holes:`), `GridEncounterMapData.hull`, `VentPath`
  (the `points:` polyline precedent details follow), `GridRoom`.
- `src/components/domain/encounter/EncounterMapRenderer.tsx` — hull resolution
  (`hullProp ?? mapData.hull`, line ~179), hull SVG rendering (~1315–1330),
  room reveal gating (`roomVisibility[roomId] !== false`, ~280), room reveal
  groups/flicker (~789), vent rendering precedent (~1342).

### Backend — loader & payload passthrough
- `core/data_loader.py` — `load_deckplan()` (~lines 670–700) returns
  `hull` top-level; deck dicts pass through as authored.
- `core/payload_builder.py` — hull passthrough at lines 62 and 163; deck hull +
  details must flow to the frontend payloads here.

### Data — testbed & format reference
- `data/ships/patrol_gunboat/deckplan.yaml` — multi-deck testbed for
  hand-authored per-deck hulls + details (D-05).
- `data/ships/somnus/deckplan.yaml` — canonical single-deck example; existing
  `hull: polygon:` form that MUST remain valid unchanged (D-01).

### Schema docs (update in the SAME commit as any format change)
- `docs/schemas/schema-encounters.md` — hull row (line ~61) + new `details:`
  documentation; synced to janus-skills on push to main.
- `CLAUDE.md` "Schema Sync" table — the rule requiring the above.

### Downstream alignment (do not implement, but don't paint into a corner)
- `tools/svg_to_map.py` — Phase 32 will emit these fields from Inkscape
  "Details"/per-deck "Hull" sublayers; current Hull layer handling ~lines
  869–883. The YAML shapes chosen here (D-01, D-04, D-06–D-09) are the
  converter's output contract.
- `.planning/phases/29-interactive-deckplan-map-editor-with-live-preview-yaml-sync-/29-CONTEXT.md`
  — prior decisions carried forward: `deckplan.yaml` sole format (D-02/29),
  surgical text edits only (D-12/29), schema-sync rule (D-05/29).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EncounterMapRenderer.tsx` hull pipeline: `effectiveHull` memo + bbox
  computation (`view.bbox(mapData.rooms, effectiveHull, viewPadding)`) — extend
  both to iterate a normalized polygon list instead of one polygon.
- Room polygon-hole rendering already exists in the renderer (`hole-wall-${i}`)
  — precedent/machinery for hull holes.
- `VentPath` rendering — the existing "decorative polyline over the map"
  pattern (projection via `mapView`, per-segment SVG) that detail polylines can
  follow.
- Room reveal groups + flicker animation — interior details mount inside these
  groups to inherit gating and animation for free (D-12, D-13).
- Vitest infrastructure (Phase 21/29) — geometry/normalizer unit tests for the
  hull normalizer and detail gating.

### Established Patterns
- Schema-sync rule: `docs/schemas/schema-encounters.md` updated in the same
  commit as any YAML shape change.
- Surgical YAML edits only — new fields must be hand-authorable flow-style;
  no reserialize anywhere.
- Backend is a thin passthrough for deckplan data (`load_deckplan` →
  `payload_builder`) — frontend owns shape validation (cf. `doorNormalizer`).
- `roomVisibility[roomId] !== false` — absent means visible; detail gating must
  use the same convention.

### Integration Points
- `payload_builder.py` lines 62/163 — deck hull + `details` must be included in
  encounter and bridge/status payloads.
- `EncounterMapRenderer` hull override prop (`hullProp`) — MapPreview passes a
  manifest-level hull; additive semantics change this from "override" to
  "shared silhouette + deck extras".
- Phase 29's `DeckplanPreviewPane` renders via the same renderer — new fields
  appear in the editor preview automatically.

</code_context>

<specifics>
## Specific Ideas

- The mental model for hulls: the top-level hull is "the ship silhouette you
  always see"; deck hulls layer extra geometry (pods, nacelles) on top —
  the user explicitly pictured the location hull rendering "no matter what
  deck".
- Blueprint-grade aesthetic (Alien Romulus): details are thin, subordinate
  linework — consistency across maps matters more than per-detail styling,
  hence the fixed renderer style.
- Fail-safe over forgiving: a typo'd room ref must never spoil an unrevealed
  room to players.

</specifics>

<deferred>
## Deferred Ideas

- **Editor click-to-jump / drag for detail and hull entries** — Phase 29's
  preview gains rendering automatically; interactive targeting of details is a
  future editor increment.
- **MCP `find/edit_map_element` support for detail entries** — optional `id:`
  (D-09) keeps the door open; wiring the resolver is not in this phase.
- **Per-detail styling / type-based palettes** — rejected for v1 (D-10); could
  revisit if fixed styling proves too uniform.
- **Server-side payload filtering of unrevealed content** — raised during
  discussion but not pursued; client-side gating stays the pattern for now.

</deferred>

---

*Phase: 31-deckplan-format-per-deck-hulls-detail-linework*
*Context gathered: 2026-07-02*
