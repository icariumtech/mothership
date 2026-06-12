# Milestones — Mothership GM Terminal

## v2.0 — AI Tooling (SHIPPED 2026-06-12)

**Phases:** 21–28 + 28.1 (Phase 26 shipped ad-hoc in `33e3e07`) · **Plans:** 28
**Timeline:** 2026-05-08 → 2026-06-05 (~29 days, ~287 commits, 314 files, +44.5k/−5.9k lines)
**Known deferred items at close:** 17 — all pre-v2.0 leftovers (see STATE.md Deferred Items)

### Delivered

Turned the GM terminal into an AI-operable platform and finished the renderer deepening:

1. Encounter renderer deepening — four-module geometry stack (`polygon2d`, `roomGeometry`, `gridProjection`, `mapView`), canonical top-level `Door` model, reveal-cascade scheduler, interaction hooks (`useExclusivePopover`, `useTokenPlacement`, `usePanZoom`); Vitest infrastructure introduced (Phases 21–22)
2. Containerization — multi-stage Docker image on GHCR, external data-directory mount, docker-compose homelab deploy, CI publish workflow (Phase 23)
3. JANUS MCP server — standalone FastMCP HTTP service with campaign read/write tools delegating to Django, path-traversal guarded, atomic YAML writes (Phase 23)
4. janus-skills — standalone repo with 10 Claude Code skills + condensed schema references + idempotent installer for AI-driven campaign data management (Phases 24, 27)
5. Map playback controls + polish — Chronoscope play/pause/scrub overlay on system/orbit maps; planet labels, larger hit targets, view centering (Phases 25–26)
6. MCP image upload — `upload_image` tool routing portraits/logos/maps/misc with optional portrait conversion (Phase 27)
7. GM Console file editor — full-screen data-directory browser + Monaco YAML/Markdown editor with save-to-SSE broadcast; `data-changed` consumer closes the GM-edit → player-terminal-refresh loop (Phases 28, 28.1)

### Audit

2026-06-05 audit found 4 gaps (D-10 SSE consumer, Phase 28 UAT pending, missing VERIFICATION.md ×3); all closed by inserted Phase 28.1 the same day.

### Archive

- `.planning/milestones/v2.0-ROADMAP.md` — full phase details
- `.planning/milestones/v2.0-MILESTONE-AUDIT.md` — audit (gaps closed by Phase 28.1)
- `.planning/milestones/v2.0-phases/` — phase directories (plans, summaries, verifications)

---

## v1.0 — MVP (SHIPPED 2026-05-07)

**Phases:** 1–20 (Phase 6 deferred to v2) · **Plans:** 49 · **Requirements:** 51/51
**Timeline:** 2026-02-11 → 2026-05-07 (~85 days, 367 commits)

### Delivered

Turned the existing 3D map + bridge skeleton into a fully-featured GM command center:

1. Campaign LOGS tab — session logs with Markdown rendering in Bridge interface (Phases 1, 9)
2. GM-controlled encounter tokens — placement, movement, type/status distinction; SSE live updates (Phase 3)
3. Real-time SSE architecture — replaced 2s polling; ActiveView state moved out of SQLite to in-memory store (Phase 5)
4. Grid-based encounter maps — wall-segment renderer, door symbols, scanline texture, GM click-to-reveal (Phase 7)
5. GM Console redesign — view-driven architecture with ViewRail/ToolRail/SlideOutPanel, full-screen maps (Phase 8)
6. Atmospheric CRT animations — glitch view transitions, overlay entrances, room reveal flicker, bridge panel stagger (Phase 13)
7. Ship STATUS tab rework — dual terminal panels over deck map, reactor + consumable resource tracking (Phase 14)
8. Data directory restructure — per-entity character files, flat location hierarchy with self-registration, updated guide (Phases 15-19)

### Archive

- `.planning/milestones/v1.0-ROADMAP.md` — full phase details
- `.planning/milestones/v1.0-REQUIREMENTS.md` — requirements at close (51 satisfied)
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` — audit (gaps closed by Phase 20)
