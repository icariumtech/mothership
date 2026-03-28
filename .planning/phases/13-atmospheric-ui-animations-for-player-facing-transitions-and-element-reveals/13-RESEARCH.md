# Phase 13: Atmospheric UI Animations - Research

**Researched:** 2026-03-28
**Domain:** CSS keyframe animations, React state machine pattern, GSAP timeline coordination
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**View-to-view transitions**
- Style: glitch burst (rapid opacity flickers matching standby text animation) followed by fade into new view
- Intensity: heavy glitch for major view changes (STANDBY → ENCOUNTER, STANDBY → BRIDGE); Bridge tab switching keeps existing lighter GSAP fade
- Directionality: glitch plays only on the outgoing view; incoming view fades in clean
- Returning to STANDBY: "signal lost" aesthetic — current view glitches off, screen goes dark briefly, standby text glitches into existence (matching existing aggressiveGlitch animation)
- Accessibility: always play animations (no prefers-reduced-motion handling)
- Total duration target: ~400ms for full transition

**View status text (boot labels)**
- All major view changes show a one-liner status text during the transition
- Per-view labels: ENCOUNTER → "TACTICAL DISPLAY INITIALIZING...", BRIDGE → "BRIDGE SYSTEMS ONLINE", STANDBY → "STANDBY MODE ACTIVE"
- Position: center screen
- Style: typewriter reveal at established 55ms/char rate, then fades out
- Lifetime: fades out as new view content becomes interactive (covers loading states naturally)

**Overlay entrance/exit animations**
- All overlays share a unified atmospheric treatment (not per-overlay variants)
- Document overlay: top-down scan reveal using clip-path inset animation (same pattern as portrait wipe but on the panel container)
- CHARON dialog: flicker-in entrance (rapid opacity pulses before dialog becomes stable), then existing response typing kicks in seamlessly
- CommTerminal overlay: typewriter-in from top — terminal log lines cascade in as if being received live
- All overlay exits: flicker/fade out with slight scale reduction (mirroring portrait-dismiss: opacity fade + scale 0.92 over ~300ms)
- Backdrop: slow creeping dark using a radial vignette from edges over ~500ms (not uniform opacity fade)

**Encounter room reveals**
- Style: flicker-then-stable (brief opacity pulses then room becomes visible) — CRT feel
- Multiple rooms revealed simultaneously: staggered with ~75ms delay offset between rooms
- REVEAL ALL bulk action: cascade sweep from top to bottom of map, rooms revealing as the wave passes
- HIDE ALL bulk action: reverse cascade (top to bottom rooms flicker out staggered)
- Room hide animation: mirrors reveal (flicker-then-gone)
- Implementation: CSS class applied to SVG room groups (`.room-revealing`, `.room-hiding`) triggering keyframes
- Token reveal: tokens in revealed rooms fade in after the room animation completes (~200ms delay post-room-reveal)

**BRIDGE view entrance**
- Dashboard panels boot up with staggered fade-in delays when bridge view first appears
- Extends the existing StatusSection staggered pattern broadly to all panels

### Claude's Discretion
- Exact keyframe timing within established patterns (flicker step counts, easing curves)
- How to manage animation state for room reveals in the SVG renderer
- Whether to use a shared `useViewTransition` hook or handle per-component
- CSS specifics for radial vignette backdrop implementation

### Deferred Ideas (OUT OF SCOPE)
- Sound effects / audio feedback to accompany animations
- GM console animation polish (player-facing terminal only)
- Map camera fly-through on encounter load
- Animated token placement (token dropping onto map with impact effect)
</user_constraints>

---

## Summary

This phase is a pure animation-polish pass on the player-facing terminal (`SharedConsole.tsx`). No new UI features are added — the work is entirely CSS keyframes, React state machine additions, and wiring animation triggers at existing event points. The codebase already has an excellent reference pattern in `NPCPortraitCard.tsx` (AnimPhase state machine) and `StandbyView.css` (aggressiveGlitch keyframe) that provide the style vocabulary for all new work.

