# Phase 13: Atmospheric UI Animations - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Add atmospheric CRT-aesthetic animations to player-facing UI transitions and element reveals. The NPC portrait animation (flicker → wipe → typewriter → dismiss) is the established reference pattern. This phase extends that same quality of animation to: view-to-view transitions, overlay entrances/exits, encounter room reveals, and view boot sequences. No new UI features are added — only animation polish on existing player-facing elements.

</domain>

<decisions>
## Implementation Decisions

### View-to-view transitions
- Style: glitch burst (rapid opacity flickers matching standby text animation) followed by fade into new view
- Intensity: heavy glitch for major view changes (STANDBY → ENCOUNTER, STANDBY → BRIDGE); Bridge tab switching keeps existing lighter GSAP fade
- Directionality: glitch plays only on the outgoing view; incoming view fades in clean
- Returning to STANDBY: "signal lost" aesthetic — current view glitches off, screen goes dark briefly, standby text glitches into existence (matching existing aggressiveGlitch animation)
- Accessibility: always play animations (no prefers-reduced-motion handling)
- Total duration target: ~400ms for full transition

### View status text (boot labels)
- All major view changes show a one-liner status text during the transition
- Per-view labels: ENCOUNTER → "TACTICAL DISPLAY INITIALIZING...", BRIDGE → "BRIDGE SYSTEMS ONLINE", STANDBY → "STANDBY MODE ACTIVE"
- Position: center screen
- Style: typewriter reveal at established 55ms/char rate, then fades out
- Lifetime: fades out as new view content becomes interactive (covers loading states naturally)

### Overlay entrance/exit animations
- All overlays share a unified atmospheric treatment (not per-overlay variants)
- Document overlay: top-down scan reveal using clip-path inset animation (same pattern as portrait wipe but on the panel container)
- CHARON dialog: flicker-in entrance (rapid opacity pulses before dialog becomes stable), then existing response typing kicks in seamlessly
- CommTerminal overlay: typewriter-in from top — terminal log lines cascade in as if being received live
- All overlay exits: flicker/fade out with slight scale reduction (mirroring portrait-dismiss: opacity fade + scale 0.92 over ~300ms)
- Backdrop: slow creeping dark using a radial vignette from edges over ~500ms (not uniform opacity fade)

### Encounter room reveals
- Style: flicker-then-stable (brief opacity pulses then room becomes visible) — CRT feel
- Multiple rooms revealed simultaneously: staggered with ~75ms delay offset between rooms
- REVEAL ALL bulk action: cascade sweep from top to bottom of map, rooms revealing as the wave passes
- HIDE ALL bulk action: reverse cascade (top to bottom rooms flicker out staggered)
- Room hide animation: mirrors reveal (flicker-then-gone)
- Implementation: CSS class applied to SVG room groups (`.room-revealing`, `.room-hiding`) triggering keyframes
- Token reveal: tokens in revealed rooms fade in after the room animation completes (~200ms delay post-room-reveal)

### BRIDGE view entrance
- Dashboard panels boot up with staggered fade-in delays when bridge view first appears
- Extends the existing StatusSection staggered pattern broadly to all panels

### Claude's Discretion
- Exact keyframe timing within established patterns (flicker step counts, easing curves)
- How to manage animation state for room reveals in the SVG renderer
- Whether to use a shared `useViewTransition` hook or handle per-component
- CSS specifics for radial vignette backdrop implementation

</decisions>

<specifics>
## Specific Ideas

