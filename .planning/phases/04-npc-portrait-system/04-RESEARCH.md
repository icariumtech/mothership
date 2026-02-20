# Phase 4: NPC Portrait System - Research

**Researched:** 2026-02-19
**Domain:** Full-stack overlay UI — Django ActiveView state, React CSS animations, CSS-driven CRT effects
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Portrait placement & layout**
- Centered modal overlay — portrait appears over the encounter map with a dimmed background
- Name only shown — no description block or stats, just the NPC name beneath the image
- GM-only dismiss — players cannot close portraits; only the GM can dismiss from the console
- Image size: Claude's discretion (size it for visual impact within the centered modal)
- CRT scanline overlay on portrait image — original colors preserved, scanlines + vignette add atmosphere (not full amber conversion)
- Chamfered panel border around the portrait modal — matches existing design system angular style

**GM trigger flow**
- GM console NPC list — a section within the encounter view area of the GM console lists all campaign NPCs (not just encounter tokens — useful for off-map speaking characters)
- Click NPC name to show portrait on terminal; click again to dismiss (toggle behavior)
- NPC portrait panel is contextual to encounter view — appears in GM console when encounter view is active

**Multiple portrait behavior**
- Portraits tile side by side horizontally across the center of the screen
- No hard limit — GM can show as many as needed; layout adapts
- New portraits animate in alongside existing ones — all portraits reflow/rearrange with animation when one is added or removed
- When all portraits dismissed, overlay fades out smoothly — no snap

**Reveal animation**
- Image reveal: scan/wipe from top to bottom (CRT powering on effect)
- Then name types out below using typewriter effect (two-beat: image first, then name)
- Brief CRT flicker before the image stabilizes (like a monitor powering on)
- Overall pace: deliberate — 1–2 seconds total for the reveal sequence

### Claude's Discretion
- Exact image size within the centered modal
- CRT flicker implementation (CSS animation, brief opacity pulses)
- Scanline overlay implementation (CSS pseudo-element or SVG filter)
- Transition timing curve for the wipe reveal
- How portraits reflow when multiple are shown (flex layout, animation easing)
- Typewriter speed for the name reveal

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PORT-01 | GM can trigger an NPC portrait display on the terminal | NPC list in EncounterPanel (GM console); toggle API endpoint stores active portrait IDs in ActiveView JSONField |
| PORT-02 | Portrait panel shows NPC name and basic info with CRT/amber styling | NPCPortraitOverlay component; CSS scanline pseudo-element + chamfered Panel border; amber name text |
| PORT-03 | Portrait appears as overlay during encounter view without obscuring map | `position: fixed` overlay with `z-index` above EncounterView; dimmed backdrop; EncounterView untouched |
| PORT-04 | Multiple portraits can display simultaneously for group conversations | `encounter_active_portraits` JSONField (array of NPC IDs); flex-row layout with reflow animation |
| PORT-05 | Portrait reveal uses animated typewriter name and fade-in effect | Two-phase CSS animation: clip-path wipe (image) then existing typewriter pattern (name) |
</phase_requirements>

---

## Summary

Phase 4 is a display-layer feature built on existing project infrastructure. The NPC data already exists in `data/campaign/npcs.yaml`, and the DataLoader already has `load_npcs()`. The GM Console already loads NPC data (passed to the frontend in `INITIAL_DATA`). No new Django models are needed — one new JSONField on `ActiveView` (`encounter_active_portraits`) stores the ordered list of NPC IDs currently being displayed.

The terminal display side is a new React component (`NPCPortraitOverlay`) rendered as a `position: fixed` overlay on top of `EncounterView` in `SharedConsole.tsx`. The overlay is driven by polling: the existing 2-second poll of `/api/active-view/` already delivers everything needed — we extend the response to include the active portrait list plus NPC data.

The animation work is pure CSS. The CRT wipe reveal uses a `clip-path` from `inset(0 0 100% 0)` to `inset(0 0 0 0)` — no external animation libraries needed. CRT flicker is 3–4 opacity pulses at ~100ms intervals before the wipe begins. The typewriter effect reuses the existing `typewriterUtils.ts` pattern (character-by-character via `useEffect`/`useRef` interval). Portraits reflow with `flex` layout and CSS `transition: all 300ms ease`.

