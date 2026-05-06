# Phase 20: Audit Closure — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 20-audit-closure-security-requirements-tracking
**Areas discussed:** VERIFICATION.md depth, PORT-03 resolution, tech debt cleanup

---

## VERIFICATION.md Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Lightweight evidence-reference | Agent writes VERIFICATION.md per phase citing existing UAT results and SUMMARY evidence. No re-running code checks — formalizes what already passed. ~15 min total. | ✓ |
| Full code verification | Agent re-verifies each phase by reading actual code against must_haves. More thorough but 3-5x slower and mostly redundant. | |

**User's choice:** Lightweight evidence-reference
**Notes:** 7 phases (04, 05, 07, 08, 10, 13, 14) need VERIFICATION.md. Each has existing UAT + SUMMARY evidence. Goal is to formalize, not re-verify.

---

## PORT-03 Resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Document the accepted deviation | Portraits land on GM's EncounterView only, not player terminal. Write a note in VERIFICATION.md capturing this as accepted design change. | ✓ |
| Leave it — already [x] | PORT-03 checkbox already checked, UAT confirmed. Audit flag is noise — skip it. | |

**User's choice:** Document the accepted deviation
**Notes:** PORT-03 deviation note goes in Phase 11's VERIFICATION.md (overlay wired in Phase 11).

---

## Tech Debt Cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Skip — out of scope | Minor API hygiene issue. Phase 20 is audit closure, not tech debt. Leave for future pass. | |
| Include it | Remove getRoomVisibility/setRoomVisibility from encounterApi.ts exports. Small, low-risk. | ✓ |

**User's choice:** Include it
**Notes:** Functions stay in the file — only the exports are removed. Low-risk change.

---

## Claude's Discretion

- ANIM-* requirement descriptions: Claude chooses wording based on Phase 13 SUMMARY evidence.
- VERIFICATION.md format: Claude chooses structure as long as evidence is clearly readable.

## Deferred Ideas

None — discussion stayed within phase scope.