- The NPC portrait animation is the gold standard reference — flicker (280ms, steps(1)) → clip-path wipe (650ms, cubic-bezier(0.16, 1, 0.3, 1)) → typewriter (55ms/char) → stable. New animations should feel like siblings of this pattern.
- The existing `aggressiveGlitch` keyframe in StandbyView.css is the reference for glitch bursts — reuse/adapt it rather than invent something new.
- The "signal lost" return-to-standby should feel like a monitor losing its feed, not a planned transition.
- Status text during transitions should feel like the ship's computer acknowledging the mode change — terse, technical, in-character.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reference animation pattern
- `src/components/domain/encounter/NPCPortraitOverlay.css` — Portrait animation keyframes: portrait-flicker, portrait-wipe, portrait-dismiss. These are the established CRT aesthetic standards.
- `src/components/domain/encounter/NPCPortraitCard.tsx` — React state machine pattern for multi-phase animations (AnimPhase union type, useEffect sequencing with cancelled flag). Replicate this pattern.

### Existing animations to be extended or adapted
- `src/components/domain/dashboard/StandbyView.css` — aggressiveGlitch keyframe (reuse for view transition glitch burst)
- `src/components/domain/dashboard/StandbyView.tsx` — randomizeGlitchDirection pattern (CSS custom properties for per-instance randomization)
- `src/components/domain/maps/GalaxyMap.css` — galaxyMapFadeIn/Out pattern (existing map view transitions)

### View orchestration (where transitions get wired)
- `src/entries/SharedConsole.tsx` — Player terminal — where view_type drives rendering, where transition state should live
- `src/entries/SharedConsole.tsx` (GSAP bridge tab transitions ~line 880) — Existing GSAP timeline pattern to preserve

### Overlay components to animate
- `src/components/domain/DocumentDialog.css` / `DocumentDialog.tsx` — Current 0.2s scale-fade to replace with scan reveal
- `src/components/domain/charon/CharonDialog.css` / `CharonDialog.tsx` — Current 0.2s scale-fade to replace with flicker-in
- `src/components/domain/terminal/CommTerminalDialog.css` — Current 0.2s scale-fade to replace with typewriter-in

### Encounter map renderer (room reveals)
- `src/components/domain/encounter/EncounterMapRenderer.tsx` — Where room SVG groups are rendered; target for CSS class injection
- `src/components/domain/encounter/TokenLayer.tsx` — Token rendering; needs delayed fade-in after room reveal

### Design system
- `STYLE_GUIDE.md` — Color palette, timing standards, chamfer patterns
- `CLAUDE.md` — Project overview, CRT aesthetic guidance

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `NPCPortraitCard.tsx` AnimPhase state machine: direct template for any multi-phase entrance animation
- `aggressiveGlitch` keyframe in StandbyView.css: reuse for view transition glitch burst
- `portrait-flicker` / `portrait-wipe` / `portrait-dismiss` keyframes: extend or compose for overlay animations
- GSAP (already imported in SharedConsole.tsx): available for the view transition timeline coordination

### Established Patterns
- CSS keyframes + React state class toggling: primary animation pattern across the codebase
- 55ms/char typewriter rate: used in NPCPortraitCard and StandbyView text blocks — keep consistent
- 0.2-0.3s for UI micro-interactions, 0.4-0.6s for content transitions, 1.2s for major map fades
- `clip-path: inset(0 0 N% 0)` wipe pattern: established in portrait, apply to document panel scan

### Integration Points
- View transitions: SharedConsole.tsx `viewType` state change is the trigger point
- Room reveals: EncounterMapRenderer room group rendering — inject `.room-revealing` / `.room-hiding` CSS classes based on visibility change detection
- Token delayed reveal: TokenLayer visibility filtering logic — add animation class when room transitions from hidden → visible
- Bridge panel stagger: BridgeView panels need `animation-delay` CSS with index-based offsets

</code_context>

<deferred>
## Deferred Ideas

- Sound effects / audio feedback to accompany animations (user mentioned this as interesting but out of scope for this phase)
- GM console animation polish (this phase is player-facing terminal only)
- Map camera fly-through on encounter load
- Animated token placement (token dropping onto map with impact effect)

</deferred>

---

*Phase: 13-atmospheric-ui-animations-for-player-facing-transitions-and-element-reveals*
*Context gathered: 2026-03-28*
