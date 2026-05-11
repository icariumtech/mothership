# Plan 21-04 — Resolved: Corridor Door Reveal Regression

**Date triaged:** 2026-05-11
**Date resolved:** 2026-05-11
**Branch:** worktree-agent-a371ca947926a348c
**Status:** resolved

## Root cause

`terminal/views.py:305-311` (`ship_deck_data` builder, served by the active-view endpoint that drives the bridge dashboard) constructed `current_deck` with a hand-listed subset of fields — `deck_id`, `name`, `unit_size`, `rooms` — and dropped everything else.

Pre-21-04 doors lived nested inside `rooms[*].doors[]`, so they piggybacked on the `rooms` field. After plan 21-04 migrated authoring to top-level deck `doors:`, the `current_deck` hand-listing silently stopped carrying them. `shipDeckData.current_deck.doors` arrived `undefined` at the renderer, `canonicalDoors` resolved to `[]`, and `StatusSection`'s player-side ship schematic rendered no doors at any visibility state.

The encounter view (`api_encounter_map_data`) was unaffected — it already used the spread form `{**default_deck, 'deck_id': default_deck['id']}` which carries all fields, including the new `doors`.

## Fix

`terminal/views.py:305-311` → `current_deck = {**default_deck, 'deck_id': default_deck['id']}`

Mirrors the spread form already used in `api_encounter_map_data`. Future deck-level field additions auto-propagate.

## Cleanup

Removed the runtime ANOMALY logger from `EncounterMapRenderer.tsx` (added during triage). The 15-case vitest regression suite at `corridorDoorVisibility.test.ts` remains — it locks in the renderer-layer contract for all three migrated map shapes.

## Verification

- `npx vitest run` — 137/137 pass (15 corridor cases still green)
- `npx tsc --noEmit` — clean
- `npx vite build` — clean
- Manual re-verification by user pending: GM reveals a corridor in the encounter panel, player's bridge status panel ship schematic now shows the connecting doors.
