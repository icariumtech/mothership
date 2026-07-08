# Frontend Architecture

**Last Updated**: 2026-07-02

React 19 + TypeScript + Vite, Ant Design 6, React Three Fiber 9, GSAP, Zustand.
Three Vite entry points: `SharedConsole` (player display), `GMConsole` (GM
control center), `PlayerConsole` (legacy minimal message view).

## Source Tree

```
src/
├── entries/
│   ├── SharedConsole.tsx       # ⚠ 1100-line player-side container: SSE routing,
│   │                           #   ~30 useState hooks, view transitions (see
│   │                           #   "Known Issues" — duplicates sceneStore state)
│   ├── GMConsole.tsx           # GM shell: ViewRail + active GM view + SSE
│   └── PlayerConsole.tsx       # Legacy player message list
│
├── components/
│   ├── ui/                     # Reusable: Panel, DashboardPanel, CompactPanel,
│   │                           #   SSEConnectionToast, ViewStatusOverlay
│   ├── layout/TerminalHeader.tsx
│   │
│   ├── gm/                     # ===== GM CONSOLE =====
│   │   ├── layout/             # ViewRail (52px left rail), ToolRail (48px right),
│   │   │                       #   SlideOutPanel (300px, toggled by tool click)
│   │   ├── views/              # One per GM view — classes MUST be prefixed
│   │   │   │                   #   gm-* (gm-encounter-view etc.) to avoid collision
│   │   │   │                   #   with player views' position:fixed classes
│   │   │   ├── BridgeView.tsx      # ⚠ 1000+ lines; locations tree + bridge control
│   │   │   ├── EncounterView.tsx   # Map + ToolRail + panels
│   │   │   ├── FileEditorView.tsx  # ★ Monaco editor (@monaco-editor/react) for
│   │   │   │                       #   data/ YAML+MD, split view w/ live preview
│   │   │   ├── StandbyView.tsx
│   │   │   └── deckplan/           # ===== v3.0 DECKPLAN EDITOR =====
│   │   │       ├── DeckplanPreviewPane.tsx  # Live preview of Monaco buffer
│   │   │       │                            #   (200ms debounce, keeps last-good
│   │   │       │                            #   parse so YAML errors never blank it)
│   │   │       ├── DeckSelector.tsx
│   │   │       ├── useDeckplanModel.ts      # Pure: YAML→GridEncounterMapData adapter
│   │   │       │                            #   + buildIdRangeMap (id→Monaco line/col
│   │   │       │                            #   for click-to-jump)
│   │   │       └── deckplanYamlEdits.ts     # Pure surgical TextEdit builders (POI
│   │   │                                    #   move/add) — never re-stringifies the
│   │   │                                    #   whole doc; Monaco-agnostic, unit-tested
│   │   ├── panels/             # SlideOutPanel contents: LocationTree, Documents,
│   │   │                       #   NpcPortraits, Terminals, TokenPalette
│   │   ├── MapPreview.tsx      # GM map preview — REUSES EncounterMapRenderer
│   │   │                       #   (fill prop = absolute inset:0 for full-bleed)
│   │   ├── EncounterPanel.tsx, JanusPanel.tsx, TokenPalette.tsx,
│   │   ├── DataFileTree.tsx, LocationTree.tsx, DoorStatusPopup.tsx,
│   │   └── TokenImageGallery.tsx
│   │
│   └── domain/                 # ===== PLAYER-FACING =====
│       ├── dashboard/          # BridgeView (player, position:fixed), TabBar,
│       │   │                   #   StandbyView, StarMapPanel, InfoPanel
│       │   └── sections/       # StatusSection (⚠ 1087 tsx + 1729 css),
│       │                       #   PersonnelSection, LogsSection, JanusSection
│       ├── encounter/          # Encounter map rendering (player + GM shared)
│       │   ├── EncounterMapRenderer.tsx  # 780-line orchestrator: pan/zoom, popovers,
│       │   │                             #   projection/view, top-level SVG structure.
│       │   │                             #   Delegates rendering to ./renderer/ layers.
│       │   ├── renderer/       # ★ Layer components extracted from the renderer
│       │   │   │               #   (Tier 2 decomposition) — each takes explicit props,
│       │   │   │               #   no shared closures with the parent.
│       │   │   ├── mapColors.ts        # COLORS, CONNECTION_STYLES, WALL_THICKNESS
│       │   │   ├── RoomsLayer.tsx      # rect/circle/polygon room rendering + hit targets
│       │   │   ├── DoorsLayer.tsx      # door visibility gating + DoorSymbol composition
│       │   │   ├── DoorSymbol.tsx      # pure door SVG (frame/halves/damage/lock/seal)
│       │   │   ├── PoiLayer.tsx        # POI rendering + owns its own drag state machine
│       │   │   │                       #   (self-contained, like TokenLayer)
│       │   │   ├── PoiInfoPopup.tsx    # hover/click POI info card
│       │   │   └── VentTogglePopup.tsx # GM vent reveal/hide popup (owns click-outside-close)
│       │   ├── EncounterMapDisplay.tsx   # Player wrapper (routes grid vs legacy)
│       │   ├── EncounterView.tsx         # Player container (.encounter-view is
│       │   │                             #   position:fixed — do NOT reuse class in GM)
│       │   ├── TokenLayer.tsx, Token.tsx, TokenPopup.tsx, TokenStatusOverlay.tsx
│       │   ├── NPCPortraitOverlay.tsx, RoomContextMenu.tsx, LegendPanel.tsx
│       │   ├── geometry/       # ★ Pure math, unit-tested: roomGeometry,
│       │   │                   #   gridProjection, mapView
│       │   ├── doors/          # ★ doorNormalizer (authored YAML → canonical Door),
│       │   │                   #   doorVisibility — unit-tested
│       │   ├── animation/      # scheduleReveal, useRoomRevealAnimations
│       │   └── EncounterIcons.ts  # import.meta.glob SVG icon registry
│       ├── maps/               # 3D: GalaxyMap/SystemMap/OrbitMap Canvas wrappers
│       │   └── r3f/            # ★ Model subtree: galaxy/ system/ orbit/ scenes,
│       │                       #   shared/ (PostProcessing, TypewriterController,
│       │                       #   textureUtils, MapLabel, ViewOffset),
│       │                       #   hooks/ (use*Camera, useProceduralTexture,
│       │                       #   useStarSelection). See shared/POST_PROCESSING.md
│       ├── janus/              # JanusDialog (overlay), JanusTerminal (full view)
│       ├── terminal/CommTerminalDialog.tsx
│       ├── messages/           # MessageList, MessageItem
│       └── DocumentDialog.tsx
│
├── hooks/
│   ├── useSSE.ts               # ★ EventSource wrapper: named events 'activeview',
│   │                           #   'shipstatus', 'data-changed'; manual reconnect
│   │                           #   w/ failure-threshold toast; onConnect re-sync
│   ├── usePanZoom.ts           # Encounter map pan/zoom
│   ├── useTokenPlacement.ts, useViewTransition.ts, useExclusivePopover.ts
│   └── useMessages.ts, useTreeState.ts, useDebounce.ts
│
├── services/                   # Typed axios wrappers over /api
│   ├── api.ts                  # Axios instance + CSRF interceptor
│   └── gmConsoleApi, encounterApi, janusApi, messageApi, terminalApi
│
├── stores/sceneStore.ts        # Zustand: 3D scene state (view mode, selections,
│                               #   map data, camera, transitions, typewriter) +
│                               #   ~15 memoized selector hooks
│
├── types/                      # starMap, systemMap, orbitMap, encounterMap
│   │                           #   (GridEncounterMapData/GridRoom/AuthoredDoor —
│   │                           #   rects is OPTIONAL; doors are top-level, not
│   │                           #   nested in rooms), janus, message, gmConsole,
│   └──                         #   shipStatus, session
│
└── utils/                      # polygon2d (unit-tested), svgCoordinates,
                                #   typewriterUtils, transitionCoordinator
```

