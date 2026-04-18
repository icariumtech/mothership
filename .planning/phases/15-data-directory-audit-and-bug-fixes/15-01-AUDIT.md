# Phase 15-01 Alignment Audit

Date: 2026-04-17

## 1. TypeScript types vs YAML fields — `manifest` key

**Check:** Does any TypeScript type reference `manifest` such that renaming to `deckplan` would break frontend?

**Findings:**
- `src/types/encounterMap.ts`: Defines `EncounterManifest` type and `MultiDeckMapData.manifest` field
- `src/types/gmConsole.ts`: Ship deck data struct has a `manifest: { ... }` block
- `src/services/encounterApi.ts`: API response includes `manifest?: EncounterManifest`
- `src/components/gm/EncounterPanel.tsx`, `EncounterView.tsx`, `EncounterMapDisplay.tsx`: All read `data.manifest`

**Conclusion:** `manifest` is deeply wired in frontend types and components. Any rename to `deckplan` requires coordinated backend + frontend changes. No action needed now — Phase 15 is read-only. Document for Phase 18 planning.

**Risk:** HIGH if renamed without updating frontend simultaneously.

## 2. Manifest references in frontend API calls

**Check:** Frontend code reading a `manifest` key from API responses.

**Findings:** Multiple components read `manifest` from encounter API responses (see above). All consistent — no orphaned references found.

**Conclusion:** No gaps. Frontend and backend agree on `manifest` key name.

## 3. `slug: ship` in data/campaign/ship.yaml

**Check:** Is `slug: ship` (field at line 133 in ship.yaml) read by any code path?

**Findings:**
- `views.py` returns the full `ship_data` dict via `load_ship_status()` → `JsonResponse(ship_data)`
- `shipData?.slug` is read in `BridgeView.tsx` (line 192) and `EncounterView.tsx` (line 488)
- Passed as `shipSlug` prop to `LocationTree`

**Conclusion:** `slug: ship` IS used — the frontend reads `shipData.slug` to identify the ship node in the location tree. Field is not dead. No action needed.

## 4. `planets:` / `stations:` fields in galaxy location.yaml

**Check:** Does frontend read `.planets` or `.stations` from location data?

**Findings:** `grep -rn "\.planets\b|\.stations\b" src/` returned no results.

**Conclusion:** Frontend does not consume `planets:` or `stations:` fields. These fields are safe to restructure or remove in future phases without breaking the frontend.

## 5. `total_decks` key — source of truth

**Check:** Does any frontend component read `total_decks` directly from a manifest object vs from the top-level response?

**Findings:**
- `src/types/gmConsole.ts:23`: `manifest: { total_decks: number; ... }` — ship deck manifest struct
- `src/types/gmConsole.ts:77`: `ship_deck_total_decks?: number` — top-level active view field
- `src/types/encounterMap.ts:158`: `EncounterManifest.total_decks: number`
- `src/entries/SharedConsole.tsx:77,86`: reads both `encounter_total_decks` and `ship_deck_total_decks` from active view
- `src/entries/SharedConsole.tsx:903,998`: passes `shipDeckTotalDecks` and `totalDecks` as props

**Conclusion:** `total_decks` is read from two places — from the manifest object (typed in encounterMap.ts) AND from flattened top-level active view fields (`ship_deck_total_decks`, `encounter_total_decks`). Both paths are consistent. No breakage risk.