**Primary recommendation:** Add `encounter_active_portraits` JSONField to `ActiveView`, expose it in the active-view API response, add a GM-facing NPC list with toggle buttons inside the existing `EncounterPanel`, and render `NPCPortraitOverlay` in `SharedConsole` alongside the existing `EncounterView`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | Already installed | Component rendering, state, effects | Project standard |
| CSS animations | Native | Wipe reveal, flicker, fade | No extra deps; fine-grained control |
| Existing typewriterUtils.ts | Project util | Character-by-character name reveal | Matches typewriter pattern from Phase 1/2 |
| Django JSONField | Already in use | Store active portrait IDs in ActiveView | Same pattern as `encounter_tokens` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Ant Design 6.1 | Already installed | NPC list in GM console | Use `List`, `Button` matching existing EncounterPanel style |
| Panel component | Project UI | Chamfered border around portrait modal | Use `chamferCorners={['tl', 'tr', 'bl', 'br']}` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS clip-path wipe | CSS `height` animation | clip-path is more CRT-accurate; height causes layout shift |
| CSS flicker | Framer Motion / GSAP | Pure CSS is lighter; no new dependency; sufficient for 3–4 opacity pulses |
| Inline typewriter | TypewriterController (R3F) | TypewriterController is tied to the Canvas RAF loop; portrait names are short (not synchronized with 3D scene); a simple `useEffect` interval is appropriate |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/domain/encounter/
│   ├── NPCPortraitOverlay.tsx    # New: full-screen overlay rendering portrait cards
│   ├── NPCPortraitCard.tsx       # New: single portrait (image + name + CRT effects)
│   └── NPCPortraitOverlay.css    # New: all overlay/card/animation styles
├── components/gm/
│   └── EncounterPanel.tsx        # Extend: add NPC portrait trigger section
├── services/
│   └── encounterApi.ts           # Extend: add togglePortrait() method
└── types/
    └── gmConsole.ts              # Extend: add encounter_active_portraits to ActiveView type
```

**Django side:**
```
terminal/
├── models.py     # Extend ActiveView: add encounter_active_portraits JSONField
├── views.py      # Extend get_active_view_json: include encounter_active_portraits + NPC data
│                 # Add: api_encounter_toggle_portrait (GM-only POST)
│                 # Add: api_encounter_get_npcs (serve full NPC list with portrait URLs)
└── urls.py       # Register 2 new endpoints
```

### Pattern 1: ActiveView JSONField for Portrait State

Follow the exact pattern of `encounter_tokens` — an ordered list of NPC IDs:

```python
# models.py addition to ActiveView
encounter_active_portraits = models.JSONField(
    default=list,
    blank=True,
    help_text='Ordered list of NPC IDs currently displayed as portraits'
)
```

Toggle endpoint logic (mirrors existing token patterns):

```python
@login_required
def api_encounter_toggle_portrait(request):
    # POST { npc_id: string }
    active_view = ActiveView.get_current()
    portraits = list(active_view.encounter_active_portraits or [])

    npc_id = data.get('npc_id')
    if npc_id in portraits:
        portraits.remove(npc_id)      # dismiss
    else:
        portraits.append(npc_id)      # show

    active_view.encounter_active_portraits = portraits
    active_view.updated_by = request.user
    active_view.save()

    return JsonResponse({'success': True, 'active_portraits': portraits})
```

### Pattern 2: Extending active-view API response

The SharedConsole polls `/api/active-view/` every 2 seconds. Extend `get_active_view_json` to include portrait state plus NPC data (so no second API call is needed):

```python
# In get_active_view_json, add:
response['encounter_active_portraits'] = list(active_view.encounter_active_portraits or [])

# Include NPC data when portraits are active (avoids separate API call)
if response['encounter_active_portraits']:
    loader = DataLoader()
    npcs = loader.load_npcs()
    # Build lookup keyed by id
    npc_map = {npc['id']: npc for npc in npcs}
    response['encounter_npc_data'] = npc_map
