# Retrospective — Mothership GM Terminal

---

## Milestone: v1.0 — MVP

**Shipped:** 2026-05-07
**Phases:** 19 active (Phase 6 deferred) | **Plans:** 49

### What Was Built

- Campaign LOGS tab — session logs with Markdown rendering in Bridge interface
- GM-controlled encounter tokens — placement, movement, type/status distinction; SSE live updates
- Real-time SSE architecture — replaced 2s polling; ActiveView moved out of SQLite to in-memory store
- Grid-based encounter maps — wall-segment renderer, door symbols, scanline texture, GM click-to-reveal
- GM Console redesign — view-driven architecture with ViewRail/ToolRail/SlideOutPanel, full-screen maps
- Atmospheric CRT animations — glitch view transitions, overlay entrances, room reveal flicker, bridge panel stagger
- Ship STATUS tab rework — dual terminal panels over deck map, reactor + consumable resource tracking
- Data directory restructure — per-entity character files, flat location hierarchy with self-registration

### What Worked

- **YAML → DataLoader → API → React pattern** held up across every feature phase; no deviation needed
- **SSE named events** (activeview, shipstatus, bridge) were clean to add incrementally — each event type is independent
- **Wall-segment algorithm** (edge-count exclusion) elegantly handled L/T/U shapes without explicit config
- **View-driven GM Console** with purely local GMViewType state kept the architecture clean — DISPLAY button is the only server-touching action
- **Phase 20 as explicit audit-closure phase** was effective — treating documentation gaps as a real phase with a plan and verification worked well
- **Per-entity character files** made manual YAML editing much easier; glob-based loading was a clean pattern

### What Was Inefficient

- Phase 12 was planned but sat empty for several phases before being executed — tracking gap meant multiple phases built on unverified foundations
- Audit discovered Phase 18 plans showed `[ ]` in ROADMAP despite being complete — progress table fell out of sync with execution
- PORT-03 was verified in Phase 11, then immediately reverted by design decision — verification-then-revert created confusion in the audit trail
- Several early phases (04, 05, 07, 08, 10) skipped formal VERIFICATION.md — required Phase 20 to retroactively author evidence-referencing files

### Patterns Established

- **Evidence-referencing VERIFICATION.md**: Lightweight verification file that cites UAT pass counts and SUMMARY artifact paths rather than re-verifying from scratch — useful when phase is functionally proven but missing formal gate
- **Intentionally-public docstring pattern**: For endpoints that must remain unauthenticated by design (e.g., player-terminal callers), a prominent `# INTENTIONALLY UNAUTHENTICATED` docstring prevents future security audits from flagging it as an oversight
- **Audit-closure phase**: When multiple documentation and housekeeping gaps accumulate, treat them as a real phase (plan → execute → verify) rather than ad-hoc fixes across sessions
- **Deferred human verification**: `status: human_needed` in VERIFICATION.md is acceptable for browser-visual checks that can't be programmatically verified — don't block milestone close for these

### Key Lessons

- Keep ROADMAP.md progress table in sync with each phase completion — stale checkboxes caused audit confusion
- Write VERIFICATION.md immediately after each phase, not retroactively — the Phase 20 retroactive effort was avoidable
- Design decisions that revert verified functionality should be committed with a clear message AND appended to the phase's VERIFICATION.md immediately
- Audit as a checkpoint before milestone close (not just before shipping) surfaces gaps while context is fresh — the two-audit pattern (2026-03-25, 2026-04-15) worked well

### Cost Observations

- Sessions: ~85 days, 367 commits
- Notable: Data directory phases (15-19) were smaller, faster phases — splitting cleanly by concern (audit→consolidate→split→restructure→document) kept each phase focused

---

## Cross-Milestone Trends

*(Will be updated as future milestones complete)*

| Metric | v1.0 |
|--------|------|
| Duration | ~85 days |
| Phases | 19 active |
| Plans | 49 |
| Requirements | 51 |
| Commits | 367 |
| Audit cycles | 2 |
