# Phase 25: Map rotation controls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 25-map-rotation-controls
**Areas discussed:** Control form, Map scope, Rotation axes / interaction, Reset / orientation

---

## Control Form

| Option | Description | Selected |
|--------|-------------|----------|
| On-screen overlay buttons | Small buttons overlaid on the map — rotate-left, rotate-right, and optionally tilt. Always visible or show on hover. | ✓ |
| Keyboard shortcuts only | Arrow keys or WASD for rotation. No visible UI — power-user only. | |
| Both — overlay + keyboard | Overlay buttons + keyboard shortcuts. | |

**User's choice:** On-screen overlay buttons.
**Notes:** Intended for a large touch TV — overlay buttons are required.

---

## Button position

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom-center | Easy thumb reach on tablet/phone. | |
| Bottom-right corner | Minimal footprint. | |
| Top-right corner | Near existing navigation elements. | |
| Top-center (free-text) | Top placement for touch TV. | ✓ |

**User's choice:** Top-center.
**Notes:** "This is going to be interacted with on a touch TV" — top-center was user-specified via free-text. Generous touch targets implied.

---

## Map scope / What "rotation controls" actually means

The user clarified that this phase is not about camera rotation at all — the existing drag/touch already handles that. The phase is about **playback/time controls**:

| Map | Control |
|-----|---------|
| Galaxy | Play/pause toggle for the auto-rotation animation (camera stays put) |
| System | Play/pause toggle for planet orbit animations + horizontal scrub bar (active when paused) |
| Orbit | Play/pause toggle for moon/station orbit animations + same scrub bar |

**Notes:** The user initially described this as a "continuous wheel" for scrubbing. Evolved into a horizontal drag zone (scrub bar) after discussion.

---

## Scrub bar interaction

| Option | Description | Selected |
|--------|-------------|----------|
| 0–360° of reference orbit | One full cycle of longest-orbit body. | |
| Continuous (multiple laps) | Advances time indefinitely. | |
| Real-time clock-based | Slider maps to in-game date/time. | (initial) |
| Continuous drag wheel | Swiping right/left advances/reverses. Not tied to a specific orbit. | ✓ |

**User's choice:** Continuous drag wheel — then refined to "horizontal scrub bar."
**Notes:** User initially wanted real-time clock-based position, then reconsidered: "can we just make it like a continuous wheel, there I can just swipe it right to advance the orbits or left to reverse."

---

## Scrub speed calibration

| Option | Description | Selected |
|--------|-------------|----------|
| Full swipe = one orbit of shortest-period body | Natural calibration. | (similar) |
| Configurable in YAML | Per-system `scrub_speed` field. | |
| Fixed 1px = 1 degree | Predictable but may feel slow. | |
| Adaptive (free-text) | Take into account shortest/longest orbit; if body selected, calibrate to that body. | ✓ |

**User's choice:** Adaptive — "take into account the difference between the shortest and longest orbits but if a specific planet is selected then adjust the wheel to that planet's orbital period."

---

## Play/pause + scrub relationship

| Option | Description | Selected |
|--------|-------------|----------|
| Wheel replaces live animation | No auto-play; wheel is the only way to advance. | |
| Alongside — hold to pause | Auto-plays; grabbing wheel pauses; releasing resumes. | |
| Both + wheel disabled when playing | Play/pause button; scrub bar disabled unless paused. | ✓ |

**User's choice:** "Have both the play/pause button and the wheel is disabled unless the orbits are paused."

---

## Scrub bar visual style

| Option | Description | Selected |
|--------|-------------|----------|
| Circular dial / knob | Drag clockwise/counter-clockwise. | |
| Horizontal scrub bar with drag zone | Wide horizontal track to slide left/right. | ✓ |
| Two arc arrows (hold down) | Hold to advance/reverse; speed increases with hold duration. | |

**User's choice:** Horizontal scrub bar with drag zone.

---

## Layout

| Option | Description | Selected |
|--------|-------------|----------|
| ⏸ button left of scrub bar | One row: `[ ⏸ |==drag zone==| ]`. | ✓ |
| Play/pause above scrub bar | Stacked vertically. | |
| Scrub bar hidden when playing | Appears only on pause. | |

**User's choice:** ⏸ button left of scrub bar — compact single row.

---

## Reset / orientation

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — reset button | Returns bodies to default positions. | |
| No — navigation resets naturally | Leaving + re-entering reloads default positions. | ✓ |

**User's choice:** No explicit reset button.

---

## Claude's Discretion

- Exact CSS for the scrub bar drag zone (cursor, thumb styling)
- Whether play/pause button shows label alongside icon or icon only
- Exact `top` offset so the overlay clears the tab/nav bar
- Whether any position feedback (tooltip showing estimated angle) is shown during scrub
- Internal implementation of scrub offset accumulation (useRef vs useState, angle vs time delta)

## Deferred Ideas

- **Campaign date/time system:** User initially wanted real-time clock-based position — deferred in favor of simpler continuous scrub model. Could be added later.
- **Reset button for orbital positions:** Deferred — navigation naturally resets. Could revisit if far-scrubbed positions become disorienting.
