# Phase 2: Ship Status Dashboard - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Bridge STATUS tab displaying real-time ship systems and operational state. GM can toggle system states from the GM Console, and players see animated status changes on the terminal. Covers: ship identity, hull/armor, 4 ship systems with 5-tier status, crew count, and GM controls.

</domain>

<decisions>
## Implementation Decisions

### Dashboard layout
- Top-down ship schematic as visual centerpiece (blueprint-style overhead view)
- Ship identity info (name, class, hull/armor, crew) overlaid on/adjacent to the schematic
- 4 system panels flanking the schematic — 2 on each side (Left: Life Support + Engines, Right: Weapons + Comms)
- Layout inspired by encounter map views — image-centric with data panels around it

### System state display
- 5 states per system: Online / Stressed / Damaged / Critical / Offline
- Each panel shows: status text label (color-coded) + condition bar below
- Brief info line per system (1-2 lines of flavor context, e.g., "Thrust capacity: 80%", "O2: nominal")
- Hull: visual bar showing current/max plus numeric value (e.g., "HULL: 45/60")
- Armor: bar + numeric display alongside hull

### Status animations
- Moderate transition drama: color change + brief flicker/flash on affected panel when state changes
- Persistent pulse: critical systems gently pulse, offline systems dim/grayed — ongoing visual reminder
- No visual effects on ship schematic from hull damage (schematic stays clean)
- Staggered reveal on tab load: ship schematic fades in, then panels appear one by one (boot-up sequence feel)

### Claude's Discretion
- GM toggle control design (how GM changes system states in GM Console)
- Exact color mapping for each of the 5 states
- Ship schematic art style and positioning details
- Pulse timing and flicker implementation
- Staggered reveal timing and easing
- Panel border/styling details within CRT aesthetic

</decisions>

<specifics>
## Specific Ideas

- Ship schematic should feel like a technical blueprint/overhead diagram — not a realistic render
- Boot-up stagger on tab load reinforces the "systems coming online" feel
- Persistent pulse on critical systems creates mounting tension during gameplay without being distracting
- Layout mirrors encounter view pattern: central image with surrounding data panels

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-ship-status-dashboard*
*Context gathered: 2026-02-12*
