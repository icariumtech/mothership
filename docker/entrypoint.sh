#!/bin/bash
# JANUS GM Tool — Docker entrypoint
# Handles CMD override for the mcp service (FIRST, before any Django work),
# database initialization, optional superuser creation, and Gunicorn startup.
# Guard-first ordering prevents SQLite lock contention when app and mcp start concurrently.
set -e

echo "=== JANUS ENTRYPOINT ==="

# CMD override guard — MUST run before migrate so the mcp service skips Django setup entirely.
# When docker-compose specifies command: ["python", "mcp_server.py"], those args arrive as "$@".
# Exec'ing them here avoids the SQLite OperationalError that occurs if both 'app' and 'mcp'
# containers race to migrate the shared bind-mounted db.sqlite3 (see 23-REVIEW.md CR-01).
if [ "$#" -gt 0 ]; then
    exec "$@"
fi

# Run Django migrations on every startup — idempotent, safe on an already-migrated database.
# Do NOT check for db.sqlite3 existence: Docker bind mounts create missing host files as
# directories, not files. Always running migrate avoids the check and the directory-vs-file trap.
python manage.py migrate --noinput

# Create superuser on first run when env vars are present.
# Django reads DJANGO_SUPERUSER_USERNAME / DJANGO_SUPERUSER_PASSWORD automatically when
# --noinput is passed (docs.djangoproject.com/en/5.2/ref/django-admin/#createsuperuser).
# 2>/dev/null silences any credential echo; || echo "..." handles the already-exists case.
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
    python manage.py createsuperuser \
        --noinput \
        --username "$DJANGO_SUPERUSER_USERNAME" \
        --email "${DJANGO_SUPERUSER_EMAIL:-admin@localhost}" \
        2>/dev/null || echo "Superuser already exists, skipping."
fi

# Default path: start Gunicorn with the gevent worker config.
# config.wsgi:application (see WSGI_APPLICATION in config/settings.py)
echo "=== Starting Gunicorn ==="
exec gunicorn \
    --config gunicorn.conf.py \
    config.wsgi:application