The core technical challenge is the view-to-view transition: SharedConsole already has a `TransitionState` type and `transitionLockRef`, but does not yet use them for a glitch-out / fade-in sequence on `viewType` changes driven by SSE. Wiring a new `useViewTransition` hook at the SSE `onEvent` callback is the cleanest integration point — it intercepts the incoming `view_type` change, plays outgoing animation, then commits `setActiveView`.

The overlay animations are self-contained per-component CSS + AnimPhase additions — DocumentDialog, CharonDialog, CommTerminalDialog each need a CSS AnimPhase-like state to pick enter/exit animation class, plus new keyframes replacing their current generic `scaleIn`.

**Primary recommendation:** Build a shared `useViewTransition` hook in `src/hooks/`, reuse `aggressiveGlitch` for the glitch burst, and apply the NPCPortraitCard AnimPhase pattern to each overlay component independently.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CSS Keyframes | native | All animation motion | Already the primary pattern in this codebase; zero overhead |
| React state + useEffect | React 19 | Animation phase sequencing | Established pattern from NPCPortraitCard; no new dependencies |
| GSAP | 3.14 (already installed) | Bridge tab transition preservation | Already used for `.bridge-content-area` fade; keep for that path only |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS custom properties | native | Per-instance glitch direction randomization | Needed for view glitch (same as StandbyView `--glitch-x1` pattern) |
| `requestAnimationFrame` | native | Class-toggle timing after state change | Ensures class is applied in next paint frame, not same tick |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS keyframes | Framer Motion | FM is not in the project; adds 50KB+ for nothing CSS can't do |
| CSS keyframes | GSAP for all transitions | GSAP already used for tab transitions but CSS keyframes are the dominant pattern — mixing more GSAP would be inconsistent |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

New files created by this phase:
```
src/hooks/useViewTransition.ts         # Hook: intercepts viewType SSE changes, sequences glitch-out/fade-in
src/components/ui/ViewStatusOverlay.tsx  # Transient center-screen boot label
src/components/ui/ViewStatusOverlay.css
src/entries/SharedConsole.css          # Add: .view-glitch-out, .view-fade-in classes
```

Modified files:
```
src/entries/SharedConsole.tsx           # Wire useViewTransition at SSE onEvent; mount ViewStatusOverlay
src/components/domain/DocumentDialog.css/.tsx   # Replace scaleIn with scan-reveal; add exit keyframe
src/components/domain/charon/CharonDialog.css/.tsx  # Replace scaleIn with flicker-in; add exit
src/components/domain/terminal/CommTerminalDialog.css/.tsx  # Replace scaleIn with typewriter-cascade; add exit
src/components/domain/encounter/EncounterMapRenderer.tsx   # Room reveal/hide CSS class injection
src/components/domain/encounter/EncounterMapRenderer.css   # room-revealing/room-hiding keyframes
src/components/domain/encounter/TokenLayer.tsx   # Delayed fade-in for tokens in newly-revealed rooms
src/components/domain/dashboard/BridgeView.css  # Panel stagger animation on mount
```

### Pattern 1: AnimPhase State Machine (NPCPortraitCard template)

**What:** A TypeScript literal union type drives which CSS class is applied to the animated element. `useEffect` sequences phases with `async/await` + cancellation flag.

**When to use:** Any multi-step entrance sequence: flicker → stable, flicker → wipe → stable, etc.

**Example (from NPCPortraitCard.tsx — HIGH confidence, read directly):**
```typescript
// Source: src/components/domain/encounter/NPCPortraitCard.tsx
type AnimPhase = 'flicker' | 'wipe' | 'stable' | 'typing' | 'done' | 'dismissing';

useEffect(() => {
  let cancelled = false;
  const runSequence = async () => {
    setAnimPhase('flicker');
    await new Promise(r => setTimeout(r, 280));
    if (cancelled) return;
    setAnimPhase('wipe');
    await new Promise(r => setTimeout(r, 650));
    if (cancelled) return;
    setAnimPhase('stable');
  };
  runSequence();
  return () => { cancelled = true; };
}, []);
```

The class binding is: `className={`element phase-${animPhase}`}` — CSS does the rest.

