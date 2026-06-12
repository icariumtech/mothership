---
phase: 23-containerization
plan: "02"
subsystem: infra
tags: [docker, dockerfile, entrypoint, gunicorn, pnpm, vite, multi-stage-build]
dependency_graph:
  requires: []
  provides: [Dockerfile, docker-entrypoint.sh]
  affects: [container-build, deployment]
tech_stack:
  added: [node:22-slim (build stage), python:3.12-slim (runtime stage), pnpm via corepack]
  patterns: [multi-stage Docker build, entrypoint CMD override guard]
key_files:
  created:
    - Dockerfile
    - docker-entrypoint.sh
  modified: []
decisions:
  - "collectstatic runs at BUILD time in Dockerfile RUN step, not at runtime startup, to avoid latency on every restart"
  - "docker-entrypoint.sh always runs migrate --noinput (idempotent) instead of checking db.sqlite3 existence — avoids Docker bind-mount directory trap (Pitfall 5)"
  - "CMD override guard (if [ \"$#\" -gt 0 ]; then exec \"$@\"; fi) placed before gunicorn exec so mcp service can bypass migration logic"
  - "Uses config.wsgi:application (not mothership.wsgi) per config/settings.py WSGI_APPLICATION"
metrics:
  duration: 77s
  completed: "2026-05-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 23 Plan 02: Dockerfile + docker-entrypoint.sh Summary

**One-liner:** Multi-stage Dockerfile (Node/pnpm Vite build + Python runtime) with first-run entrypoint handling migration, superuser creation from env vars, and mcp service CMD bypass.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Dockerfile (multi-stage Node + Python build) | 6b5fd40 | Dockerfile |
| 2 | Create docker-entrypoint.sh (first-run init + Gunicorn start) | 6e469a2 | docker-entrypoint.sh |

## What Was Built

### Dockerfile

Two-stage build producing a single Python image with no Node.js at runtime:

- **Stage 1 (frontend-builder):** `node:22-slim` with `corepack enable` for pnpm. Copies `package.json` + `pnpm-lock.yaml` first (separate cache layer), runs `pnpm install --frozen-lockfile`, then copies `src/`, `vite.config.ts`, `tsconfig.json` and runs `pnpm run build`. Output lands at `core/static/js/` per `vite.config.ts` `build.outDir`.

- **Stage 2 (app):** `python:3.12-slim` with `DJANGO_SETTINGS_MODULE=config.settings`. Installs Python deps, copies full app, overwrites `core/static/js/` with the built frontend assets (`COPY --from=frontend-builder`), runs `collectstatic --noinput` at build time, then sets `/docker-entrypoint.sh` as ENTRYPOINT.

### docker-entrypoint.sh

Shell script (executable, `set -e`) handling container startup:

1. Prints startup banner
2. Runs `python manage.py migrate --noinput` — always, idempotent, no existence check
3. Optionally creates superuser if `DJANGO_SUPERUSER_USERNAME` and `DJANGO_SUPERUSER_PASSWORD` env vars are set; uses Django's native `--noinput` env var support; suppresses credential echo with `2>/dev/null`; handles already-exists case gracefully
4. CMD override guard: `if [ "$#" -gt 0 ]; then exec "$@"; fi` — allows `mcp` service (`command: ["python", "mcp_server.py"]`) to bypass migration logic entirely
5. Default: `exec gunicorn --config gunicorn.conf.py config.wsgi:application`

## Deviations from Plan

None — plan executed exactly as written. Pattern 5 from RESEARCH.md was used verbatim for docker-entrypoint.sh. Pattern 1 from RESEARCH.md was used verbatim for Dockerfile.

## Security Notes (from Threat Model)

- **T-23-02-01 (DJANGO_SUPERUSER_PASSWORD):** Mitigated — value comes from env var only; `2>/dev/null` on `createsuperuser` suppresses any echo of credentials.
- **T-23-02-02 (mcp service migration race):** Mitigated — CMD override guard (`if [ "$#" -gt 0 ]`) ensures mcp service never runs `migrate`.
- **T-23-02-03 (db.sqlite3 bind-mount as directory):** Accepted — documented pattern: run `touch db.sqlite3` on host before first `docker compose up`. The always-run-migrate approach avoids the existence-check that would be confused by a directory.

## Known Stubs

None — these are infrastructure files with no data dependencies.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced by these files. The container build artifacts (Dockerfile, entrypoint) handle existing surface only.

## Self-Check: PASSED

- `Dockerfile` exists: FOUND
- `docker-entrypoint.sh` exists and is executable: FOUND
- Commit `6b5fd40` (Dockerfile): FOUND
- Commit `6e469a2` (docker-entrypoint.sh): FOUND
- `FROM node:22-slim AS frontend-builder`: 1 match
- `FROM python:3.12-slim AS app`: 1 match
- `collectstatic --noinput` in Dockerfile: 1 match
- `config.wsgi:application` in entrypoint: 1 match (in exec line)
- CMD override guard `exec "$@"`: 1 match
