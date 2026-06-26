---
phase: 29-interactive-deckplan-map-editor-with-live-preview-yaml-sync-
plan: "04"
subsystem: ui
tags: [monaco-editor, yaml, deckplan, react, surgical-edits]

requires:
  - phase: 29-03
    provides: DeckplanPreviewPane with onRoomClick/onPoiClick/onPoiMove/onEmptyCellClick callback stubs wired to MapPreview

provides:
  - "jumpToElement(kind, id): deck-scoped Monaco reveal + amber deltaDecorations highlight (EDIT-04)"
  - "applyDeckplanEdit(TextEdit): executeEdits wrapper — never YAML.stringify (D-12)"
  - "onPoiMove → buildPositionEdit surgical patch (EDIT-05)"
  - "onEmptyCellClick → buildAddPoiEdit stub insert + post-insert jump highlight (EDIT-06)"
  - ".deckplan-jump-highlight CSS class (rgba(201,160,80,0.18) bg + 2px #c9a050 border-left)"
  - "AddPoiOpts.id optional field so callers can pre-generate the id for post-add jump"

affects:
  - FileEditorView (deckplan branch)
  - DeckplanPreviewPane (callbacks now fully wired)
  - deckplanYamlEdits (AddPoiOpts extended)

tech-stack:
  added: []
  patterns:
    - "Ref-based stable callbacks: selectedDeckIdRef mirrors selectedDeckId state so callbacks have empty deps arrays and read the latest value at call time"
    - "Live-model source of truth: always read editor.getModel().getValue() at interaction time, never debounced React state (Pitfall 4)"
    - "Surgical text edits via executeEdits: fires onChange → content/isDirty update; no setValue or YAML.stringify"
    - "Post-add jump via pre-generated id: generate poi_${Date.now()} before buildAddPoiEdit so jumpToElement can find it after rAF"
    - "Decoration lifecycle: deltaDecorations returns new ids stored in ref; cleared by next jump or onDidChangeCursorPosition"

key-files:
  created: []
  modified:
    - src/components/gm/views/FileEditorView.tsx
    - src/components/gm/views/FileEditorView.css
    - src/components/gm/views/deckplan/deckplanYamlEdits.ts

key-decisions:
  - "Read live model value at interaction time (Pitfall 4): jumpToElement, onPoiMove, onEmptyCellClick all call editor.getModel().getValue() fresh — not the debounced React content state"
  - "Deck-scoped lookup key format: ${deckId}|${kind}|${id} exactly as built by buildIdRangeMap (Pitfall 3 — cross-deck id collision prevention)"
  - "No ScrollType argument to revealRangeInCenter: avoids const-enum runtime issues while Monaco defaults to smooth reveal"
  - "Clear decoration on cursor move not on timer: GM needs time to read the YAML (UI-SPEC)"
  - "Pre-generate poi id before buildAddPoiEdit: allows immediate jump to new stub via jumpToElement after rAF"
  - "MAP SYNC ERROR surfaced via existing error banner with errorTitle state: reuses existing dismiss timer pattern, no new UI component"

requirements-completed: [EDIT-04, EDIT-05, EDIT-06]

duration: ~25min
completed: 2026-06-25
---

# Phase 29 Plan 04: Monaco-Deckplan Interaction Wiring Summary

**Monaco editor wired to preview map: click-to-jump reveals deck-scoped id lines with amber highlight, POI drag surgically patches position: values, and empty-cell click inserts poi stubs — all via executeEdits with no YAML reserialization**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-25
- **Completed:** 2026-06-25
- **Tasks:** 2/3 auto tasks complete; Task 3 is a blocking human-verify checkpoint
- **Files modified:** 3

## Accomplishments

- EDIT-04: `jumpToElement(kind, id)` rebuilds the id→range map from the live Monaco model at call time, performs deck-scoped lookup (`${deckId}|${kind}|${id}`), reveals the line with `revealRangeInCenter`, and applies a whole-line amber `deckplan-jump-highlight` decoration via `deltaDecorations`; clears on next jump or caret move; shows MAP SYNC ERROR banner on miss
- EDIT-05: `onPoiMove(poiId, x, y)` calls `buildPositionEdit` on the live model then `applyDeckplanEdit` (single `executeEdits` call replacing only the `position:` value span)
- EDIT-06: `onEmptyCellClick(x, y)` pre-generates a `poi_${Date.now()}` id, calls `buildAddPoiEdit`, applies the insert, then schedules a `jumpToElement` via `requestAnimationFrame` to highlight the new stub; `AddPoiOpts.id` extended to accept caller-supplied id