```

Alternatively, always include NPC data (simpler, negligible overhead for ~4 NPCs).

### Pattern 3: NPCPortraitOverlay Component

Rendered in `SharedConsole.tsx` alongside `EncounterView`, inside the outer `<>` fragment:

```tsx
{viewType === 'ENCOUNTER' && activePortraitIds.length > 0 && (
  <NPCPortraitOverlay
    portraitIds={activePortraitIds}
    npcData={npcDataMap}
  />
)}
```

The overlay is `position: fixed, z-index: 10` (above the `encounter-view` at `z-index: 0`, below the `scanline-overlay` at `z-index: 9999`).

### Pattern 4: Portrait Card Animation Sequence

Each `NPCPortraitCard` manages its own reveal animation via `useState` + `useEffect`. The component mounts once the portrait ID appears in the list:

```
Mount → "flicker" phase (300ms, 3 opacity pulses via CSS keyframe)
      → "wipe" phase (600ms, clip-path: inset(0 0 100% 0) → inset(0 0 0% 0))
      → "stable" phase (image fully visible)
      → "typing" phase (name types out character by character, ~60ms/char)
      → "done" phase (all visible, idle)
```

State machine implemented with a single `animPhase` useState: `'flicker' | 'wipe' | 'stable' | 'typing' | 'done'`.

CSS class drives the visual:
```css
.portrait-image.phase-flicker  { animation: portrait-flicker 300ms steps(1); }
.portrait-image.phase-wipe     { animation: portrait-wipe 600ms ease-in forwards; }
.portrait-image.phase-stable   { clip-path: none; opacity: 1; }

@keyframes portrait-flicker {
  0%, 100% { opacity: 1; }
  20%       { opacity: 0; }
  40%       { opacity: 1; }
  60%       { opacity: 0; }
  80%       { opacity: 1; }
}

@keyframes portrait-wipe {
  from { clip-path: inset(0 0 100% 0); }
  to   { clip-path: inset(0 0 0% 0); }
}
```

### Pattern 5: Typewriter for Portrait Name

Reuse the character-interval pattern (matching the existing typewriter implementation approach, but standalone — not coupled to the Canvas RAF loop since portrait names are short and independent of 3D scenes):

```tsx
// Inside NPCPortraitCard, when animPhase === 'typing':
useEffect(() => {
  if (animPhase !== 'typing') return;
  let i = 0;
  const timer = setInterval(() => {
    i++;
    setDisplayedName(npcName.slice(0, i));
    if (i >= npcName.length) {
      clearInterval(timer);
      setAnimPhase('done');
    }
  }, 55); // ~55ms per char — deliberate pace
  return () => clearInterval(timer);
}, [animPhase, npcName]);
```

### Pattern 6: Reflow Animation for Multiple Portraits

Portraits wrap in a `display: flex, gap: 24px, justify-content: center` container. CSS `transition` handles reflow automatically when cards are added/removed:

```css
.portrait-overlay-tray {
  display: flex;
  flex-direction: row;
  gap: 24px;
  justify-content: center;
  align-items: flex-end;
  transition: all 300ms ease;
}
```

New cards mount (React adds to DOM) and get their enter animation. Removed cards need a brief unmount delay so a fade-out can play before the card leaves the DOM — use a `dismissing` state on the card, trigger CSS fade, then actually remove from the active list after 300ms.

However, note that **only the GM can dismiss** — dismiss happens via API call, which updates `encounter_active_portraits`. The terminal (player view) is read-only. So the "dismissing" animation state only needs to be handled on the terminal side when a portrait ID disappears from the polled data.

### Pattern 7: GM Console NPC List in EncounterPanel

Add a new `Card` section at the bottom of `EncounterPanel.tsx` (after the existing ROOM VISIBILITY card), but only when `isActive` is true. The section:

1. On mount (when encounter becomes active), fetch NPCs from `/api/encounter/npcs/` — OR simply have NPCs pre-loaded via `activeView` (since they're small data).
2. Render a `List` of NPC names with portrait toggle buttons.
3. Highlight button when that NPC ID is in `activeView.encounter_active_portraits`.

```tsx
// Inside EncounterPanel render, add new Card:
<Card
  size="small"
  title={<Text style={{ color: '#5a7a7a' }}>NPC PORTRAITS</Text>}
  style={{ marginBottom: 16, background: '#1a1a1a' }}