### Pattern 2: CSS Custom Properties for Per-Instance Randomization

**What:** CSS `--glitch-x1`, `--glitch-y1` etc. are set via `element.style.setProperty()` from JS, consumed by keyframes.

**When to use:** The view glitch-out uses the same `aggressiveGlitch` keyframe as StandbyView. To make each transition feel different, randomize the CSS custom properties on the wrapper element before adding the animation class.

**Example (from StandbyView.tsx — HIGH confidence, read directly):**
```typescript
// Source: src/components/domain/dashboard/StandbyView.tsx
const randomizeGlitchDirection = useCallback((element: HTMLElement) => {
  const x1 = (Math.random() * 70 - 35).toFixed(0);
  element.style.setProperty('--glitch-x1', `${x1}px`);
  // ... etc
}, []);
```

### Pattern 3: Room Reveal via CSS Class on SVG `<g>` Group

**What:** `renderRoom()` in `EncounterMapRenderer.tsx` applies `opacity={roomOpacity}` as an inline prop. To animate reveal/hide, switch to CSS-class-driven opacity instead of the inline prop for the animation window.

**When to use:** When `roomVisibility` changes (previous value `false` → new value `true`, or reverse).

**Implementation approach (Claude's discretion):**
- Track `prevRoomVisibility` with `useRef` in EncounterMapRenderer
- On each render, diff current vs previous to detect state changes
- Apply `.room-revealing` or `.room-hiding` class to the `<g>` group for the animation duration (~400ms)
- Use a `Map<roomId, 'revealing' | 'hiding' | null>` in `useState` for animation state per room
- After animation completes, clear the state entry (controlled by `setTimeout` matching CSS duration)

For REVEAL ALL cascade: sort rooms by their Y centroid, compute `delay = index * 75` ms, apply staggered `animation-delay` via inline style.

### Pattern 4: View Transition Hook

**What:** A custom hook in `SharedConsole.tsx` that intercepts `view_type` changes from SSE before committing them to React state, plays the outgoing animation, then lets the new view render.

**When to use:** The SSE `onEvent` callback currently calls `setActiveView(data)` immediately. The hook wraps this: when `data.view_type !== activeViewRef.current?.view_type`, hold the new data, animate out, then commit.

**Sketch:**
```typescript
// src/hooks/useViewTransition.ts (HIGH confidence pattern from existing codebase)
type ViewTransitionState = 'idle' | 'glitching-out' | 'dark' | 'fading-in';

// SharedConsole integration point (src/entries/SharedConsole.tsx ~line 310):
// Current: setActiveView(data);
// New:     viewTransition.handleViewChange(data, () => setActiveView(data));
```

The hook:
1. Detects view type change
2. Adds `.view-glitch-out` class to content wrapper (runs aggressiveGlitch burst, ~300ms)
3. Removes class, adds `.view-dark` (brief dark frame, ~50ms)
4. Calls `setActiveView(pendingData)` — React renders new view
5. Adds `.view-fade-in` class (opacity 0 → 1, ~150ms)
6. Shows ViewStatusOverlay (typewriter boot label)

Total: ~400ms as specified.

### Pattern 5: Overlay Exit Animation

**What:** Overlays currently render/unmount based on boolean state (`charonDialogOpen`, `docOverlayOpen`, etc.). To animate exit, the overlay must stay mounted briefly after the "close" signal, play its exit animation, then trigger actual unmount.

**When to use:** All three overlays (CharonDialog, DocumentDialog, CommTerminalDialog).

**Implementation approach:**
```typescript
// Per-overlay pattern (same as NPCPortraitCard isDismissing pattern)
const [animPhase, setAnimPhase] = useState<'entering' | 'stable' | 'exiting'>('entering');

// When parent signals close:
useEffect(() => {
  if (!isOpen) {
    setAnimPhase('exiting');
    const timer = setTimeout(() => onExitComplete(), 300); // matches CSS duration
    return () => clearTimeout(timer);
  }
}, [isOpen]);
```

The parent must delay unmounting — either by keeping the component mounted and using CSS `display:none` after exit, or by managing a "keep alive for exit" flag. The cleanest approach matches what NPCPortraitOverlay does: the parent tracks `dismissingIds` and only removes from the list after `onDismissed` fires.

### Anti-Patterns to Avoid

- **Animating `display:none` elements:** CSS animations don't play on `display:none`. Use `visibility:hidden` or opacity/clip-path instead when element must remain in flow.
- **`animation` + inline `opacity` conflict:** If a room `<g>` has `opacity={0.25}` as an inline React prop and you also try to apply a CSS animation that sets `opacity`, the inline prop wins. Remove the inline prop during the animation window; restore it after.
- **Multiple animation class resets:** Adding a class, removing it, and re-adding it in the same JS tick won't re-trigger the animation. Use `requestAnimationFrame` to force a reflow between remove and re-add.
- **GSAP mixed with CSS on same property:** GSAP's `.to(el, {opacity})` and a CSS `animation: glitch` both setting `opacity` will conflict. Keep them on separate properties or separate elements.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Typewriter animation | Custom interval logic | Established `setInterval` at 55ms/char (from NPCPortraitCard/StandbyView) | Already fully debugged with cleanup; just copy the pattern |
| Glitch effect | New keyframe from scratch | `aggressiveGlitch` from StandbyView.css + CSS custom property randomization | Already has the exact CRT aesthetic; reuse verbatim or with minor adaptation |
| Clip-path wipe reveal | JS-calculated clip values | `portrait-wipe` keyframe pattern from NPCPortraitOverlay.css | `clip-path: inset(0 0 100% 0)` → `inset(0 0 0% 0)` with `cubic-bezier(0.16, 1, 0.3, 1)` is the established wipe |
| Exit animation timing | Polling opacity | `setTimeout` matching CSS animation duration (300ms) + callback | Same technique used in NPCPortraitCard `onDismissed` |
| Stagger delays | JS-computed animation orchestration | CSS `animation-delay` with inline style `index * 75ms` | Already the pattern in StatusSection; no orchestration needed |

**Key insight:** Every animation this phase needs already has an established CSS keyframe or pattern in the codebase. The work is wiring, not invention.

---

## Common Pitfalls

### Pitfall 1: React `setActiveView` Timing Races with Glitch Animation

**What goes wrong:** If `setActiveView` fires during the glitch-out animation, React re-renders with the new view content before the old view has finished animating off, causing a visual flash of the new content underneath the glitch.

**Why it happens:** SSE `onEvent` currently calls `setActiveView` synchronously. Adding an async delay means the SSE data is "pending" while the animation plays.

**How to avoid:** Buffer the incoming SSE data in a ref (`pendingViewDataRef`). The transition hook holds the new data, plays the full outgoing animation, then commits via `setActiveView`. The `transitionLockRef` pattern already in SharedConsole (~line 249) prevents concurrent transitions.

**Warning signs:** New view content briefly visible through the glitch, or glitch cutting short when view changes rapidly.

### Pitfall 2: SVG `opacity` Inline Prop vs CSS Animation

**What goes wrong:** `renderRoom()` sets `opacity={roomOpacity}` as a JSX prop, which becomes an SVG attribute. CSS animations that animate `opacity` cannot override SVG presentation attributes — the SVG attribute wins.

**Why it happens:** CSS specificity: inline/presentation attributes beat stylesheets for SVG properties in some browsers.

**How to avoid:** During the animation window (while `.room-revealing` or `.room-hiding` class is active), do not pass `opacity` as an SVG attribute. Either: (a) omit the prop and let CSS control it entirely, or (b) use `style={{ opacity: undefined }}` during animation, restore after.

**Warning signs:** Room flicker animation plays but room stays at 25% opacity (GM dimmed state), or animation has no visual effect.

### Pitfall 3: Overlay Exit — Component Unmounts Before Animation Completes

**What goes wrong:** Parent state `charonDialogOpen = false` causes the conditional `{charonDialogOpen && <CharonDialog>}` to immediately remove the component from the DOM, so the exit animation never plays.

**Why it happens:** Standard React conditional rendering removes the component synchronously when the condition becomes false.

**How to avoid:** The overlay component must own its own mount lifecycle. Two options:
1. Keep the component always mounted, control visibility with CSS opacity/pointer-events (simpler)
2. Use a "pending close" flag: parent passes `isClosing` prop, overlay plays exit animation, calls `onAnimationComplete`, parent then sets the unmount flag

Option 1 is simpler and matches the document/CHARON dialogs' current structure (they're already always in the tree but hidden via `display:none` or similar logic controlled by `docOverlayOpen`).

