#!/bin/bash
# Mothership GM Terminal — Docker entrypoint
# Handles first-run database initialization, optional superuser creation,
# CMD override for the mcp service, and Gunicorn startup.
set -e

echo "=== MOTHERSHIP ENTRYPOINT ==="

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

# CMD override guard — CRITICAL for the mcp service.
# When docker-compose specifies command: ["python", "mcp_server.py"], those args are
# passed as "$@" to this entrypoint. Exec them directly, skipping migrate and createsuperuser.
# The mcp service must NOT run migrations (race condition with the app service — Pitfall 6).
if [ "$#" -gt 0 ]; then
    exec "$@"
fi

# Default path: start Gunicorn with the gevent worker config.
# config.wsgi:application — NOT mothership.wsgi (see config/settings.py WSGI_APPLICATION).
echo "=== Starting Gunicorn ==="
exec gunicorn \
    --config gunicorn.conf.py \
    config.wsgi:application
