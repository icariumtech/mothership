# Phase 4: NPC Portrait System - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

GM can trigger NPC portrait displays on the shared terminal during encounters. Portraits show as atmospheric overlays with animated reveals. Revealing character sheets, editing NPC data, or linking portraits to encounter tokens are separate concerns — this phase is purely the display/trigger system.

</domain>

<decisions>
## Implementation Decisions

### Portrait placement & layout
- Centered modal overlay — portrait appears over the encounter map with a dimmed background
- Name only shown — no description block or stats, just the NPC name beneath the image
- GM-only dismiss — players cannot close portraits; only the GM can dismiss from the console
- Image size: Claude's discretion (size it for visual impact within the centered modal)
- CRT scanline overlay on portrait image — original colors preserved, scanlines + vignette add atmosphere (not full amber conversion)
- Chamfered panel border around the portrait modal — matches existing design system angular style

### GM trigger flow
- GM console NPC list — a section within the encounter view area of the GM console lists all campaign NPCs (not just encounter tokens — useful for off-map speaking characters)
- Click NPC name to show portrait on terminal; click again to dismiss (toggle behavior)
- NPC portrait panel is contextual to encounter view — appears in GM console when encounter view is active

### Multiple portrait behavior
- Portraits tile side by side horizontally across the center of the screen
- No hard limit — GM can show as many as needed; layout adapts
- New portraits animate in alongside existing ones — all portraits reflow/rearrange with animation when one is added or removed
- When all portraits dismissed, overlay fades out smoothly — no snap

### Reveal animation
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

</decisions>

<specifics>
## Specific Ideas

- Atmosphere reference: CRT monitor powering on — flicker → scan wipe → stable image
- The two-beat reveal (image then name) builds tension — players see the face before knowing who it is

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-npc-portrait-system*
*Context gathered: 2026-02-19*
