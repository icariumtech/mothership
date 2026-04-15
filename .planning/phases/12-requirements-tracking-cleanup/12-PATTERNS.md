# Phase 12: Requirements Tracking + Dead Code Cleanup — Pattern Map

**Mapped:** 2026-04-14
**Files analyzed:** 4 (2 modified documentation files + 2 deleted source files)
**Analogs found:** N/A — this is a housekeeping phase with no new files and no code being written

---

## Overview

Phase 12 is pure housekeeping: no new files are created, no existing source code is modified (beyond deletion). The "pattern" task here is confirming exact file state so the planner has a precise, verified edit map. No analog search is needed — the edits are mechanical checkbox flips and file deletions.

---

## File Classification

| File | Role | Data Flow | Action | Analog Needed |
|------|------|-----------|--------|---------------|
| `.planning/REQUIREMENTS.md` | documentation | N/A | Modify — checkbox flips + traceability table | No |
| `.planning/ROADMAP.md` | documentation | N/A | Modify — checkbox flips only | No |
| `src/components/gm/ShipStatusPanel.tsx` | component (dead) | N/A | Delete — zero importers | No |
| `src/components/gm/panels/ShipStatusToolPanel.tsx` | component (dead) | N/A | Delete — zero importers | No |

---

## Exact Edit Map: REQUIREMENTS.md

**File:** `/home/gjohnson/mothership/charon/.planning/REQUIREMENTS.md`

### Edit Group 1 — GRID checkboxes (lines 55–64)

Change `[ ]` to `[x]` on all 10 GRID lines. Current state (verified by direct read):

```
Line 55:  - [ ] **GRID-01**: New TypeScript types for grid-based rooms ...
Line 56:  - [ ] **GRID-02**: YAML map files rebuilt in grid-based format ...
Line 57:  - [ ] **GRID-03**: Encounter map renderer uses wall-segment algorithm ...
Line 58:  - [ ] **GRID-04**: Map background shows faint dark grid in void ...
Line 59:  - [ ] **GRID-05**: Walls render in amber (#8b7355), room labels ...
Line 60:  - [ ] **GRID-06**: GM click-to-reveal: clicking a room ...
Line 61:  - [ ] **GRID-07**: TokenLayer findRoomAtCell tests all rects ...
Line 62:  - [ ] **GRID-08**: MapPreview and EncounterPanel updated for GridRoom schema ...
Line 63:  - [ ] **GRID-09**: isGridEncounterMap() type guard routes new maps ...
Line 64:  - [ ] **GRID-10**: End-to-end human verification: visual rendering ...
```

Each becomes `[x]` — the description text is unchanged.

### Edit Group 2 — Traceability table Status column (lines 169–178)

Change `Pending` to `Complete` for all 10 GRID rows:

```
Line 169: | GRID-01 | Phase 7 | Pending |   →   | GRID-01 | Phase 7 | Complete |
Line 170: | GRID-02 | Phase 7 | Pending |   →   | GRID-02 | Phase 7 | Complete |
Line 171: | GRID-03 | Phase 7 | Pending |   →   | GRID-03 | Phase 7 | Complete |
Line 172: | GRID-04 | Phase 7 | Pending |   →   | GRID-04 | Phase 7 | Complete |
Line 173: | GRID-05 | Phase 7 | Pending |   →   | GRID-05 | Phase 7 | Complete |
Line 174: | GRID-06 | Phase 7 | Pending |   →   | GRID-06 | Phase 7 | Complete |
Line 175: | GRID-07 | Phase 7 | Pending |   →   | GRID-07 | Phase 7 | Complete |
Line 176: | GRID-08 | Phase 7 | Pending |   →   | GRID-08 | Phase 7 | Complete |
Line 177: | GRID-09 | Phase 7 | Pending |   →   | GRID-09 | Phase 7 | Complete |
Line 178: | GRID-10 | Phase 7 | Pending |   →   | GRID-10 | Phase 7 | Complete |
```