## Task Commits

1. **Task 1+2: Wire click-to-jump and surgical POI edits to Monaco (EDIT-04..06)** — `218cba4` (feat)
2. **Task 2b: Extend AddPoiOpts with optional id for post-add jump** — `e389652` (feat)
3. **Task 3: Human verification checkpoint** — pending human sign-off

## Files Created/Modified

- `src/components/gm/views/FileEditorView.tsx` — Added monacoRef, selectedDeckIdRef, decorationIdsRef, errorTitle state; implemented jumpToElement, applyDeckplanEdit, onPoiMove, onEmptyCellClick; wired all four callbacks to DeckplanPreviewPane; error banner uses errorTitle
- `src/components/gm/views/FileEditorView.css` — Added `.deckplan-jump-highlight` class (rgba(201,160,80,0.18) background, 2px solid #c9a050 left border)
- `src/components/gm/views/deckplan/deckplanYamlEdits.ts` — Extended `AddPoiOpts` with optional `id?: string` field; `buildAddPoiEdit` uses `opts?.id ?? poi_${Date.now()}`

## Decisions Made

- **Live model over debounced state (Pitfall 4):** Every interaction handler calls `editor.getModel().getValue()` fresh — never the debounced React `content` state. Prevents stale-closure edits landing on wrong lines after rapid typing.
- **No ScrollType enum:** `revealRangeInCenter` called without second argument to avoid const-enum runtime-value issues; Monaco defaults to smooth reveal.
- **Decoration cleared on cursor move:** Per UI-SPEC, no auto-dismiss timer — GM needs time to locate the YAML line. `onDidChangeCursorPosition` listener clears decorations on any caret movement.
- **rAF for post-add jump:** `requestAnimationFrame` gives Monaco time to process `executeEdits` before `jumpToElement` rebuilds the id→range map from the updated model.
- **errorTitle state replaces hardcoded heading:** The existing VALIDATION ERROR banner is reused for MAP SYNC ERROR by adding `errorTitle` state; same 8-second auto-dismiss.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended AddPoiOpts with optional id field**
- **Found during:** Task 2 (onEmptyCellClick implementation)
- **Issue:** `buildAddPoiEdit` generates `poi_${Date.now()}` internally with no way for the caller to learn the id, making the post-add `jumpToElement` highlight impossible without modifying the API
- **Fix:** Added `id?: string` to `AddPoiOpts`; `buildAddPoiEdit` uses `opts?.id ?? poi_${Date.now()}`. Callers that don't need to jump omit it and get the auto-generated id as before.
- **Files modified:** `src/components/gm/views/deckplan/deckplanYamlEdits.ts`
- **Verification:** TypeScript typecheck and build both pass; no breaking change to existing call signature
- **Committed in:** `e389652` (separate feat commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical functionality for post-add jump)
**Impact on plan:** Non-breaking additive change. No scope creep.

## Issues Encountered

None beyond the `AddPoiOpts.id` deviation above.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. All writes remain surgical Monaco buffer edits flowing through the existing `PUT /api/gm/data/{path}` + `safe_write_yaml()` validation path. Threat register mitigations satisfied:

- **T-29-08 (stale id→range map):** All handlers rebuild from `editor.getModel().getValue()` at call time ✓
- **T-29-09 (invalid YAML on save):** `safe_write_yaml()` unchanged, rejects malformed content with 400 ✓
- **T-29-10 (YAML injection via stub):** Stub template uses fixed literal strings and numeric coords ✓

## Known Stubs

None — all callbacks are fully implemented; human-verify checkpoint (Task 3) confirms end-to-end behavior.

## Next Phase Readiness

Task 3 (human-verify gate) requires the GM to walk the interactive loop end-to-end (open `patrol_gunboat/deckplan.yaml`, confirm click-to-jump, POI drag, and click-to-add all work, then `git diff` to confirm surgical writes). Once approved, Phase 29 is complete and phases 30+ may reference the wired editor as a foundation.

---
*Phase: 29-interactive-deckplan-map-editor-with-live-preview-yaml-sync-*
*Completed: 2026-06-25*
