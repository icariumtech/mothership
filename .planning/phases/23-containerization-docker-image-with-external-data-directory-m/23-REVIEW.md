---
phase: 23-containerization-docker-image-with-external-data-directory-m
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - .github/workflows/docker-publish.yml
  - Dockerfile
  - config/settings.py
  - core/data_loader.py
  - core/sse_broadcaster.py
  - core/tests/__init__.py
  - core/tests/test_gm_api.py
  - core/urls.py
  - core/views/__init__.py
  - core/views/gm_data.py
  - docker-compose.yml
  - docker-entrypoint.sh
  - gunicorn.conf.py
  - mcp_server.py
  - requirements.txt
findings:
  critical: 2
  warning: 5
  info: 2
  total: 9
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-05-17
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 23 implements Docker containerization for the Mothership GM Terminal: a multi-stage Dockerfile, gunicorn/gevent production server, FastMCP server for AI agent access, a GM data REST API (4 endpoints), and a GitHub Actions publish workflow. The implementation is generally well-structured with correct path-traversal guards on the primary file API and sound atomic write logic. Two blockers require fixes before deployment: a startup race condition in the entrypoint script and a silent-fail path for missing secrets in settings.py.

## Critical Issues

### CR-01: `docker-entrypoint.sh` runs `migrate` before the CMD override guard — mcp service triggers SQLite race condition

**File:** `docker-entrypoint.sh:12` and `docker-entrypoint.sh:30`

**Issue:** The entrypoint unconditionally runs `python manage.py migrate --noinput` on line 12. The CMD override guard (`if [ "$#" -gt 0 ]`) that is supposed to skip the migration for the `mcp` service is on line 30 — *after* the migration has already executed. The comment on line 29 explicitly states "The mcp service must NOT run migrations (race condition with the app service)," but the code does not implement that intent. When `docker compose up` starts both services simultaneously, both containers attempt to run `migrate` against the same bind-mounted `db.sqlite3`, which causes SQLite `OperationalError: database is locked`. Because `set -e` is active, this kills the `mcp` container before it starts.

**Fix:** Move the CMD override guard to before the `migrate` call:

```bash
#!/bin/bash
set -e

echo "=== MOTHERSHIP ENTRYPOINT ==="

# CMD override guard — MUST run first so the mcp service skips Django setup entirely.
if [ "$#" -gt 0 ]; then
    exec "$@"
fi

# Default path (app service): run migrations and optionally create superuser.
python manage.py migrate --noinput

if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
    python manage.py createsuperuser \
        --noinput \
        --username "$DJANGO_SUPERUSER_USERNAME" \
        --email "${DJANGO_SUPERUSER_EMAIL:-admin@localhost}" \
        2>/dev/null || echo "Superuser already exists, skipping."
fi

echo "=== Starting Gunicorn ==="
exec gunicorn \
    --config gunicorn.conf.py \
    config.wsgi:application
```

---

### CR-02: `settings.py` defaults `DEBUG=True` — container is exploitable if `SECRET_KEY` env var is absent

**File:** `config/settings.py:30-33`

**Issue:** Two settings have unsafe defaults that work together to create an exploitable condition:

1. `SECRET_KEY` falls back to a hardcoded insecure string (`'django-insecure-l_lzruv)...'`) if the env var is absent.
2. `DEBUG` defaults to `'True'`, so if the container is started without `DEBUG=False` in the environment, Django runs in debug mode — exposing full tracebacks, internal settings, and source snippets via the error pages to anyone who can reach port 8000.

`docker-compose.yml` sets both values correctly, but a container run directly from the image (`docker run ghcr.io/.../mothership:latest`) inherits neither override. Because port 8000 is published to `0.0.0.0`, any host on the LAN can trigger a traceback that leaks the insecure `SECRET_KEY` value, enabling session forgery.

**Fix:** Remove the insecure fallbacks. Fail at startup when required values are absent:

```python
import sys

SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    print("FATAL: SECRET_KEY environment variable is required", file=sys.stderr)
    sys.exit(1)

DEBUG = os.environ.get('DEBUG', 'False') == 'True'
```

For the build-time `collectstatic` step in the Dockerfile, pass a throwaway key as a build arg:

```dockerfile
ARG BUILD_SECRET_KEY=django-build-only-not-used-at-runtime
RUN SECRET_KEY=$BUILD_SECRET_KEY python manage.py collectstatic --noinput
```

---

## Warnings

### WR-01: No `.dockerignore` — `COPY . .` bakes `.env` and campaign data into the image

**File:** `Dockerfile:33`

**Issue:** There is no `.dockerignore` file. `COPY . .` in the app stage copies the entire project directory, including:
- `.env` (contains `ANTHROPIC_API_KEY` and `OBSIDIAN_VAULT_PATH`)
- `data/` (the entire campaign data directory — potentially hundreds of MB of YAML/markdown)
- `db.sqlite3` (the local development database, if present)
- `.planning/`, `codemaps/`, etc.

The `.env` file being baked into the image is a secret-leakage risk: anyone who pulls the image from GHCR can extract the API key with `docker run --rm --entrypoint cat <image> /app/.env`.

**Fix:** Create `.dockerignore`:

```
.env
.envrc
data/
db.sqlite3
.planning/
codemaps/
sample_ui/
tools/
*.md
!DATA_DIRECTORY_GUIDE.md
__pycache__/
*.pyc
.git/
node_modules/
```