>
  {npcs.map(npc => (
    <div key={npc.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
      <Text style={{ fontSize: 12 }}>{npc.name}</Text>
      <Button
        size="small"
        type={activePortraits.includes(npc.id) ? 'primary' : 'default'}
        style={activePortraits.includes(npc.id) ? { background: '#8b7355', borderColor: '#8b7355' } : {}}
        onClick={() => handleTogglePortrait(npc.id)}
      >
        {activePortraits.includes(npc.id) ? 'DISMISS' : 'SHOW'}
      </Button>
    </div>
  ))}
</Card>
```

### Pattern 8: CRT Scanline + Vignette on Portrait Image

CSS pseudo-element approach — no SVG needed, no extra DOM nodes:

```css
.portrait-image-wrapper {
  position: relative;
}

.portrait-image-wrapper::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(
      to bottom,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.12) 2px,
      rgba(0, 0, 0, 0.12) 4px
    ),
    radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%);
  pointer-events: none;
  z-index: 1;
}
```

This matches the global `.scanline-overlay` pattern already in `global.css`. Original image colors preserved — only scanlines + vignette applied via the overlay.

### Anti-Patterns to Avoid

- **Don't animate layout properties** (`width`, `height`) for the wipe — causes reflow. Use `clip-path` which is GPU-composited.
- **Don't couple portrait typewriter to TypewriterController/Zustand** — portrait names are short, fire-and-forget; the Canvas RAF synchronization overhead is unnecessary.
- **Don't store NPC portrait state in frontend-only React state** — it must go through `ActiveView` so polling propagates to all connected terminals.
- **Don't use a separate polling loop for portraits** — the existing 2-second active-view poll handles it.
- **Don't use Ant Design Modal for the portrait overlay** — `position: fixed` CSS gives more control over the CRT-style presentation and avoids Modal's built-in animations.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS scanline effect | Custom SVG filter | CSS `repeating-linear-gradient` pseudo-element | Already used in `global.css`; consistent |
| State persistence | React localStorage | Django ActiveView JSONField | Matches all prior phases; propagates to all terminals |
| Animation timing | JavaScript `setTimeout` chains | CSS `animation` + React phase state | CSS animations are composited by browser; no JS timer drift |
| NPC data loading | New data file format | Existing `data_loader.load_npcs()` | Already implemented; npcs.yaml already has portrait paths |

---

## Common Pitfalls

### Pitfall 1: Portrait Image Path Resolution

**What goes wrong:** NPC portrait paths in `npcs.yaml` are stored as `/data/campaign/NPCs/images/lucia_vance.png`. Django serves the `data/` directory as static (confirmed: `api_encounter_token_images` returns these paths directly). However, the leading `/` might need to map to a Django static or media URL.

**Why it happens:** The path format `/data/...` appears to be used elsewhere (token images), but the actual Django static file serving configuration must be confirmed.

**How to avoid:** Check how `Token.tsx` renders NPC portrait images (the `image_url` field uses the same path format). Reuse the exact same `<img src={imageUrl} />` pattern already working in `Token.tsx`.

**Warning signs:** Images display as broken in portrait overlay but work in token layer — indicates a URL prefix issue specific to the portrait overlay.

### Pitfall 2: `encounter_active_portraits` Reset on View Switch

**What goes wrong:** When the GM switches away from ENCOUNTER view and back, portraits from the previous encounter remain active.

**Why it happens:** `encounter_tokens` is cleared on `api_switch_view` when switching to a new encounter location. Portraits should follow the same rule.

**How to avoid:** In `api_switch_view`, when `is_new_encounter_location` is true, also clear `encounter_active_portraits`:
```python
active_view.encounter_active_portraits = []
```

### Pitfall 3: Overlay Z-Index Conflict

**What goes wrong:** Portrait overlay appears behind the scanline overlay or behind CHARON dialog.

**Why it happens:** `global.css` sets `.scanline-overlay { z-index: 9999 }`. CHARON dialog uses Ant Design's Modal (z-index 1000+). Portrait overlay must sit between the encounter map (z-index 0) and the scanline (z-index 9999).

**How to avoid:** Set `NPCPortraitOverlay` to `z-index: 100`. This puts it: above encounter map (0), above any map UI (10-50), below scanline (9999), and below CHARON modal. Verify scanline overlay renders visually on top of the portrait (the scanline effect applies uniformly to everything below it, which is correct behavior).

### Pitfall 4: Animation Replay on Poll Update

**What goes wrong:** Every time the polling loop updates `encounter_active_portraits`, already-visible portraits re-trigger their reveal animation.

**Why it happens:** If `NPCPortraitCard` uses `key={npcId}` properly, React will NOT remount stable entries — it only mounts new cards. The key is ensuring `key` is the NPC ID and the portrait list is stable (same IDs remain mounted).

**How to avoid:** Always use `key={npc.id}` on `NPCPortraitCard` elements. React's reconciliation will preserve existing mounted cards unchanged and only mount new ones.

### Pitfall 5: `clip-path` Animation on `<img>` in Safari

**What goes wrong:** Safari may not smoothly animate `clip-path` on certain elements.

**Why it happens:** Safari has historically had issues with `clip-path` transitions on `img` elements directly.

**How to avoid:** Apply the clip-path animation to a wrapper `<div>` containing the `<img>`, not the `<img>` directly. The wrapper `div.portrait-image-wrapper` gets `clip-path` animation; the `img` fills 100% of the wrapper.

---

## Code Examples

### Verified pattern: How encounter_tokens is stored and propagated

From `models.py` (confirmed HIGH confidence — read directly):
```python
encounter_tokens = models.JSONField(
    default=dict,
    blank=True,
    help_text='Map of token_id -> token data for encounter tokens'
)
```

From `views.py` `get_active_view_json` (confirmed):
```python
response['encounter_tokens'] = active_view.encounter_tokens or {}
```

From `SharedConsole.tsx` poll handler (confirmed):
```tsx
if (data.encounter_tokens && !tokenMoveInFlight.current) {
  setEncounterTokens(data.encounter_tokens);
}
```

Portrait system follows this exact pattern with `encounter_active_portraits` as a list instead of dict.

### Verified pattern: NPC data structure (from npcs.yaml)

```yaml
- id: "lucia_vance"
  name: "Dr. Lucia Vance"
  role: "Station Director"
  portrait: "/data/campaign/NPCs/images/lucia_vance.png"
  status: "ACTIVE"