### No-touch zones in REQUIREMENTS.md

- Line 218 (Phase 12 gap closures section) — already correct, do not edit
- PORT-03 checkbox (line 42) — already `[x]`, do not touch
- All STAT-10..14 entries — already `[ ]`, deferred to Phase 20, do not touch
- All prose descriptions and section headers — no edits

**Total REQUIREMENTS.md edits: 20** (10 checkbox flips + 10 traceability status changes)

---

## Exact Edit Map: ROADMAP.md

**File:** `/home/gjohnson/mothership/charon/.planning/ROADMAP.md`

All edits are `[ ]` → `[x]` checkbox flips. No prose, no headers, no progress table rows are to be changed.

### Top-level Phases list (lines 9–15)

```
Line 11: - [ ] **Phase 3: Encounter Tokens**          →  [x]
Line 12: - [ ] **Phase 4: NPC Portrait System**        →  [x]
Line 13: - [ ] **Phase 5: Real-Time Push Architecture** →  [x]
```

Line 14 (`Phase 6: UI Audio System`) stays `[ ]` — deferred to v2.

### Phase 3 plan entries (lines 64–67)

```
Line 64: - [ ] 03-01-PLAN.md  →  [x]
Line 65: - [ ] 03-02-PLAN.md  →  [x]
Line 66: - [ ] 03-03-PLAN.md  →  [x]
Line 67: - [ ] 03-04-PLAN.md  →  [x]
```

### Phase 4 plan entries (lines 82–85)

```
Line 82: - [ ] 04-01-PLAN.md  →  [x]
Line 83: - [ ] 04-02-PLAN.md  →  [x]
Line 84: - [ ] 04-03-PLAN.md  →  [x]
Line 85: - [ ] 04-04-PLAN.md  →  [x]
```

Phase 4 header (line 79) reads "3/4 plans executed" — DO NOT change this prose per D-04.

### Phase 5 plan entries (lines 100–103)

```
Line 100: - [ ] 05-01-PLAN.md  →  [x]
Line 101: - [ ] 05-02-PLAN.md  →  [x]
Line 102: - [ ] 05-03-PLAN.md  →  [x]
Line 103: - [ ] 05-04-PLAN.md  →  [x]
```

Phase 5 header (line 97) reads "3/4 plans executed" — DO NOT change this prose per D-04.

### Phase 7 plan entries (lines 158–161)

```
Line 158: - [ ] 07-01-PLAN.md  →  [x]
Line 159: - [ ] 07-02-PLAN.md  →  [x]
Line 160: - [ ] 07-03-PLAN.md  →  [x]
Line 161: - [ ] 07-04-PLAN.md  →  [x]
```

### Phase 8 plan entries (lines 171–174)

```
Line 171: - [ ] 08-01-PLAN.md  →  [x]
Line 172: - [ ] 08-02-PLAN.md  →  [x]
Line 173: - [ ] 08-03-PLAN.md  →  [x]
Line 174: - [ ] 08-04-PLAN.md  →  [x]
```

Phase 8 header (line 168) reads "3/4 plans executed" — DO NOT change this prose per D-04.

### Phase 9 plan entries (lines 128–129)

```
Line 128: - [ ] 09-01-PLAN.md  →  [x]
Line 129: - [ ] 09-02-PLAN.md  →  [x]
```

### Phase 10 plan entries (lines 184–186)

```
Line 184: - [ ] 10-01-PLAN.md  →  [x]
Line 185: - [ ] 10-02-PLAN.md  →  [x]
Line 186: - [ ] 10-03-PLAN.md  →  [x]
```

### Phase 11 plan entry (line 201)

```
Line 201: - [ ] 11-01-PLAN.md  →  [x]
```

### Phase 13 plan entries (lines 227–231)

```
Line 227: - [ ] 13-01-PLAN.md  →  [x]
Line 228: - [ ] 13-02-PLAN.md  →  [x]
Line 229: - [ ] 13-03-PLAN.md  →  [x]
Line 230: - [ ] 13-04-PLAN.md  →  [x]
Line 231: - [ ] 13-05-PLAN.md  →  [x]
```