---

### WR-02: `load_campaign_doc` in `data_loader.py` has no path-traversal guard on the slug

**File:** `core/data_loader.py:284-299`

**Issue:** `load_campaign_doc(slug)` constructs the file path as `docs_dir / f"{slug}.md"` with no `.resolve()` + `.is_relative_to()` guard. Django's `<str:slug>` URL converter allows the `.` character, so a request to `/api/gm/campaign-docs/../ship/ship/` fails to route (because `str:` blocks `/`) — but a slug like `..` is a valid `str:` value and resolves to `docs_dir / "../.md"` = `/app/data/campaign/.md`. More critically, a client that calls the Django API directly (rather than through the URL router) — including the MCP `read_file` tool — can supply arbitrary path components, and the function will silently open any `.md` file reachable with one level of `..` traversal from `docs_dir`.

The primary `api_gm_data_file` view has the correct guard; this function does not.

**Fix:**

```python
def load_campaign_doc(self, slug: str) -> Dict[str, Any]:
    docs_dir = (self.data_dir / "campaign" / "docs").resolve()
    doc_file = (docs_dir / f"{slug}.md").resolve()
    if not doc_file.is_relative_to(docs_dir):
        return None  # treat as not found; caller returns 404
    if not doc_file.exists():
        return None
    ...
```

---

### WR-03: `docker-compose.yml` has no healthcheck — `depends_on` does not wait for app readiness

**File:** `docker-compose.yml:38-39`

**Issue:** `depends_on: app` only waits for the `app` container to *start*, not for Django/Gunicorn to be ready to serve requests. The `mcp` service may attempt to call `http://app:8000/api/gm/...` before Gunicorn has finished startup, causing immediate `httpx` connection errors and `raise_for_status()` exceptions in every MCP tool call.

**Fix:** Add a healthcheck to the `app` service and use `condition: service_healthy` in `mcp`:

```yaml
services:
  app:
    ...
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/active-view/')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s

  mcp:
    ...
    depends_on:
      app:
        condition: service_healthy
```

---

### WR-04: `settings.py` — `ALLOWED_HOSTS` defaults to `'*'` with no production warning

**File:** `config/settings.py:35`

**Issue:** The default `ALLOWED_HOSTS = '*'` disables Django's `Host` header validation entirely. The comment acknowledges this ("change this in production"), but there is no enforcement mechanism. When `DEBUG=False` (as set in `docker-compose.yml`), `ALLOWED_HOSTS='*'` means Django will serve requests with any `Host` header, making it trivially exploitable for [host header injection attacks](https://docs.djangoproject.com/en/5.2/topics/security/#host-headers-virtual-hosting) — including password reset link poisoning if that feature were ever added.

For this homelab deployment the practical risk is low, but the default should not be `*`.

**Fix:** Change the default to `localhost,127.0.0.1` and require explicit configuration:

```python
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
```

---

### WR-05: Dockerfile runs as root — no `USER` instruction

**File:** `Dockerfile:21-45`

**Issue:** The app stage has no `USER` instruction. The container process runs as `root` (UID 0). Combined with the `./data` bind mount, a path-traversal or code-execution vulnerability would give an attacker write access to any file on the host filesystem reachable by the bind mount. This is a standard Docker hardening requirement.

**Fix:** Add a non-root user before `ENTRYPOINT`:

```dockerfile
RUN addgroup --system app && adduser --system --ingroup app app
RUN chown -R app:app /app /docker-entrypoint.sh
USER app
EXPOSE 8000
ENTRYPOINT ["/docker-entrypoint.sh"]
```

Note: if `app` user lacks write permission to `/app/db.sqlite3` at runtime, the bind mount's ownership needs to match. Set the `user:` field in `docker-compose.yml` to match the host UID or `chmod` the bind-mount target accordingly.

---

## Info

### IN-01: GitHub Actions — action versions use floating tags, not pinned SHAs

**File:** `.github/workflows/docker-publish.yml:21-43`

**Issue:** All five actions use floating version tags (`@v4`, `@v3`, `@v5`, `@v6`) rather than pinned commit SHAs. A compromised action maintainer can push a new commit to the same tag and inject malicious code into the build workflow. This pushes images to GHCR that users of the image then pull.

**Fix:** Pin each action to a specific commit SHA:

```yaml
uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
uses: docker/setup-buildx-action@6524bf65af31da8d45b59e8c27de4bd072b392f5  # v3.8.0
```

Look up current SHAs at `https://github.com/<org>/<action>/releases`.

---

### IN-02: `gunicorn.conf.py` — redundant `monkey.patch_all()` in `post_fork`

**File:** `gunicorn.conf.py:13-15`

**Issue:** When `worker_class = 'gevent'`, Gunicorn's `GeventWorker` already calls `gevent.monkey.patch_all()` internally during worker initialization (after fork). The `post_fork` hook adds a second call. `patch_all()` is idempotent in recent gevent versions, so this does not cause errors in practice, but it obscures intent and may mask issues if the gevent version changes behavior.

**Fix:** Remove the `post_fork` hook. The gevent worker handles patching:

```python
# post_fork is not needed — GeventWorker calls monkey.patch_all() internally.
```

---

_Reviewed: 2026-05-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
