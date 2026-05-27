---
phase: 27
slug: mcp-image-upload
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Django TestCase (`django.test.TestCase`) |
| **Config file** | none — `python manage.py test core.tests` |
| **Quick run command** | `python manage.py test core.tests.test_gm_api` |
| **Full suite command** | `python manage.py test core` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python manage.py test core.tests.test_gm_api`
- **After every plan wave:** Run `python manage.py test core`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 1 | D-06 | — | Pillow in requirements.txt; .gitkeep dirs created | smoke | `grep -c 'Pillow' requirements.txt && test -f data/campaign/images/logos/.gitkeep` | ✅ | ⬜ pending |
| 27-01-02 | 01 | 1 | D-01, D-04, D-05 | T-27-01-01 (path traversal) | POST /api/gm/upload-image/ validates filename + image_type | unit | `python manage.py test core.tests.test_upload_image` | ❌ Wave 0 | ⬜ pending |
| 27-02-01 | 02 | 2 | D-02, D-03 | — | upload_image MCP tool delegates to Django over httpx | smoke | `python -c "import ast, pathlib; ast.parse(pathlib.Path('mcp_server.py').read_text()); print('OK')"` | ✅ | ⬜ pending |
| 27-03-01 | 03 | 3 | D-07 | — | janus-upload-portrait SKILL.md present with base64 encoding example | smoke | `test -f /home/gjohnson/mothership/janus-skills/skills/janus-upload-portrait/SKILL.md && grep -c 'base64' /home/gjohnson/mothership/janus-skills/skills/janus-upload-portrait/SKILL.md` | ❌ Wave 0 | ⬜ pending |
| 27-03-02 | 03 | 3 | D-07, D-08 | — | janus-upload-image SKILL.md present with base64 encoding example | smoke | `test -f /home/gjohnson/mothership/janus-skills/skills/janus-upload-image/SKILL.md && grep -c 'base64' /home/gjohnson/mothership/janus-skills/skills/janus-upload-image/SKILL.md` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `core/tests/test_upload_image.py` — stubs for upload endpoint behaviors:
  - POST with valid portrait base64 → 200 + saved_path in response
  - POST with invalid image_type → 400
  - POST with path-traversal filename (`../foo`) → 400
  - POST with malformed base64 → 400
  - POST with convert=false → 200, no conversion triggered
  - GET method → 405

*Note: Conversion test (convert=True path) requires Pillow and writable DATA_DIR; mark that case `@unittest.skip("requires Pillow + writable DATA_DIR")` following existing pattern in `test_gm_api.py`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Actual portrait conversion produces amber-gradient PNG at 512×512 | D-03 | Requires real image file + Pillow + writable filesystem | Upload a test .jpg via janus-upload-portrait; verify `data/campaign/NPCs/images/<name>.png` is created and is 512×512 amber-toned |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