## Real-time Data Flow

SSE, not polling. `useSSE` (both consoles) connects to
`/api/active-view/stream/` and receives:
- `activeview` — full enriched state after every `sync_state()` on the backend
- `shipstatus` — ship.yaml changes
- `data-changed` — a data file was edited (path + action); consoles refetch

SharedConsole keeps a slow polling fallback for when SSE drops;
`SSEConnectionToast` surfaces persistent connection loss.

## GM Console Shell

`GMConsole.tsx` renders `ViewRail` (view switcher, green dot = what players
currently see) + the active GM view. Views manage their own right-side
`ToolRail` + `SlideOutPanel` stack (`__right` container pattern: absolute,
ToolRail first then panel). Player-view pushes go through `gmConsoleApi`.

## Encounter Map Rendering

One renderer serves both audiences:
- Player: `EncounterView` → `EncounterMapDisplay` → `EncounterMapRenderer`
- GM: `EncounterPanel`/`DeckplanPreviewPane` → `MapPreview` → `EncounterMapRenderer`

`isGM` prop gates GM affordances (hidden-room dimming, context menus, token
moves, vent reveal). Room shapes: `rects` (multi-rect w/ optional chamfer),
`circle`, or `polygon` (+ `holes`). Doors: top-level `doors:` array normalized
by `doorNormalizer` into canonical `Door` (explicit x/y/angle format preferred).
Layout styles on the renderer must be INLINE (Ant Design overrides classes).

