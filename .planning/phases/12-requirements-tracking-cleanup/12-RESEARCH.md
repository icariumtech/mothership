# Phase 12: Requirements Tracking + Dead Code Cleanup — Research

**Researched:** 2026-04-14
**Domain:** Documentation housekeeping + dead code removal (no new features)
**Confidence:** HIGH — all findings are direct file reads from the current codebase

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Check off all 10 GRID requirements as `[x]` with no deviation annotations.
- **D-02:** Phase 12 handles GRID-01..10 checkboxes now. Phase 20 will find them already done and focus on remaining scope.
- **D-03:** Delete `src/components/gm/ShipStatusPanel.tsx` and `src/components/gm/panels/ShipStatusToolPanel.tsx`. Both have zero active importers — confirmed safe. No additional dead code scan needed beyond these two files.
- **D-04:** Checkboxes only — update `[ ]` → `[x]` for all completed plan entries and the top-level phase summary list. Do not rewrite prose, scope descriptions, or success criteria.

### Claude's Discretion
- Order of operations within the single plan (dead code first vs checkboxes first — doesn't matter)
- Whether to commit as one atomic commit or separate commits per concern

### Deferred Ideas (OUT OF SCOPE)
- STAT-10..14 checkbox updates → Phase 20
- ANIM-VIEW, ANIM-OVERLAY, ANIM-ROOM, ANIM-BRIDGE registration → Phase 20
- PORT-03 product decision → Phase 20
- Security fixes (api_set_ship_location + api_bridge_selection missing @login_required) → Phase 20
- VERIFICATION.md artifacts for Phases 04, 05, 07, 08, 10, 13, 14 → Phase 20
- CHARON overlay tool on standby view → future feature phase
- NPC portraits on standby view → future feature phase
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GRID-01..10 | All 10 grid map requirements — check off as `[x]` | All 10 confirmed `[ ]` in REQUIREMENTS.md; Phase 07 human verification 6/6 APPROVED per audit |
| SHIP-01 | Already `[x]` — no action needed | Confirmed `[x]` in REQUIREMENTS.md |
| GMUI-LAYOUT..GMUI-DISPLAY | Already `[x]` — no action needed | All 11 confirmed `[x]` in REQUIREMENTS.md |
</phase_requirements>

---

## Summary

Phase 12 is pure mechanical housekeeping: three independent tasks with no coding logic. All three tasks operate on well-understood, fully-read files with deterministic edits.

**Task 1 — GRID-01..10 checkboxes:** All 10 GRID requirements are currently `[ ]` in REQUIREMENTS.md. They need to become `[x]`. The Traceability table already shows `Status: Pending` for all 10 and the Phase 12 gap closures section already pre-documents the intent (`GRID-01..10 | Phase 7 | Complete | Check off — audit gap closure`). Only the `[ ]` → `[x]` change in the main requirement list is missing.

**Task 2 — Dead code removal:** Two files exist at confirmed paths with zero importers outside themselves. Deleting them is the complete action — no import cleanup needed.

**Task 3 — ROADMAP.md checkbox sync:** The top-level Phases list has Phases 3–5 as `[ ]` when they are complete. Individual plan entries across Phases 3–5 and 7–11 are `[ ]` when they should be `[x]`. The Progress table is already accurate (shows correct Complete status and dates). Only `[ ]` → `[x]` changes are needed — no prose edits.

**Primary recommendation:** Execute as a single atomic plan with three sequential tasks. No tooling research needed; this is a file-edit phase.

---

## Architectural Responsibility Map

Not applicable — this phase makes no architectural changes. All tasks are documentation and file deletion.

---

## Current State: REQUIREMENTS.md GRID-01..10

[VERIFIED: direct file read]

All 10 entries are currently `[ ]`. Exact text of each entry:

```
- [ ] **GRID-01**: New TypeScript types for grid-based rooms (GridRect, GridRoom, DoorDef, GridEncounterMapData) exported from encounterMap.ts
- [ ] **GRID-02**: YAML map files rebuilt in grid-based format (rooms defined by rects, doors on walls, no connections array)
- [ ] **GRID-03**: Encounter map renderer uses wall-segment algorithm: interior edges between same-room rects are suppressed, only exterior perimeter drawn
- [ ] **GRID-04**: Map background shows faint dark grid in void; room interiors show scanline floor texture
- [ ] **GRID-05**: Walls render in amber (#8b7355), room labels centered and only visible when room is revealed
- [ ] **GRID-06**: GM click-to-reveal: clicking a room in GM map preview toggles its reveal/hide state; bulk reveal all / hide all buttons available
- [ ] **GRID-07**: TokenLayer findRoomAtCell tests all rects in a GridRoom for correct multi-rect room hit detection
- [ ] **GRID-08**: MapPreview and EncounterPanel updated for GridRoom schema (no status field, type field, onRoomToggle wired)
- [ ] **GRID-09**: isGridEncounterMap() type guard routes new maps to grid renderer in EncounterMapDisplay
- [ ] **GRID-10**: End-to-end human verification: visual rendering, room reveal, player terminal, door symbols, token multi-rect placement
```

These appear in the `### Grid-Based Encounter Map` section (lines 55–64 of REQUIREMENTS.md).

The Traceability table at the bottom of REQUIREMENTS.md already records GRID-01..10 as Phase 7 / Pending — that table also needs the Status column updated from `Pending` to `Complete` for all 10 rows. The Phase 12 gap closures section already pre-anticipates this:

```
| GRID-01..10 | Phase 7 | Complete | Check off — audit gap closure |
```

---

## Current State: ROADMAP.md Plan Checkboxes

[VERIFIED: direct file read]

### Top-Level Phases List (lines 9–15)

Current state — three phases wrongly show `[ ]`:

```
- [x] Phase 1: Campaign Logs Tab
- [x] Phase 2: Ship Status Dashboard
- [ ] Phase 3: Encounter Tokens          ← WRONG: complete 2026-02-21
- [ ] Phase 4: NPC Portrait System       ← WRONG: complete 2026-02-21
- [ ] Phase 5: Real-Time Push Architecture ← WRONG: complete 2026-03-01
- [ ] Phase 6: UI Audio System
```

Phases 3, 4, and 5 need `[ ]` → `[x]`. Phase 6 remains `[ ]` (deferred to v2).

### Phase 3 Plan Entries (lines 64–67)

```
- [ ] 03-01-PLAN.md — Backend data pipeline: ...   ← needs [x]
- [ ] 03-02-PLAN.md — Frontend token rendering: ... ← needs [x]
- [ ] 03-03-PLAN.md — GM Console controls: ...     ← needs [x]
- [ ] 03-04-PLAN.md — UAT gap closure: ...         ← needs [x]
```

All 4 plans need `[ ]` → `[x]`.

### Phase 4 Plan Entries (lines 82–85)

```
- [ ] 04-01-PLAN.md — Backend: ...                 ← needs [x]
- [ ] 04-02-PLAN.md — Frontend foundation: ...     ← needs [x]
- [ ] 04-03-PLAN.md — Frontend features: ...       ← needs [x]
- [ ] 04-04-PLAN.md — Human verification: ...      ← needs [x]
```

All 4 plans need `[ ]` → `[x]`.

Note: Phase 4 header currently reads "3/4 plans executed" — this prose should remain unchanged per D-04 (checkboxes only, no prose rewriting). The plan checkboxes themselves become `[x]`.

### Phase 5 Plan Entries (lines 100–103)

```
- [ ] 05-01-PLAN.md — Backend foundation: ...      ← needs [x]
- [ ] 05-02-PLAN.md — Backend views refactor: ...  ← needs [x]
- [ ] 05-03-PLAN.md — Frontend SSE: ...            ← needs [x]
- [ ] 05-04-PLAN.md — Human verification: ...      ← needs [x]
```

All 4 plans need `[ ]` → `[x]`.

Note: Phase 5 header currently reads "3/4 plans executed" — same as Phase 4, prose unchanged.

### Phase 7 Plan Entries (lines 158–161)

```
- [ ] 07-01-PLAN.md — TypeScript grid types + YAML map files rebuilt in grid format     ← needs [x]
- [ ] 07-02-PLAN.md — EncounterMapRenderer rewrite ...                                  ← needs [x]
- [ ] 07-03-PLAN.md — TokenLayer multi-rect update ...                                  ← needs [x]
- [ ] 07-04-PLAN.md — Human verification: visual rendering, room reveal, ...            ← needs [x]
```

All 4 plans need `[ ]` → `[x]`.

### Phase 8 Plan Entries (lines 171–174)

```
- [ ] 08-01-PLAN.md — Layout shell: ViewRail, ToolRail, SlideOutPanel ...   ← needs [x]
- [ ] 08-02-PLAN.md — EncounterView: full-screen map ...                    ← needs [x]
- [ ] 08-03-PLAN.md — BridgeView dashboard, CharonView ...                  ← needs [x]
- [ ] 08-04-PLAN.md — Human verification: all views, navigation ...         ← needs [x]
```

All 4 plans need `[ ]` → `[x]`.

Note: Phase 8 header reads "3/4 plans executed" — prose unchanged per D-04.

### Phase 9 Plan Entries (lines 128–129)

```
- [ ] 09-01-PLAN.md — SSE shipstatus event + StatusSection polling removal ...   ← needs [x]
- [ ] 09-02-PLAN.md — GM BridgeView main dashboard: ...                          ← needs [x]
```

Both plans need `[ ]` → `[x]`.

Note: Phase 9 header reads "2/2 plans complete" — already accurate prose, just checkboxes are wrong.

### Phase 10 Plan Entries (lines 183–185)

```
- [ ] 10-01-PLAN.md — Data layer + backend API: ...   ← needs [x]
- [ ] 10-02-PLAN.md — Frontend bridge rendering: ...  ← needs [x]
- [ ] 10-03-PLAN.md — GM ship location setter + ...   ← needs [x]
```

All 3 plans need `[ ]` → `[x]`.

Note: Phase 10 header reads "3/3 plans complete" — already accurate prose.

### Phase 11 Plan Entries (line 201)

```
- [ ] 11-01-PLAN.md — Security fix + NPC portrait overlay + Set Ship Here prop + INITIAL_DATA injection   ← needs [x]
```

1 plan needs `[ ]` → `[x]`.

### Phase 12 Plan Entry (line 217)

```
- [ ] 12-01-PLAN.md — REQUIREMENTS.md registration + ROADMAP.md sync + dead code removal
```

This will be created by Phase 12 itself and checked off when executed. The planner should leave this as `[ ]` in the plan being written — it gets checked off at execution time.

### Phases 13, 14 Plan Entries

Phase 13 plan entries (lines 228–231): all currently `[ ]`, all need `[x]` — 5 plans total.
Phase 14 plan entries (lines 241–243): 14-01 and 14-02 and 14-03 currently `[x]` already — no change needed.

Let me confirm the Phase 13 exact state:

```
- [ ] 13-01-PLAN.md — useViewTransition hook + ViewStatusOverlay component + SharedConsole view transition wiring
- [ ] 13-02-PLAN.md — Overlay animations: DocumentDialog scan-reveal, ...
- [ ] 13-03-PLAN.md — Encounter room reveal: CSS flicker keyframes + roomAnimState ...
- [ ] 13-04-PLAN.md — Bridge panel boot stagger: BridgeView.css stagger classes ...
- [ ] 13-05-PLAN.md — Human verification: view transitions, overlay animations, ...
```

All 5 plans need `[ ]` → `[x]`.

### Progress Table (lines 134–148)

The Progress table is already accurate — it correctly shows ✓ Complete with dates for all finished phases. No changes needed to the Progress table.

### Summary of All Checkbox Changes Required in ROADMAP.md

| Location | Count | Change |
|----------|-------|--------|
| Top-level Phases list: Phases 3, 4, 5 | 3 | `[ ]` → `[x]` |
| Phase 3 plan entries | 4 | `[ ]` → `[x]` |
| Phase 4 plan entries | 4 | `[ ]` → `[x]` |
| Phase 5 plan entries | 4 | `[ ]` → `[x]` |
| Phase 7 plan entries | 4 | `[ ]` → `[x]` |
| Phase 8 plan entries | 4 | `[ ]` → `[x]` |
| Phase 9 plan entries | 2 | `[ ]` → `[x]` |
| Phase 10 plan entries | 3 | `[ ]` → `[x]` |
| Phase 11 plan entry | 1 | `[ ]` → `[x]` |
| Phase 13 plan entries | 5 | `[ ]` → `[x]` |
| **Total** | **34** | `[ ]` → `[x]` |

---

## Current State: Dead Code Files

[VERIFIED: direct file read + grep]

### `src/components/gm/ShipStatusPanel.tsx`

- Exists: YES
- Importers outside itself: NONE (grep for `ShipStatusPanel` across `src/` returns only the two dead code files themselves)
- Content: A standalone React component that polls `gmConsoleApi` every 5 seconds for ship status. Has its own `useState`, `useEffect`, `useCallback`, `useRef` hooks and no exports used elsewhere.
- Action: Delete file outright.

### `src/components/gm/panels/ShipStatusToolPanel.tsx`

- Exists: YES
- Importers outside itself: NONE (same grep result)
- Content: A thin wrapper around ShipStatusPanel (noted in STATE.md: "ShipStatusToolPanel is thin wrapper around existing ShipStatusPanel (no logic duplication)").
- Action: Delete file outright.

### No import cleanup needed

The grep for `ShipStatusPanel|ShipStatusToolPanel` across all of `src/` returned exactly these two files. No other file imports either component. No barrel exports, no re-exports, no index files to update.

---

## Potential Complications

[VERIFIED: direct file examination]

### 1. ROADMAP.md "X/Y plans executed" prose lines

Several phase headers contain prose like "3/4 plans executed" or "2/2 plans complete" that is inaccurate relative to execution reality. Per D-04, these are NOT to be updated — checkboxes only. The planner should note this constraint explicitly so the implementer does not accidentally edit prose lines.

Affected phases: Phase 4 ("3/4 plans executed"), Phase 5 ("3/4 plans executed"), Phase 8 ("3/4 plans executed").

### 2. Traceability table in REQUIREMENTS.md

The Traceability table (lines 139–190) has a `Status` column showing `Pending` for GRID-01..10. The Phase 12 gap closures section at the bottom already has a pre-populated row documenting the completion. The question for the planner: should the Traceability table `Status` column also be updated from `Pending` to `Complete` for GRID-01..10 rows?

Current Traceability table rows for GRID (lines 169–178):
```
| GRID-01 | Phase 7 | Pending |
| GRID-02 | Phase 7 | Pending |
| GRID-03 | Phase 7 | Pending |
| GRID-04 | Phase 7 | Pending |
| GRID-05 | Phase 7 | Pending |
| GRID-06 | Phase 7 | Pending |
| GRID-07 | Phase 7 | Pending |
| GRID-08 | Phase 7 | Pending |
| GRID-09 | Phase 7 | Pending |
| GRID-10 | Phase 7 | Pending |
```

The D-04 decision applies to ROADMAP.md (checkboxes only). REQUIREMENTS.md is different — the primary `[ ]` → `[x]` change is clearly in scope. Whether the Traceability table Status column also needs updating is a judgment call. The Traceability table is descriptive metadata; updating it from `Pending` to `Complete` is consistent with the phase's goal of alignment with actual state. **Recommendation: update Traceability table Status for GRID-01..10 from `Pending` to `Complete`** — this is part of the same alignment task, not "prose rewriting."

### 3. Phase 12 gap closures section is already written

REQUIREMENTS.md lines 213–218 already contain:
```
| GMUI-LAYOUT..GMUI-DISPLAY | Phase 8 | Complete | Registered — audit gap closure |
| SHIP-01 | Phase 10 | Complete | Registered — audit gap closure |
| GRID-01..10 | Phase 7 | Complete | Check off — audit gap closure |
```

This section is already correct and complete — no edits needed here.

### 4. Phase 3–5 "Depends on" chain in ROADMAP.md

The Phase 3 entry says "Depends on: Phase 2", Phase 4 says "Depends on: Phase 3", Phase 5 says "Depends on: Phase 4". These dependency notes are accurate and are prose — no change needed.

### 5. Phase 4 and 5 plan counts in headers

Phase 4 ROADMAP header says "3/4 plans executed" but all 4 plans are complete. Per D-04, this prose stays as-is. The implementer should not be tempted to fix this.

### 6. PORT-03 checkbox in REQUIREMENTS.md is already `[x]`

REQUIREMENTS.md line 43 shows `[x] **PORT-03**: Portrait appears as overlay during encounter view`. The audit found PORT-03 was subsequently reverted (commit 750bd89). This is a known design decision deferred to Phase 20. Phase 12 does NOT touch PORT-03 — it is already `[x]` and that state stays.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely documentation edits and file deletion. No external tools, services, CLIs, or runtimes are required beyond standard file editing.

---

## Validation Architecture

Step 4: SKIPPED — no implementation code is being written. The success criteria are human-verifiable document states (checkboxes, file existence). No automated test suite applies to documentation edits.

---

## Security Domain

Step 2.7: NOT APPLICABLE — this phase makes no changes to backend endpoints, authentication, or data handling. Two security gaps (api_set_ship_location and api_bridge_selection missing @login_required) are known but explicitly deferred to Phase 20 per D-02 and CONTEXT.md.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Traceability table Status column for GRID-01..10 should be updated to `Complete` | Potential Complications #2 | Low — worst case is minor inconsistency in traceability table, easily fixed |

**All other claims in this research were verified by direct file reads.**

---

## Open Questions

1. **Traceability table Status update**
   - What we know: REQUIREMENTS.md Traceability table rows for GRID-01..10 show `Pending`. The Phase 12 gap closures section already documents them as `Complete`.
   - What's unclear: D-04 is scoped to ROADMAP.md (checkboxes only). REQUIREMENTS.md has no equivalent locked-decision constraint.
   - Recommendation: Update Traceability table Status to `Complete` for all 10 GRID rows. This is part of alignment, not prose rewriting.

2. **Phase 12 plan entry in ROADMAP.md**
   - What we know: Line 217 shows `- [ ] 12-01-PLAN.md — REQUIREMENTS.md registration + ROADMAP.md sync + dead code removal`. This plan does not yet exist.
   - What's unclear: Should this entry be checked `[x]` by the plan itself on completion, or left for Phase 20 to handle?
   - Recommendation: The plan should check off its own entry (`[ ]` → `[x]`) as its final step, since Phase 20 is an audit closure phase that will verify everything is done.

---

## Sources

### Primary (HIGH confidence)
- `.planning/phases/12-requirements-tracking-cleanup/12-CONTEXT.md` — Phase decisions and scope
- `.planning/REQUIREMENTS.md` — Exact current state of all requirement entries (direct read)
- `.planning/ROADMAP.md` — Exact current state of all plan checkboxes (direct read)
- `.planning/v1.0-MILESTONE-AUDIT.md` — Audit findings confirming dead code and gap details
- `src/components/gm/ShipStatusPanel.tsx` — Confirmed existence
- `src/components/gm/panels/ShipStatusToolPanel.tsx` — Confirmed existence
- Grep for `ShipStatusPanel|ShipStatusToolPanel` across `src/` — Zero importers confirmed

---

## Metadata

**Confidence breakdown:**
- Current state of REQUIREMENTS.md: HIGH — direct file read, exact text copied
- Current state of ROADMAP.md checkboxes: HIGH — direct file read, all entries enumerated
- Dead code file existence and zero-importer status: HIGH — bash ls + grep verified
- Traceability table update recommendation: MEDIUM — judgment call not explicitly addressed in CONTEXT.md

**Research date:** 2026-04-14
**Valid until:** Immediately — this research describes point-in-time file state. Any edits to REQUIREMENTS.md or ROADMAP.md before Phase 12 executes would require re-verification.
