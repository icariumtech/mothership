---
phase: 12
slug: requirements-tracking-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | npm run typecheck (TypeScript) + manual file verification |
| **Config file** | tsconfig.json |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run typecheck && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run typecheck && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | GRID-01..10 | — | N/A | manual | `grep -c '\[x\]' .planning/REQUIREMENTS.md` | ✅ | ⬜ pending |
| 12-01-02 | 01 | 1 | SHIP-01/GMUI | — | N/A | manual | `ls src/components/gm/ShipStatusPanel.tsx 2>/dev/null && echo FAIL \|\| echo DELETED` | ✅ | ⬜ pending |
| 12-01-03 | 01 | 1 | ROADMAP sync | — | N/A | manual | `grep -c '\[ \]' .planning/ROADMAP.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. This is a docs/cleanup phase — no test stubs needed. TypeScript typecheck confirms dead code removal didn't break imports.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GRID-01..10 all [x] in REQUIREMENTS.md | GRID-01..10 | Text file edit — no automated test | `grep "GRID-0" .planning/REQUIREMENTS.md` — all 10 rows should show [x] |
| ShipStatusPanel.tsx deleted | Dead code removal | File deletion | `ls src/components/gm/ShipStatusPanel.tsx` — should return "No such file" |
| ShipStatusToolPanel.tsx deleted | Dead code removal | File deletion | `ls src/components/gm/panels/ShipStatusToolPanel.tsx` — should return "No such file" |
| ROADMAP.md plan checkboxes updated | ROADMAP sync | Text file edit — no automated test | `grep "^\- \[ \]" .planning/ROADMAP.md` — should return no completed-but-unchecked plans |
| TypeScript build still passes | Build integrity | Confirms no import breakage from deletions | `npm run typecheck && npm run build` — must pass |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
