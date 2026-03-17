---
phase: 9
slug: integration-gm-bridge-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend) + TypeScript compiler (frontend) |
| **Config file** | `pytest.ini` / `tsconfig.json` |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run typecheck && python -m pytest terminal/tests/ -x -q` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run typecheck && python -m pytest terminal/tests/ -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 9-01-01 | 01 | 1 | RTMA-01 | typecheck | `npm run typecheck` | ✅ | ⬜ pending |
| 9-01-02 | 01 | 1 | PORT-03 | typecheck | `npm run typecheck` | ✅ | ⬜ pending |
| 9-01-03 | 01 | 1 | LOGS-02 | typecheck | `npm run typecheck` | ✅ | ⬜ pending |
| 9-02-01 | 02 | 1 | RTMA-01 | typecheck | `npm run typecheck` | ✅ | ⬜ pending |
| 9-02-02 | 02 | 1 | — | typecheck | `npm run typecheck` | ✅ | ⬜ pending |
| 9-02-03 | 02 | 2 | — | manual | Visual verify in browser | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Ship status updates arrive via SSE (no polling) | RTMA-01 | Requires live browser + DevTools network tab | Open DevTools → Network → Filter by EventStream. Toggle a system. Verify `shipstatus` event fires within 500ms. Verify no XHR polling for ship-status endpoint |
| NPC portrait tooltip shows on hover | PORT-03 | Visual UI behavior | Open GM console → Encounter view → NPC Portraits panel. Hover over an NPC name. Verify portrait image appears as tooltip |
| Session markdown renders correctly | LOGS-02 | Visual rendering | Open GM console → Bridge view → Session Logs panel. Click a session with markdown content (headers, lists, tables). Verify rendered markdown in modal |
| GM BridgeView dashboard layout | — | Visual/layout | Open GM console → Bridge view. Verify: breadcrumb at top showing player tab, left half shows 3D map mirror, right half shows ship schematic + system toggles |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
