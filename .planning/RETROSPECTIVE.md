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

## Milestone: v2.0 — AI Tooling

**Shipped:** 2026-06-12 (work completed 2026-06-05; archived 2026-06-12)
**Phases:** 8 + 1 inserted (28.1) | **Plans:** 28

### What Was Built

- Encounter renderer deepening — four-module geometry stack (`polygon2d`, `roomGeometry`, `gridProjection`, `mapView`), canonical Door model, reveal-cascade scheduler, interaction hooks; first test infrastructure (Vitest)
- Containerization — multi-stage Docker image on GHCR, external data-directory mount, compose homelab deploy, CI publish
- JANUS MCP server — FastMCP HTTP service with campaign read/write tools delegating to Django REST
- janus-skills — standalone repo of Claude Code skills + schema references + idempotent installer
- Map playback controls (Chronoscope pill) + ad-hoc map polish pass
- MCP image upload with portrait conversion pipeline
- GM Console file editor — Monaco-based YAML/MD editing with `data-changed` SSE player refresh

### What Worked

- **MCP-delegates-to-Django pattern** — one guarded write path (traversal check, atomic YAML write, SSE broadcast) serves both MCP tools and GM Console; Phase 30 reused it unchanged
- **Renderer deepening first (21–22) before feature work** — later phases (25, 28, 30) landed on named seams instead of a 1900-LOC god component
- **Inserted gap-closure phase (28.1)** — same pattern as v1.0's Phase 20; audit → enumerate gaps → one focused phase closed all four in a day
- **Ad-hoc phase escape hatch (26)** — small polish shipped directly with a roadmap note instead of forcing plan ceremony

### What Was Inefficient

- Three phases (25, 27, 28) again skipped VERIFICATION.md at completion — the v1.0 lesson ("write it immediately, not retroactively") did not stick; 28.1 had to author them retroactively
- Phase 28's 11 UAT tests sat pending until the milestone audit flagged them
- Phase 30 executed out of order ahead of 29 without updating STATE.md — state drift discovered a week later during milestone close
- v2.0 ran without a REQUIREMENTS.md (requirements lived in per-phase CONTEXT files) — audit traceability had to reconstruct them

### Patterns Established

- **Decimal inserted phases for audit closure** (28.1) — now the standard response to gaps_found
- **Resolver-with-suggestions API shape** — 404 returns suggestions, 409 returns candidates without writing, so AI callers can ask the GM instead of failing
- **Schema docs as canonical + CI-synced** — `docs/schemas/` synced to janus-skills on push; skills never drift from server behavior

### Key Lessons

- Enforce VERIFICATION.md at phase close mechanically (verifier workflow toggle), not by convention — convention failed two milestones in a row
- Update STATE.md in the same session as any out-of-band phase execution; a one-line stopped_at edit avoids archaeology later
- Run `/gsd:new-milestone` properly at milestone start so REQUIREMENTS.md exists for the audit to trace against

### Cost Observations

- Sessions: ~29 days, ~287 commits, 314 files changed (+44.5k/−5.9k lines)
- Notable: v2.0 shipped in a third of v1.0's wall-clock time with more LOC churned — containerization + skills phases parallelized well in waves

---

## Cross-Milestone Trends

| Metric | v1.0 | v2.0 |
|--------|------|------|
| Duration | ~85 days | ~29 days |
| Phases | 19 active | 8 + 1 inserted |
| Plans | 49 | 28 |
| Requirements | 51 | ~44 (per-phase, no REQUIREMENTS.md) |
| Commits | 367 | ~287 |
| Audit cycles | 2 | 1 |
| Verification skipped, fixed retroactively | 5 phases (Phase 20) | 3 phases (Phase 28.1) |
