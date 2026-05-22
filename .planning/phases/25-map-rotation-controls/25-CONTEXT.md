# Phase 25: Map rotation controls - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Add map playback controls to all three 3D map views (galaxy, system, orbit):
- **Galaxy map:** play/pause toggle for the auto-rotation animation (no camera position change)
- **System map:** play/pause toggle for planet orbit animations + horizontal scrub bar (only active when paused) to manually position planets along their orbital paths
- **Orbit map:** play/pause toggle for moon/station orbit animations + same scrub bar pattern

All controls appear at top-center of the map canvas as a compact overlay row: `[ ⏸ |==drag zone==| ]`.

</domain>

<decisions>
## Implementation Decisions

### Galaxy Map Controls
- **D-01:** Play/pause button only — controls the `autoRotate` flag in `sceneStore`. No scrub bar on the galaxy map.
- **D-02:** Button position: top-center overlay above the canvas, outside the 3D canvas element (not a R3F child).

### System + Orbit Map Controls
- **D-03:** Play/pause button left of the scrub bar — one horizontal row at top-center.
- **D-04:** Scrub bar is **disabled** (grayed out, non-interactive) while orbits are playing. It activates only when orbits are paused.
- **D-05:** The scrub bar is a horizontal drag zone. Dragging right advances orbital positions; dragging left reverses them. No discrete steps.
- **D-06:** Scrub speed is adaptive:
  - **Default (no body selected):** Calibrated so dragging across the full bar width produces visible movement for all bodies — speed anchored to the shortest orbital period in the current scene.
  - **Body selected:** Speed recalibrated to the selected body's orbital period, so that body moves at a natural rate for the drag distance.
- **D-07:** No reset button. Navigating to a different system/body reloads default orbital positions.

### Orbital Position State
- **D-08:** Orbital position offset (the scrub accumulator) is local React state, not persisted to Zustand store or server. Resets on view change.
- **D-09:** Scrub offset is stored as a floating-point angle (radians) per orbiting body, applied as an additional offset on top of the real-time `t` animation value. When paused, bodies freeze at their current `t` + offset position.

### Visual Style
- **D-10:** Controls use the CRT aesthetic — teal/amber palette, monospace font, chamfered edges consistent with existing map panels. The play/pause button uses ▶ / ⏸ Unicode characters.
- **D-11:** Scrub bar drag zone has a subtle horizontal line/track and a thumb indicator (no fill). Width: ~300px or constrained to map width.

### Layout
- **D-12:** Top-center overlay position. Intended for large touch TV interaction — button targets should be generously sized (≥44px height).
- **D-13:** The controls are rendered as a React overlay div positioned absolute over the Canvas element, not inside the R3F scene.

### Claude's Discretion
- Exact CSS for the scrub bar drag zone (cursor, thumb indicator styling)
- Whether the play/pause button shows a label ("PLAY" / "PAUSE") alongside the icon or icon only
- Exact `top` offset of the overlay so it clears the tab/nav bar without overlapping scene content
- Whether the scrub bar shows any position feedback (e.g., a floating tooltip with estimated angle or nothing)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 3D Map Controls (existing — extend these)
- `src/components/domain/maps/r3f/galaxy/GalaxyControls.tsx` — Custom galaxy camera controls; owns `autoRotate` interaction with `sceneStore`. Play/pause must coordinate with this.
- `src/components/domain/maps/r3f/system/SystemControls.tsx` — Camera controls for system view; zoom limits, drag-to-rotate, touch.
- `src/components/domain/maps/r3f/orbit/OrbitControls.tsx` — Camera controls for orbit view.

### Scene Store
- `src/stores/sceneStore.ts` — `animations.autoRotate` + `setAutoRotate(bool)` are the galaxy play/pause state. Planner must check whether orbit animation state (paused flag) needs to be added here or kept local.

### Scene Components (where scrub offset wires in)
- `src/components/domain/maps/r3f/GalaxyScene.tsx` — Hosts `<GalaxyControls>` and drives star rendering.
- `src/components/domain/maps/r3f/SystemScene.tsx` — Drives planet orbital animations; orbital period data comes from `systemMapData`.
- `src/components/domain/maps/r3f/OrbitScene.tsx` — Drives moon/station orbital animations.

### Map Wrapper Components (where overlay is added)
- `src/components/domain/maps/GalaxyMap.tsx` — Canvas wrapper; overlay div sits alongside `<Canvas>`.
- `src/components/domain/maps/SystemMap.tsx` — Same pattern.
- `src/components/domain/maps/OrbitMap.tsx` — Same pattern.

### Style Reference
- `STYLE_GUIDE.md` — CRT color palette (teal `#4a6b6b`, amber `#8b7355`), chamfer 12px, Cascadia Code font, panel sizing.

### Orbital Period Data
- `src/types/systemMap.ts` — Type definitions for system map data including body orbital periods.
- `src/types/orbitMap.ts` — Type definitions for orbit map data including moon/station orbital periods.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GalaxyControls.tsx`: `setAutoRotate` / `autoRotate` in sceneStore is the play/pause hook for galaxy — just expose a button that calls `setAutoRotate(false/true)`.
- `useCameraAnimation.ts`: Existing animation frame loop pattern — scrub offset can follow the same `useFrame` pattern.
- `DashboardPanel` / `CompactPanel` from `src/components/ui/`: Chamfered CRT-style panel containers — use for the controls overlay wrapper.

### Established Patterns
- Zustand `sceneStore` for shared animation state; local `useRef` / `useState` for per-scene transient state (scrub offset fits local state).
- All controls components render `null` (no DOM output) — they live inside `<Canvas>`. The new controls overlay is **outside** Canvas as a positioned div.
- `useFrame` loop for per-frame animation updates — scrub offset drives body angles each frame when paused.

### Integration Points
- Map wrapper components (`GalaxyMap`, `SystemMap`, `OrbitMap`) are where the overlay div attaches — they already have a container div wrapping `<Canvas>`.
- Orbital animation logic in scene components uses a time-based `t` value (likely `useFrame` clock) — scrub offset adds to this `t` when paused.
- `sceneStore` `autoRotate` flag: galaxy controls already respect this; pause button just toggles it.

</code_context>

<specifics>
## Specific Ideas

- The user described the scrub bar as a "continuous wheel you can swipe" — horizontally. The mental model is swiping right = forward time, left = backward.
- The TV touch context means generous touch targets (≥44px hit area), top placement for easy reach from a couch.
- The play/pause and scrub bar should be one horizontal unit (`[ ⏸ |==drag==| ]`) rather than stacked.
- Galaxy controls are conceptually simpler: the auto-rotate is "the galaxy spinning" and the user just wants to pause/resume it — no time-scrub needed.

</specifics>

<deferred>
## Deferred Ideas

- **Campaign date/time system:** User initially considered tying orbital positions to an in-game clock/date, but deferred in favor of the simpler continuous scrub model. A campaign date could be a future enhancement if needed for session prep.
- **Reset/home button for orbital positions:** User decided navigating away naturally resets positions. Could be revisited if scrubbing far from defaults becomes disorienting.

</deferred>

---

*Phase: 25-map-rotation-controls*
*Context gathered: 2026-05-22*