**Warning signs:** Dialogs disappear instantly with no exit animation despite CSS being correct.

### Pitfall 4: `animation-iteration-count: 1` vs `forwards` Fill Mode

**What goes wrong:** After a `room-revealing` animation completes, the room group snaps back to its pre-animation opacity state.

**Why it happens:** Without `animation-fill-mode: forwards`, CSS resets to the initial state after the animation ends.

**How to avoid:** All one-shot animations must use `forwards` fill mode. Check that the final keyframe state matches the desired post-animation state (opacity: 1 for revealed rooms).

### Pitfall 5: View Status Overlay Z-Index Stack

**What goes wrong:** The `ViewStatusOverlay` (center-screen boot label) is covered by the view content, or covers interactive elements.

**Why it happens:** SharedConsole renders scanline overlay at `z-index: 10` and various fixed overlays at `z-index: 1000`. The boot label needs to be above the new view content but can be below the scanline.

**How to avoid:** Position at `z-index: 50` — above view content, below scanline overlay and dialog overlays. The overlay is `pointer-events: none` so it doesn't block interaction.

---

## Code Examples

Verified patterns from the codebase (read directly):

### aggressiveGlitch Keyframe (reuse verbatim)
```css
/* Source: src/components/domain/dashboard/StandbyView.css */
@keyframes aggressiveGlitch {
  0%, 88%, 90%, 92%, 100% {
    transform: translate(0, 0) skewX(0deg);
    filter: brightness(1) blur(0px);
  }
  89% {
    transform: translate(var(--glitch-x1), var(--glitch-y1)) skewX(-5deg);
    filter: brightness(1.3) contrast(1.2) blur(1.5px);
  }
  89.5% {
    transform: translate(var(--glitch-x2), var(--glitch-y2)) skewX(5deg);
    filter: brightness(0.7) contrast(1.5) blur(1.5px);
  }
  91% {
    transform: translate(var(--glitch-x3), var(--glitch-y3)) skewX(3deg);
    filter: brightness(1.4) blur(1px);
  }
}
```

