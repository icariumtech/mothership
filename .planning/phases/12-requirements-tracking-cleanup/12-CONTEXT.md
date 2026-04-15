# Phase 12: Requirements Tracking + Dead Code Cleanup - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Bring REQUIREMENTS.md and ROADMAP.md into alignment with the actual implemented state: check off completed grid map requirements (GRID-01..10), remove dead code left over from the Phase 09 refactor (ShipStatusPanel.tsx and ShipStatusToolPanel.tsx), and update ROADMAP.md plan checkboxes to reflect reality.

Note: SHIP-01 and all 11 GMUI-* requirements are already registered in REQUIREMENTS.md — that part of the original scope is already done. This phase focuses on the remaining three tasks above.

Out of scope: STAT-10..14 checkbox updates, ANIM-* requirement registration, PORT-03 product decision, security gap fixes, VERIFICATION.md writing. Those are all handled in Phase 20.

</domain>

<decisions>
## Implementation Decisions

### GRID-01..10 checkbox handling
- **D-01:** Check off all 10 GRID requirements as `[x]` with no deviation annotations.
- UAT acceptance (Phase 07 human verification 6/6 APPROVED) is sufficient evidence — GRID-04 (hull polygon implementation) and GRID-06 (right-click reveal) deviations were accepted and don't need to be noted inline.

### Phase 20 overlap
- **D-02:** Phase 12 handles GRID-01..10 checkboxes now (original plan). Phase 20 will find them already done and focus on its remaining scope (STAT-10..14, ANIM-*, PORT-03, security, VERIFICATION.md artifacts).

### Dead code removal
- **D-03:** Delete `src/components/gm/ShipStatusPanel.tsx` and `src/components/gm/panels/ShipStatusToolPanel.tsx`. Both have zero active importers — confirmed safe. No additional dead code scan needed beyond these two files.

### ROADMAP.md sync depth
- **D-04:** Checkboxes only — update `[ ]` → `[x]` for all completed plan entries and the top-level phase summary list. Do not rewrite prose, scope descriptions, or success criteria. Mechanical, safe update only.

### Claude's Discretion
- Order of operations within the single plan (dead code first vs checkboxes first — doesn't matter)
- Whether to commit as one atomic commit or separate commits per concern

</decisions>

<specifics>
## Specific Ideas

No specific implementation preferences expressed — this is mechanical housekeeping with clear, enumerated success criteria.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements source of truth
- `.planning/REQUIREMENTS.md` — Current state of all requirements; GRID-01..10 section shows current unchecked state
- `.planning/ROADMAP.md` — Phase 12 plan entry, current checkbox state for all plans

### Audit findings (what needs fixing and why)
- `.planning/v1.0-MILESTONE-AUDIT.md` — Full audit report; Phase 12 gap analysis at "phase: 12-requirements-tracking-cleanup" entry; tech debt table lists exact dead code files; confirms GMUI-* and SHIP-01 already registered

### Dead code to remove
- `src/components/gm/ShipStatusPanel.tsx` — No active importers; orphaned 5s polling loop from Phase 09 refactor
- `src/components/gm/panels/ShipStatusToolPanel.tsx` — No active importers; orphaned from Phase 09 refactor

</canonical_refs>

<code_context>
## Existing Code Insights

### Dead code confirmed
- `ShipStatusPanel.tsx` and `ShipStatusToolPanel.tsx` both exist at confirmed paths; grep for active importers returned empty — safe to delete outright

### REQUIREMENTS.md current state
- GRID-01..10: all `[ ]` — need to become `[x]`
- GMUI-LAYOUT through GMUI-DISPLAY: all `[x]` — already done, nothing to do
- SHIP-01: `[x]` — already done, nothing to do

### ROADMAP.md current state
- Top-level phase list: Phases 3-5 still show `[ ]` (complete but not checked off)
- Phase plan sub-entries: many completed plans still show `[ ]`

</code_context>

<deferred>
## Deferred Ideas

- STAT-10..14 checkbox updates → Phase 20
- ANIM-VIEW, ANIM-OVERLAY, ANIM-ROOM, ANIM-BRIDGE registration → Phase 20
- PORT-03 product decision (accept revert or restore GM overlay) → Phase 20
- Security fixes (api_set_ship_location + api_bridge_selection missing @login_required) → Phase 20
- VERIFICATION.md artifacts for Phases 04, 05, 07, 08, 10, 13, 14 → Phase 20
- CHARON overlay tool on standby view (todo) → future feature phase
- NPC portraits on standby view (todo) → future feature phase

</deferred>

---

*Phase: 12-requirements-tracking-cleanup*
*Context gathered: 2026-04-14*
