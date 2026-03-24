---
phase: 11
slug: close-functional-security-gaps
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | No automated test framework — TypeScript compiler + manual UAT |
| **Config file** | `tsconfig.json` |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run typecheck && npm run build` |
| **Estimated runtime** | ~15 seconds (typecheck) / ~45 seconds (build) |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run typecheck && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green + manual UAT on all 4 success criteria
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | STAT-06 | manual | `npm run typecheck` (type safety check) | ✅ | ⬜ pending |
| 11-01-02 | 01 | 1 | PORT-03 | manual | `npm run typecheck` (prop types verified) | ✅ | ⬜ pending |
| 11-01-03 | 01 | 1 | SHIP-01 | manual | `npm run typecheck` (callback type verified) | ✅ | ⬜ pending |
| 11-01-04 | 01 | 1 | cosmetic | manual | `npm run typecheck && npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — existing TypeScript tooling covers all automated checks for this phase. No new test infrastructure needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `@login_required` blocks unauthenticated POST to `/api/gm/ship-status/integrity/` | STAT-06 | Requires HTTP request without auth cookie | Log out of Django admin, POST to `/api/gm/ship-status/integrity/` — expect redirect to login (302), not 200 |
| NPCPortraitOverlay renders in GM EncounterView when portrait toggled | PORT-03 | Requires browser rendering + SSE | Open GM console → Encounter view, toggle an NPC portrait in Portraits panel — portrait overlay must appear on GM screen |
| Right-click "Set Ship Here" in Encounter Locations panel | SHIP-01 | Requires browser interaction | Open GM console → Encounter view → Locations slide-out, right-click any location node — "Set Ship Here" must appear in context menu |
| No "No ship data available" flash on GM console load | cosmetic | Requires browser observation | Hard-refresh GM console, watch STATUS section — must show ship data immediately with no blank/loading flash |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