```

Key fields needed: `id`, `name`, `portrait`. Role/faction available but not displayed (name-only per decision).

### Verified pattern: Overlay positioning above encounter map

From `EncounterView.css` (confirmed):
```css
.encounter-view {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #000;
  z-index: 0;
}
```

Portrait overlay must use `position: fixed` with `z-index: 100`.

### Verified pattern: Chamfered panel border

The existing `Panel` component supports full chamfering:
```tsx
<Panel
  chamferCorners={['tl', 'tr', 'bl', 'br']}
  chamferSize={12}
  className="portrait-panel"
>
  {/* portrait content */}
</Panel>
```

### Service method pattern (from encounterApi.ts)

```typescript
// Add to encounterApi.ts:
async togglePortrait(npcId: string): Promise<{ success: boolean; active_portraits: string[] }> {
  const response = await api.post('/api/gm/encounter/toggle-portrait/', { npc_id: npcId });
  return response.data;
}
```

### NPC list endpoint pattern (from views.py api_encounter_token_images)

```python
@login_required
def api_encounter_get_npcs(request):
    loader = DataLoader()
    npcs = loader.load_npcs()
    return JsonResponse({'npcs': npcs})
```

Or simpler: include NPC data directly in the active-view response when `encounter_active_portraits` is non-empty, avoiding a separate endpoint altogether. The active-view response is already the central data source for the terminal.

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| CSS `height: 0 → auto` wipe | `clip-path: inset(0 0 100% 0 → 0)` wipe | clip-path is GPU-composited, no layout recalculation |
| JS `setTimeout` animation chains | CSS `animation` with React phase state | Browser handles compositor; JS only manages phase transitions |
| Separate polling endpoint | Piggyback on existing active-view poll | 2s poll already running; no new infrastructure |

---

## Open Questions

1. **NPC data delivery to terminal**
   - What we know: NPC data is available via `DataLoader.load_npcs()`. The terminal currently receives NPC data via `window.INITIAL_DATA` (set at page load in `display_view_react`). However, this is stale if the GM adds NPCs during a session.
   - What's unclear: Should portrait NPC data be included in the active-view poll response, or rely on the page-load `INITIAL_DATA`?
   - Recommendation: Include `encounter_active_portraits` (list of IDs) in the poll response, and include a small NPC lookup map (id → {name, portrait}) always in the poll response, or only when portraits are active. Since `npcs.yaml` has only ~4 entries, always including it is simplest.

2. **Portrait image file existence validation**
   - What we know: NPCs without portraits (e.g., `dr_yuki_tanaka` has no `portrait` field) must be handled gracefully.
   - What's unclear: Should NPCs without portrait images appear in the GM list at all?
   - Recommendation: Show all NPCs in the GM list regardless. For NPCs without portraits, show a placeholder panel with just the name (or a default silhouette). The GM can still use it to type-out a name reveal even without an image.

3. **Portrait dismiss animation on player terminal**
   - What we know: When GM removes an NPC from `encounter_active_portraits`, the polled data will no longer include that ID, causing React to unmount the card immediately.
   - What's unclear: Whether a fade-out animation should play before the card unmounts on the terminal side.
   - Recommendation: Use an "exit animation" pattern — when an ID disappears from the list, don't immediately remove the card; instead track it in a local `leavingIds` set, play a 300ms fade-out CSS animation, then clean up. This gives a smooth exit without snapping.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `/home/gjohnson/mothership/charon/terminal/models.py` — ActiveView JSONField pattern for `encounter_tokens`
- Direct code inspection: `/home/gjohnson/mothership/charon/terminal/views.py` — `get_active_view_json`, `api_encounter_toggle_room`, `api_encounter_place_token`
- Direct code inspection: `/home/gjohnson/mothership/charon/src/entries/SharedConsole.tsx` — polling loop, EncounterView rendering
- Direct code inspection: `/home/gjohnson/mothership/charon/src/components/gm/EncounterPanel.tsx` — GM console encounter UI pattern
- Direct code inspection: `/home/gjohnson/mothership/charon/data/campaign/npcs.yaml` — NPC data schema
- Direct code inspection: `/home/gjohnson/mothership/charon/src/components/ui/Panel.tsx` — chamfer system
- Direct code inspection: `/home/gjohnson/mothership/charon/src/styles/global.css` — scanline overlay z-index (9999)
- Direct code inspection: `/home/gjohnson/mothership/charon/src/components/domain/encounter/EncounterView.css` — z-index 0

### Secondary (MEDIUM confidence)
- CSS `clip-path` animation for wipe reveal — well-established browser-supported technique; GPU-composited in all modern browsers
- CSS `::after` pseudo-element scanline overlay pattern — same technique as project's existing `.scanline-overlay`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all patterns verified against existing code
- Architecture: HIGH — directly mirrors `encounter_tokens` pattern (proven in Phase 3)
- Animation approach: HIGH — CSS clip-path wipe is well-established; same scanline technique already in project
- Pitfalls: HIGH — all identified from direct code inspection (z-index values, path formats, poll loop behavior)

**Research date:** 2026-02-19
**Valid until:** 2026-04-01 (stable tech; project codebase changes are the main risk)