## Deckplan Editor (v3.0, phase 29)

`FileEditorView` = Monaco + `DeckplanPreviewPane` split (ratio persisted in
localStorage). Two-way wiring:
- Preview click on room/door/POI → `buildIdRangeMap` lookup →
  `revealRangeInCenter` + decoration in Monaco (click-to-jump)
- POI drag / add on preview → `deckplanYamlEdits` builds a surgical `TextEdit`
  → `editor.executeEdits` (never a whole-document re-stringify)
- Monaco buffer change → debounced parse → preview re-render (last-good parse
  kept on error)

## State Management

- **sceneStore (Zustand)**: 3D scene state; R3F components read via selector
  hooks (`useMapViewMode`, `useSelectedPlanet`, ...).
- **SharedConsole local state**: ⚠ still holds ~30 useState mirrors of the same
  scene state (stalled migration — see Known Issues).
- **Backend is the source of truth** for view state: GM actions POST →
  `sync_state()` → SSE → both consoles update.
- sessionStorage: bridge tab; localStorage: tree expansion, editor path/split.

## Testing

vitest (`vitest.config.ts`, jsdom, `src/**/__tests__/**`). Coverage is the
pure-logic islands only: encounter geometry/doors/animation, deckplan model +
YAML edits, polygon2d. No store/service/hook/component tests yet.
Run: `pnpm vitest run` · types: `pnpm run typecheck`.

## Known Issues / Gotchas

1. **Dual scene state**: sceneStore was built to replace SharedConsole's
   useState blocks; migration stalled. Prefer the store for new scene state.
2. **CSS is global** (no CSS Modules). `.panel-content`/`.panel-wrapper`
   appear in many files but are legitimate ancestor-scoped variant overrides
   of the shared `Panel.css` component (specificity resolves correctly
   regardless of load order) — not a live collision, verified 2026-07.
   The real hazard: bare/unscoped class names. Namespace new classes
   (`gm-*` for GM console) and never reuse `.encounter-view`/`.bridge-view`
   (player position:fixed classes) — that collision was real and is fixed.
3. **Giant files**: SharedConsole (1117), StatusSection (1087+1729 css),
   gm BridgeView (1038) — read before editing. EncounterMapRenderer was
   780 lines as of the Tier-2 decomposition (2026-07) — see the `renderer/`
   subdirectory for the extracted room/door/POI layer components.
4. **`GridRoom.rects` is optional** — always guard (`room.rects ?? []`).
5. **Two BridgeView.tsx** exist (gm/views vs domain/dashboard) — unrelated
   components; check the import path.
6. **deckplan YAML edit layer is loosely typed** (`any`-heavy in
   deckplanYamlEdits/useDeckplanModel) — types don't guarantee shape there.
