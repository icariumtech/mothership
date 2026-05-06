# Phase 20: Audit Closure — Security + Requirements Tracking - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Close all remaining v1.0 audit gaps identified in `v1.0-MILESTONE-AUDIT.md` before milestone completion. This phase is purely housekeeping — no new features, no new capabilities. It fixes two security gaps, backfills 7 missing VERIFICATION.md artifacts, updates requirements tracking checkboxes, registers untracked ANIM-* requirements, documents an accepted design deviation (PORT-03), and removes one unnecessary API export.

</domain>

<decisions>
## Implementation Decisions

### VERIFICATION.md Approach
- **D-01:** Write **lightweight evidence-referencing** VERIFICATION.md files for phases 04, 05, 07, 08, 10, 13, 14. Each doc cites existing UAT results (pass counts, test names) and SUMMARY.md self-check evidence. No re-running code checks — the goal is to formalize what already passed, not re-verify from scratch.

### PORT-03 Design Deviation
- **D-02:** PORT-03 ("Portrait appears as overlay during encounter view") is marked `[x]` in REQUIREMENTS.md and functionally complete (Phase 11 wired NPCPortraitOverlay into GM EncounterView). However the milestone audit flags it as "design-reverted" because the overlay is GM-only — not player-terminal-facing as originally intended. **Resolution:** Add a brief note in Phase 11's VERIFICATION.md documenting this as an accepted design deviation (GM-only overlay, not player-facing). Do NOT re-open PORT-03 or change the `[x]` status.

### Tech Debt Cleanup
- **D-03:** Include removal of the `getRoomVisibility` and `setRoomVisibility` exports from `src/services/encounterApi.ts`. These functions are used only internally within encounterApi.ts — exporting them is unnecessary public API surface. Remove the two entries from the module's export list. This is a small, low-risk change.

### Claude's Discretion
- ANIM-* requirement text/descriptions can be written based on Phase 13 SUMMARY.md evidence — exact wording is Claude's choice as long as it matches what was implemented.
- VERIFICATION.md format can follow whatever minimal structure makes the evidence clearly readable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audit Source
- `.planning/v1.0-MILESTONE-AUDIT.md` — Complete list of gaps, security issues, unverified phases, and unregistered requirements. Primary driver for all Phase 20 tasks.

### Requirements Tracking
- `.planning/REQUIREMENTS.md` — Traceability table and requirement checkboxes. STAT-10..14, GRID-01..10 need `[ ]` → `[x]`. ANIM-VIEW, ANIM-OVERLAY, ANIM-ROOM, ANIM-BRIDGE need to be added as new entries.

### Security Gaps
- `terminal/views.py` — Two endpoints need `@login_required` added:
  - `api_bridge_selection` (line ~673, `@csrf_exempt` only)
  - `api_set_ship_location` (line ~706, `@csrf_exempt` only)
  - Reference: Phase 11 fixed `api_ship_update_integrity` the same way — follow that pattern.

### Tech Debt
- `src/services/encounterApi.ts` — Remove `getRoomVisibility` and `setRoomVisibility` from the module export list (line ~240-241). Functions stay in the file; only the exports are removed.

### Phases Needing VERIFICATION.md
Each of these has existing UAT evidence to reference:
- `.planning/phases/04-npc-portrait-system/04-UAT.md` — 6/6 passed
- `.planning/phases/05-real-time-push-architecture/05-UAT.md` — 5/5 passed
- `.planning/phases/07-grid-based-encounter-map-redesign/07-04-SUMMARY.md` — human verification 6/6 APPROVED
- `.planning/phases/08-rework-gm-console-ui/08-UAT.md` — 9/10 passed (1 skipped: BRIDGE dashboard TBD, accepted)
- `.planning/phases/10-player-ship-map-view/10-UAT.md` — 6/6 passed
- `.planning/phases/13-atmospheric-ui-animations-for-player-facing-transitions-and-element-reveals/` — 13-05-SUMMARY APPROVED all 4 animation systems
- `.planning/phases/14-rework-bridge-status-tab-ship-systems-remove-armor-add-react/` — 14-03-SUMMARY self-check PASSED

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Patterns
- `@login_required` decorator pattern: already imported at top of `terminal/views.py` (line 2). Phase 11 applied it to `api_ship_update_integrity` — follow identical pattern for the two new endpoints.
- REQUIREMENTS.md format: existing requirement entries use `- [x] **REQ-ID**: description` format with traceability table entries below. Match this for ANIM-* additions.

### Integration Points
- VERIFICATION.md format: existing verifications (e.g., phases 09, 11, 12) are in the same `.planning/phases/{N}-*/` directory. Each has YAML frontmatter with `status: passed`, `phase`, `date`, and a `## Verified` section.

</code_context>

<specifics>
## Specific Ideas

- PORT-03 deviation note should go in Phase 11's VERIFICATION.md (since Phase 11 is where the overlay was wired into EncounterView).
- The `api_bridge_selection` endpoint has a docstring saying "Public API endpoint to update the player's current bridge map selection. Called by the player terminal when navigating the bridge galaxy/system/orbit map." — this is a player-facing call. Confirm the auth pattern is correct before applying @login_required (player terminals are not logged in as GM). This may need further investigation during planning.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 20-audit-closure-security-requirements-tracking*
*Context gathered: 2026-05-06*
