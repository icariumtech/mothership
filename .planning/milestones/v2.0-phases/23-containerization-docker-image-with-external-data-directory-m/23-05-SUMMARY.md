---
phase: 23-containerization
plan: "05"
subsystem: infra
tags: [docker, docker-compose, github-actions, ghcr, ci-cd, homelab-deployment]
dependency_graph:
  requires:
    - phase: 23-containerization
      plan: "02"
      provides: Dockerfile, docker-entrypoint.sh (CMD override guard)
    - phase: 23-containerization
      plan: "04"
      provides: mcp_server.py (target of mcp service command override)
  provides: [docker-compose.yml, .github/workflows/docker-publish.yml]
  affects: [homelab-deployment, ghcr-ci-pipeline, mcp-service-orchestration]
tech_stack:
  added: []
  patterns:
    - "Two services from one image — app and mcp services both pull ghcr.io/icariumtech/mothership:latest"
    - "CMD override pattern — mcp service command: [python, mcp_server.py] bypasses entrypoint migration logic"
    - "GitHub Actions layer cache (type=gha) for fast incremental Docker builds"
    - "Shell env var injection — ${SECRET_KEY} syntax ensures operator never commits secrets"
key_files:
  created:
    - docker-compose.yml
    - .github/workflows/docker-publish.yml
  modified: []
decisions:
  - "docker-compose.yml uses Compose v2 format (no version: key) — deprecated in Compose v2"
  - "mcp service has depends_on: [app] so app service runs migrations before mcp connects to shared db.sqlite3"
  - "ANTHROPIC_API_KEY and DJANGO_SUPERUSER_* env vars have safe defaults (${VAR:-default}) so docker compose up does not fail if only SECRET_KEY is set"
  - "workflow_dispatch trigger added per plan's Claude's Discretion note — allows manual build from GitHub Actions UI"
metrics:
  duration: 92s
  completed: "2026-05-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 23 Plan 05: docker-compose.yml + docker-publish.yml Summary

**One-liner:** Homelab deployment via docker-compose.yml (two services, shared GHCR image, shared volume mounts) and CI via docker-publish.yml (builds and pushes to GHCR on push to main with GitHub Actions layer cache).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create docker-compose.yml with two services and shared volume mounts | 567b1c9 | docker-compose.yml |
| 2 | Create .github/workflows/docker-publish.yml for GHCR CI push | 259af99 | .github/workflows/docker-publish.yml |

## What Was Built

### docker-compose.yml

Homelab deployment configuration with two services sharing the same GHCR image:

- **app service:** Pulls `ghcr.io/icariumtech/mothership:latest`, binds port 8000, mounts `./data:/app/data` and `./db.sqlite3:/app/db.sqlite3`. Passes full environment including `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `ANTHROPIC_API_KEY`, superuser env vars, and `DATA_DIR=/app/data`. Runs default entrypoint (migrate + gunicorn).

- **mcp service:** Same image, overrides command to `["python", "mcp_server.py"]` which causes docker-entrypoint.sh's CMD guard (`if [ "$#" -gt 0 ]; then exec "$@"; fi`) to exec mcp_server.py directly, skipping migrations. Binds port 8001. Mounts same volumes as app service (D-17). Subset of env vars (SECRET_KEY, DEBUG, DATA_DIR). Depends on app service.

- **Comment block:** Instructs operator to run `touch db.sqlite3` before first `docker compose up` (Pitfall 5 mitigation — Docker creates bind-mount targets as directories if the host file is missing).

### .github/workflows/docker-publish.yml

CI workflow populating GHCR on every push to main:

- **Triggers:** `push: branches: [main]` and `workflow_dispatch` for manual builds.
- **Permissions:** `contents: read`, `packages: write` — required for GHCR push with GITHUB_TOKEN.
- **Steps:** checkout@v4 → setup-buildx@v3 → login-action@v3 (ghcr.io, GITHUB_TOKEN) → metadata-action@v5 (tags: latest on main, sha-{sha} always) → build-push-action@v6 (push: true, GitHub Actions layer cache).
- **No repository secrets required** beyond the auto-provided GITHUB_TOKEN.

## Deviations from Plan

None — plan executed exactly as written. Both files match the exact specifications from RESEARCH.md Patterns 6 and 7, CONTEXT.md decisions, and the plan's interfaces block.

## Security Notes (from Threat Model)

- **T-23-05-01 (SECRET_KEY):** Mitigated — `${SECRET_KEY}` syntax reads from shell env; value never committed.
- **T-23-05-02 (DJANGO_SUPERUSER_PASSWORD):** Mitigated — same shell env var pattern.
- **T-23-05-03 (mcp service migration race):** Mitigated — `command: ["python", "mcp_server.py"]` causes entrypoint CMD guard to exec mcp_server.py directly, confirmed by reading docker-entrypoint.sh lines 30-32.
- **T-23-05-04 (db.sqlite3 directory trap):** Mitigated — comment on line 2 of docker-compose.yml warns operator.
- **T-23-05-05 (supply chain):** Accepted — GHCR image is from project's own repository under github.actor credentials.

## Known Stubs

None — these are infrastructure/configuration files with no data dependencies.

## Threat Flags

None — no new network endpoints beyond port 8000 (app) and port 8001 (mcp) which are already in the threat model from Plans 02 and 04. No new auth paths or schema changes.

## Self-Check: PASSED

- `docker-compose.yml` exists: FOUND
- `.github/workflows/docker-publish.yml` exists: FOUND
- Commit `567b1c9` (docker-compose.yml): FOUND
- Commit `259af99` (docker-publish.yml): FOUND
- `ghcr.io` in docker-compose.yml: 2 matches (one per service)
- `app/data` in docker-compose.yml: 4 matches (both services, both volume lines)
- `mcp_server.py` in docker-compose.yml: 1 match
- `db.sqlite3` in docker-compose.yml: 3 matches
- No `version:` key in docker-compose.yml: confirmed
- `packages: write` in docker-publish.yml: 1 match
- `build-push-action` in docker-publish.yml: 1 match
- `GITHUB_TOKEN` in docker-publish.yml: 1 match
- `type=gha` cache in docker-publish.yml: confirmed
- docker-publish.yml YAML validity: Python yaml.safe_load exits 0
