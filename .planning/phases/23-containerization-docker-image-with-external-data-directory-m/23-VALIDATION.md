---
phase: 23
slug: containerization-docker-image-with-external-data-directory-m
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-16
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (Django) + docker CLI smoke tests |
| **Config file** | `pytest.ini` / `manage.py test` |
| **Quick run command** | `python manage.py test core.tests --verbosity=2` |
| **Full suite command** | `python manage.py test --verbosity=2` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python manage.py test core.tests --verbosity=2`
- **After every plan wave:** Run `python manage.py test --verbosity=2`
- **Before `/gsd-verify-work`:** Full suite must be green + docker build succeeds
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 23-01-01 | 01 | 1 | — | — | Django serves static files correctly | manual | `docker build -t mothership-test . && docker run --rm mothership-test python manage.py collectstatic --no-input` | ❌ W0 | ⬜ pending |
| 23-01-02 | 01 | 1 | — | — | Gunicorn starts without error | manual | `docker run --rm -e SECRET_KEY=test mothership-test gunicorn mothership.wsgi:application --check-config` | ❌ W0 | ⬜ pending |
| 23-02-01 | 02 | 1 | — | — | GM data API list endpoint returns 200 | unit | `python manage.py test core.tests.test_gm_api -k test_list_files` | ❌ W0 | ⬜ pending |
| 23-02-02 | 02 | 1 | — | — | GM data API read endpoint returns YAML content | unit | `python manage.py test core.tests.test_gm_api -k test_read_file` | ❌ W0 | ⬜ pending |
| 23-02-03 | 02 | 1 | — | — | GM data API write endpoint saves file + broadcasts SSE | unit | `python manage.py test core.tests.test_gm_api -k test_write_file` | ❌ W0 | ⬜ pending |
| 23-02-04 | 02 | 1 | — | — | Session context endpoint returns JSON with encounter+ship state | unit | `python manage.py test core.tests.test_gm_api -k test_session_context` | ❌ W0 | ⬜ pending |
| 23-03-01 | 03 | 2 | — | — | FastMCP server starts and tools are registered | manual | `python mcp_server.py --check` or inspect tool list | ❌ W0 | ⬜ pending |
| 23-04-01 | 04 | 3 | — | — | GitHub Actions workflow file is valid YAML | automated | `python -c "import yaml; yaml.safe_load(open('.github/workflows/docker-publish.yml'))"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `core/tests/test_gm_api.py` — stubs for GM data API endpoints (list, read, write, session-context)
- [ ] `core/tests/__init__.py` — ensure tests package exists
- [ ] `pytest` or `python manage.py test` — confirm test runner works

*Existing Django test infrastructure likely covers most of this — check `python manage.py test --list` first.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Docker image builds successfully | D-01 | Requires Docker daemon | `docker build -t mothership:test .` — must exit 0 |
| Container starts with mounted data volume | D-04 | Requires Docker + sample data dir | `docker run -v $(pwd)/data:/app/data ... mothership:test` — Django startup must succeed |
| Entrypoint first-run init creates superuser | D-06 | Requires Docker + fresh db.sqlite3 | Run with `DJANGO_SUPERUSER_*` env vars; check admin login works |
| MCP server tools callable over HTTP | D-14/D-16 | Requires running compose stack | Use MCP client or curl to call `get_session_context` tool |
| SSE broadcast fires after PUT write | D-10 | Requires browser + WebSocket | Open player terminal, PUT to write API, confirm terminal updates |
| docker-compose.yml pulls both services | D-03/D-17 | Requires GHCR + compose | `docker compose pull && docker compose up -d` — both services healthy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