For view transition use: run at ~3x speed (duration 300ms instead of 3s), trigger once (`iteration-count: 1`), use `steps(1)` for the flicker burst effect rather than the smooth keyframe timing.

### Portrait Flicker / Dismiss Keyframes (template for overlays)
```css
/* Source: src/components/domain/encounter/NPCPortraitOverlay.css */
@keyframes portrait-flicker {
  0%   { opacity: 1; }
  15%  { opacity: 0; }
  30%  { opacity: 1; }
  50%  { opacity: 0; }
  65%  { opacity: 1; }
  80%  { opacity: 0; }
  100% { opacity: 1; }
}

@keyframes portrait-dismiss {
  from { opacity: 1; transform: scale(1); }
  to   { opacity: 0; transform: scale(0.92); }
}
```

CHARON dialog entrance: use `portrait-flicker` pattern (280ms, `steps(1)`) then stable.
All overlay exits: use `portrait-dismiss` pattern (300ms, `ease-out`).

### Clip-Path Wipe Reveal (for DocumentDialog scan)
```css
/* Source: src/components/domain/encounter/NPCPortraitOverlay.css */
.portrait-image-wrapper.phase-wipe {
  clip-path: inset(0 0 100% 0);
  animation: portrait-wipe 650ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes portrait-wipe {
  from { clip-path: inset(0 0 100% 0); }
  to   { clip-path: inset(0 0 0% 0); }
}
```

