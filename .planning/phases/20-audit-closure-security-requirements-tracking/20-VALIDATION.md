---
phase: 20
slug: audit-closure-security-requirements-tracking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-07
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Django test runner / TypeScript compiler |
| **Config file** | none — using existing infrastructure |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run typecheck` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run typecheck`
- **Before `/gsd-verify-work`:** TypeScript must be clean
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | — | T-20-01 | api_set_ship_location requires auth | manual | grep @login_required terminal/views.py | ✅ | ⬜ pending |
| 20-01-02 | 01 | 1 | STAT-10..14 | — | N/A | manual | grep "\[x\].*STAT-1[0-4]" .planning/REQUIREMENTS.md | ✅ | ⬜ pending |
| 20-01-03 | 01 | 1 | GRID-01..10 | — | N/A | manual | verify already done | ✅ | ⬜ pending |
| 20-01-04 | 01 | 1 | ANIM-VIEW etc | — | N/A | manual | grep ANIM- .planning/REQUIREMENTS.md | ✅ | ⬜ pending |
| 20-01-05 | 01 | 1 | — | — | N/A | automated | `npm run typecheck` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. This phase modifies YAML frontmatter, Python decorators, and TypeScript exports — no new test fixtures needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| VERIFICATION.md accuracy | PORT-03 deviation, phase verifications | Content quality | Read each VERIFICATION.md, confirm it cites correct UAT evidence |
| api_set_ship_location auth | Security | Runtime auth behavior | Login as GM, confirm endpoint works; logout, confirm 302 redirect |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
