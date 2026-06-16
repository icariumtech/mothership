# Phase 29 — Deferred Items

## Pre-existing test failures discovered during Plan 02 execution

These failures existed before Plan 02 began (confirmed by checking git log).
They are out of scope for Plan 02 per the SCOPE BOUNDARY rule.

| File | Test | Root Cause | Action Required |
|------|------|-----------|-----------------|
| `src/components/domain/encounter/doors/__tests__/migratedMaps.test.ts` | `normalizes doors in data/galaxy/tau-ceti/somnus/map/main_deck.yaml` | Plan 01 deleted `data/ships/somnus/map/main_deck.yaml`; test hardcodes a glob that still finds the old path reference | Remove the deleted somnus legacy path entry from `migratedMaps.test.ts` |
| `src/components/domain/encounter/doors/__tests__/migratedMaps.test.ts` | `normalizes doors in data/campaign/ship/deckplan.yaml` | `engine_room` and `lower_corridor_2` share no boundary per `doorNormalizer` | Investigate campaign ship deckplan geometry |