### Phase 12 plan entry — self-check (line 217)

```
Line 217: - [ ] 12-01-PLAN.md — REQUIREMENTS.md registration + ROADMAP.md sync + dead code removal
```

This entry is checked off as the final step of executing the plan itself (after all other tasks complete).

### No-touch zones in ROADMAP.md

- Progress table (lines 133–148) — already accurate, no changes
- All "Depends on" lines — prose, no changes
- All phase Goal/Requirements/Success Criteria prose — no changes
- Phase 6 entry — stays `[ ]` (deferred)
- Phase 14 plan entries (lines 241–243) — already `[x]`, no changes
- Phase 15–19, 20 plan entries — all `[ ]`, not yet complete, no changes

**Total ROADMAP.md edits: 34** checkbox flips (3 top-level + 4+4+4+4+4+2+3+1+5 plan entries) + 1 self-check at end

---

## Dead Code Deletion

### `src/components/gm/ShipStatusPanel.tsx`

**Path:** `/home/gjohnson/mothership/charon/src/components/gm/ShipStatusPanel.tsx`
**Exists:** YES (350 lines, verified by read)
**Importers outside itself:** ZERO (grep for `ShipStatusPanel` across `src/` returns only the two dead files)
**Action:** Delete the file outright. No import cleanup needed anywhere.

**What it contains** (for reference — do not preserve):
- React component that polls `gmConsoleApi` every 5 seconds for ship status
- Uses `useState`, `useEffect`, `useCallback`, `useRef`, Ant Design `Select`, `Card`, `Button`, `Checkbox`
- Replaced by inline ship status controls in `BridgeView.tsx` during Phase 9/10 refactor

### `src/components/gm/panels/ShipStatusToolPanel.tsx`

**Path:** `/home/gjohnson/mothership/charon/src/components/gm/panels/ShipStatusToolPanel.tsx`
**Exists:** YES (5 lines, verified by read)
**Importers outside itself:** ZERO (same grep result)
**Action:** Delete the file outright. No import cleanup needed anywhere.

**What it contains** (for reference — do not preserve):
```typescript
import { ShipStatusPanel } from '@/components/gm/ShipStatusPanel';

export function ShipStatusToolPanel() {
  return <ShipStatusPanel />;
}
```
A thin wrapper that solely re-exports `ShipStatusPanel`. Both files are dead together.

---

## Shared Patterns

Not applicable — this phase has no new code patterns. All tasks are documentation edits and file deletion.

---

## No Analog Found

Not applicable — this phase creates no new files that would require analogs.

---

## Implementation Constraints (for planner)

1. **D-04 strict:** ROADMAP.md edits are checkboxes ONLY. Do not touch prose lines containing "plans executed", "plans complete", "Depends on", or any success criteria text.
2. **Traceability table IS in scope:** REQUIREMENTS.md Traceability table Status column for GRID-01..10 should be updated `Pending` → `Complete`. This is alignment work, not prose rewriting, and is not constrained by D-04 (which scoped to ROADMAP.md checkboxes only).
3. **Phase 12 self-check:** The plan checks off its own ROADMAP.md entry (`12-01-PLAN.md`) as the final step.
4. **No barrel/index cleanup:** Neither dead file is exported from any index. Deletion requires no follow-up edits.
5. **Order of operations:** Any order is fine (D&D per discretion note). Suggested: dead code deletion first (fastest, irreversible confirmation), then REQUIREMENTS.md edits, then ROADMAP.md edits.

---

## Metadata

**Analog search scope:** N/A — housekeeping phase, no new files
**Files scanned:** 4 (REQUIREMENTS.md, ROADMAP.md, ShipStatusPanel.tsx, ShipStatusToolPanel.tsx)
**Pattern extraction date:** 2026-04-14
**Confidence:** HIGH — all file states verified by direct reads and grep
