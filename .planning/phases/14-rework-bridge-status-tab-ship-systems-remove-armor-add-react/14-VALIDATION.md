---
phase: 14
slug: rework-bridge-status-tab-ship-systems-remove-armor-add-react
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-07
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler + ad-hoc Python assertions |
| **Config file** | `tsconfig.json` (TypeScript), inline Python scripts |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~14 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 14 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-T1 | 01 | 1 | STAT-11, STAT-12 | — | N/A (data schema) | integration | `python -c "import yaml; d=yaml.safe_load(open('data/campaign/ship.yaml')); assert 'reactor' in d['ship']['systems']; assert 'resources' in d['ship']" && npm run typecheck` | N/A | ⬜ pending |
| 14-01-T2 | 01 | 1 | STAT-12 | T-14-01, T-14-02 | @login_required + allowlist validation on resource endpoint | integration | `python -c "from terminal.views import api_ship_update_resource; print('OK')" && python -c "from terminal.urls import urlpatterns; assert 'api/gm/ship-status/resource/' in [str(p.pattern) for p in urlpatterns]" && python3 -c "from terminal.data_loader import DataLoader; d=DataLoader().load_ship_status(); assert 'resources' in d.get('ship',{})" && npm run typecheck` | N/A | ⬜ pending |
| 14-02-T1 | 02 | 2 | STAT-10, STAT-14 | — | N/A (CSS only) | structural | `grep -c 'terminal-panel' src/components/domain/dashboard/sections/StatusSection.css && grep -c 'fade-slide-in' src/components/domain/dashboard/sections/StatusSection.css && grep -c 'schematicGlitchIn' src/components/domain/dashboard/sections/StatusSection.css` | N/A | ⬜ pending |
| 14-02-T2 | 02 | 2 | STAT-10, STAT-14 | — | N/A (read-only player view) | build | `npm run typecheck && npm run build` | N/A | ⬜ pending |
| 14-03-T1 | 03 | 2 | STAT-13 | T-14-06 | InputNumber min/max constraints; backend allowlist | build | `grep "reactor: 'Reactor'" src/components/gm/views/BridgeView.tsx && grep "handleResourceChange" src/components/gm/views/BridgeView.tsx && npm run typecheck` | N/A | ⬜ pending |
| 14-03-T2 | 03 | 2 | STAT-13 | — | N/A (label addition) | build | `grep "reactor: 'Reactor'" src/components/gm/ShipStatusPanel.tsx && npm run typecheck` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No Wave 0 needed:
- TypeScript compiler (`npm run typecheck`) validates all TS changes
- Vite build (`npm run build`) validates bundling
- Inline Python assertions validate YAML schema and Django endpoint wiring

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two floating terminal panels render over deck map | STAT-10 | Visual layout verification | Open player terminal, navigate to Bridge > STATUS tab, confirm left (systems) and right (resources) panels float over map |
| Stagger-in animation fires on tab load | STAT-14 | Animation timing verification | Switch away from STATUS tab and back; rows should appear sequentially top-to-bottom |
| Change-flash fires on SSE update | STAT-14 | Animation + SSE integration | Toggle a system status from GM console; observe 600ms row flash on player terminal |
| Resource InputNumber spinners update via SSE | STAT-13 | End-to-end GM interaction | Change fuel value in GM BridgeView; confirm player terminal updates |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 14s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-07