For DocumentDialog: apply to `.doc-dialog-container` element. Adjust duration to ~500ms for a slightly slower document scan feel.

### StatusSection Stagger Pattern (template for BridgeView panels)
```css
/* Source: src/components/domain/dashboard/sections/StatusSection.css */
.system-panel.stagger-animate {
  animation: fade-slide-in 0.6s ease backwards;
}
/* Animation delay applied as inline style: animationDelay: `${delay}s` */
```

BridgeView entrance: add `stagger-animate` class to each panel on mount, with `animation-delay` set via `index * 0.1s` inline style. Use `staggerDone` boolean to remove the class after animation completes (same pattern as StatusSection's `staggerComplete` state).

### Radial Vignette Backdrop (for overlay backdrop replacement)
```css
/* New pattern — replaces uniform rgba backdrop */
.overlay-backdrop {
  background: radial-gradient(
    ellipse at center,
    transparent 0%,
    rgba(0, 0, 0, 0.7) 60%,
    rgba(0, 0, 0, 0.92) 100%
  );
  animation: backdropVignette 500ms ease-out forwards;
}

@keyframes backdropVignette {
  from {
    background: radial-gradient(
      ellipse at center,
      transparent 0%,
      rgba(0, 0, 0, 0) 100%
    );
  }
  to {
    background: radial-gradient(
      ellipse at center,
      transparent 0%,
      rgba(0, 0, 0, 0.7) 60%,
      rgba(0, 0, 0, 0.92) 100%
    );
  }
}
```

Note: `background` is not animatable via CSS transitions in all browsers, but `@keyframes` on `background` works for gradient-to-gradient if both frames use identical gradient syntax. Alternative: animate a pseudo-element using `opacity` with a fixed `radial-gradient` background — more reliable cross-browser.

---

## State of the Art

| Old Approach | Current Approach | Change | Impact |
|--------------|------------------|--------|--------|
| `scaleIn` 0.2s scale-fade on all overlays | Per-overlay atmospheric entrance (scan wipe, flicker, typewriter) | This phase | Stronger CRT identity per overlay type |
| Direct `setActiveView` on SSE event | Buffered `pendingViewData` with transition hook | This phase | ~400ms glitch transition instead of instant swap |
| `opacity={roomOpacity}` inline SVG attr | CSS class `.room-revealing` / `.room-hiding` during animation | This phase | Animated room reveal/hide |
| Bridge panels appear instantly | Staggered `fade-slide-in` on mount | This phase | Boot-up atmosphere matching StatusSection pattern |

**Deprecated/outdated (to be replaced):**
- `docFadeIn` + `docScaleIn` keyframes in DocumentDialog.css: replaced with scan reveal
- `fadeInBackdrop` + `scaleIn` in CharonDialog.css: replaced with flicker entrance
- `commFadeInBackdrop` + `commScaleIn` in CommTerminalDialog.css: replaced with typewriter cascade

---

## Open Questions

1. **CommTerminal typewriter-in implementation complexity**
   - What we know: the dialog has a sidebar (message list) + main panel (message body). "Typewriter-in from top" could mean: the whole dialog clip-path wipes down, or individual terminal log lines appear one-by-one.
   - What's unclear: does "cascade in as if being received live" mean the actual message list items animate in sequentially, or is it a visual effect on the container?
   - Recommendation: Apply the clip-path wipe to the container (same as DocumentDialog scan), then have the message list items fade in with stagger. Simpler implementation, same visual result. Avoids complex per-item animation state.

2. **View transition during rapid SSE updates**
   - What we know: SSE can deliver multiple events in quick succession (e.g., GM rapidly changing views). `transitionLockRef` in SharedConsole is designed to block concurrent transitions.
   - What's unclear: Should pending SSE view changes be queued or dropped while a transition plays?
   - Recommendation: Drop (not queue). If a new view change arrives during a transition, cancel the in-progress animation and immediately apply the new view. This matches the "signal lost" feel — abrupt is correct.

3. **Token delayed fade-in scope**
   - What we know: "tokens in revealed rooms fade in after the room animation completes (~200ms delay post-room-reveal)"
   - What's unclear: Does this mean ALL tokens in the room, or only tokens that were previously hidden (i.e., tokens placed after room reveal have no animation)?
   - Recommendation: Only animate tokens that transition from hidden → visible (i.e., the room's visibility just changed). Tokens already in a revealed room don't re-animate.

---

## Validation Architecture

`nyquist_validation` is not set in `.planning/config.json` — treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — this is a Vite/React frontend project with TypeScript |
| Config file | `npm run typecheck` (TypeScript compiler) |
| Quick run command | `npm run typecheck` |
| Full suite command | `npm run build` (catches type errors + build failures) |

This project has no Jest/Vitest test suite. The validation mechanism is TypeScript type checking + visual verification (animations are visual behaviors, not unit-testable without E2E tooling). The project's existing verification pattern is manual visual review after `npm run dev`.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANIM-VIEW | View glitch-out plays on viewType change | manual-visual | `npm run typecheck` | N/A |
| ANIM-OVERLAY | Overlay entrance/exit animations play | manual-visual | `npm run typecheck` | N/A |
| ANIM-ROOM | Room reveal/hide flicker animation | manual-visual | `npm run typecheck` | N/A |
| ANIM-BRIDGE | Bridge panel stagger on entrance | manual-visual | `npm run typecheck` | N/A |
| ANIM-TYPES | No TypeScript errors in new hooks/components | automated | `npm run typecheck` | ✅ |

Animation behaviors are inherently visual and cannot be meaningfully unit-tested without an E2E browser environment. TypeScript checking ensures correctness of the animation state machine types and hook signatures.

### Sampling Rate
- **Per task commit:** `npm run typecheck`
- **Per wave merge:** `npm run build`
- **Phase gate:** TypeScript clean + visual verification in browser before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/hooks/useViewTransition.ts` — new file, covers ANIM-VIEW
- [ ] `src/components/ui/ViewStatusOverlay.tsx` + `.css` — new file, covers ANIM-VIEW boot label

*(Existing CSS and TSX files are modified, no new test infrastructure needed beyond TypeScript compiler.)*

---

## Sources

### Primary (HIGH confidence)
- Direct file reads: `src/components/domain/encounter/NPCPortraitCard.tsx` — AnimPhase state machine, timing constants (280ms flicker, 650ms wipe, 55ms/char)
- Direct file reads: `src/components/domain/encounter/NPCPortraitOverlay.css` — portrait-flicker, portrait-wipe, portrait-dismiss keyframes
- Direct file reads: `src/components/domain/dashboard/StandbyView.css` — aggressiveGlitch keyframe, CSS custom property randomization pattern
- Direct file reads: `src/components/domain/dashboard/StandbyView.tsx` — randomizeGlitchDirection pattern
- Direct file reads: `src/entries/SharedConsole.tsx` — TransitionState type, transitionLockRef, SSE onEvent callback structure, GSAP tab transition (~line 804-823)
- Direct file reads: `src/utils/transitionCoordinator.ts` — withTransitionLock, waitForViewRender patterns
- Direct file reads: `src/components/domain/encounter/EncounterMapRenderer.tsx` — renderRoom function, roomOpacity inline prop, `.encounter-map__room-group` class
- Direct file reads: `src/components/domain/DocumentDialog.css`, `CharonDialog.css`, `CommTerminalDialog.css` — current `scaleIn` animations to be replaced
- Direct file reads: `src/components/domain/dashboard/sections/StatusSection.css/.tsx` — stagger-animate pattern with animationDelay inline style

### Secondary (MEDIUM confidence)
- `src/components/domain/maps/GalaxyMap.css` — galaxyMapFadeIn/Out pattern for class-based transition states

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all tooling verified by reading actual source files
- Architecture patterns: HIGH — all patterns extracted directly from production code in this repo
- Pitfalls: HIGH — derived from actual code structures (SVG inline opacity vs CSS, conditional rendering timing)
- Animation keyframe values: HIGH — exact values read from source CSS files

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable — CSS/React patterns don't change rapidly; GSAP 3.14 API stable)
