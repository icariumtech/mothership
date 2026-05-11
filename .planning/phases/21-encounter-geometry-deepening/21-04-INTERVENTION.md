# Plan 21-04 — Open Regression: Corridor Door Reveal

**Date triaged:** 2026-05-11
**Branch:** worktree-agent-a371ca947926a348c
**Status:** unresolved at the logic layer — runtime devtools log required

## Symptom
On the player terminal, when the GM reveals a corridor, doors that connect a room
to that corridor do not become visible. User confirmed on USCSS Morrigan
(`data/campaign/ship/deckplan.yaml`) and Somnus
(`data/galaxy/tau-ceti/somnus/map/main_deck.yaml`).

## Hypotheses Tested (all PASSED — bug not reproduced in tests)

H1 — Normalizer silently drops corridor-shared doors. **Disproven.** Every
authored door in every migrated map normalizes successfully.

H2 — Normalized door coordinates do not lie on the shared edge.
**Disproven.** Covered indirectly by H1 (normalizer throws if not).

H5 — Player-side visibility filter logic is wrong. **Disproven.**
The filter at `EncounterMapRenderer.tsx:1356–1377` was lifted into the test
verbatim. For every corridor-shared door across all three migrated maps,
revealing only the corridor passes the filter.

H6 — Every door touching a corridor renders when ONLY the corridor is
revealed. **Disproven.** The bulk H6 check in
`corridorDoorVisibility.test.ts` covers every authored door across all
three migrated maps; no door is dropped.

H7 — Backend initializes corridor visibility correctly. **Confirmed
correct.** `terminal/views.py:615` sets all room ids — including corridors
— to `False` at encounter start.

## Conclusion
Data + filter logic are correct. The bug must be in a runtime concern not
captured by the unit test:
1. `roomVisibility` prop doesn't propagate the corridor reveal to the
   renderer (SSE / state sync issue).
2. `mapData.doors` arrives empty or stale at the renderer for the player
   path (props/serialization issue).
3. The renderer is mounted twice or with stale memoization.
4. A second copy of the renderer (e.g. dashboard schematic) renders the
   visible map without doors.

## Instrumentation Added (this commit)
`EncounterMapRenderer.tsx` now logs an ANOMALY warning whenever the player
filter drops a door whose endpoint room is currently in the
`roomVisibility` map with value `true`. This will surface the exact runtime
state when the bug reproduces.

Console message:
> `[EncounterMapRenderer 21-04] ANOMALY — door touching revealed room is being dropped`

Object fields logged: `id`, `roomA`, `roomB`, `aVisible`, `bVisible`,
`roomVisibilityA`, `roomVisibilityB`, `revealedRooms`.

## Next Steps (human + devtools)
1. With dev server running, open USCSS Morrigan encounter on the GM
   console and a separate player terminal.
2. Open the browser devtools console on the **player** terminal.
3. GM reveals `corridor_3` (or any corridor).
4. If the anomaly warning fires: read `revealedRooms`, `roomVisibilityA`,
   `roomVisibilityB` — that reveals the runtime state mismatch.
5. If the warning does NOT fire but doors are still invisible:
   - `mapData.doors` is likely empty at the renderer. Add a probe near
     `canonicalDoors` useMemo to log `mapData.doors.length` and
     `mapData.rooms.map(r => r.id)`.
   - Suspect candidate: `terminal/views.py:281-318` (`ship_deck_data`
     fallback) builds a `current_deck` that omits `doors`. Confirm the
     player encounter view is NOT routing through that path.

## Regression Test (this commit)
`src/components/domain/encounter/doors/__tests__/corridorDoorVisibility.test.ts`
covers normalizer + filter for `bridge ↔ corridor_3` (Patrol Gunboat),
`bridge ↔ corridor_3` (Morrigan), and `cyropod_chamber ↔ corridor_3`
(Somnus). Plus a bulk check (`H6`) that every door touching the test
corridor survives the filter. Keep this test even after the runtime fix —
it locks in the contract.
