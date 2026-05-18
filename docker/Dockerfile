# Stage 1: Build Vite frontend
# node:22-slim ships with corepack. We activate pnpm via corepack and install
# against the committed pnpm-lock.yaml for reproducible, fast installs.
FROM node:22-slim AS frontend-builder
WORKDIR /build

RUN corepack enable pnpm

# Copy dependency manifests first — separate cache layer from source changes
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source files for the build
COPY src/ src/
COPY vite.config.ts tsconfig.json tsconfig.node.json ./

# Build — output lands in core/static/js/ per vite.config.ts build.outDir
# Use vite directly — tsc type-checking is a separate CI concern, not part of artifact production
RUN pnpm exec vite build

# Stage 2: Python production image
FROM python:3.12-slim AS app
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings

# Build-only SECRET_KEY: needed because settings.py now exits if SECRET_KEY is unset.
# This value is used ONLY for collectstatic at build time. The runtime SECRET_KEY MUST
# be supplied via the container environment (docker-compose.yml or docker run -e).
ARG BUILD_SECRET_KEY=django-build-only-not-used-at-runtime

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Django application code
COPY . .

# gunicorn.conf.py lives in docker/ — copy it to /app where gunicorn expects it
COPY docker/gunicorn.conf.py gunicorn.conf.py

# Overwrite the empty/dev core/static/js/ with the Vite build output from the Node stage
COPY --from=frontend-builder /build/core/static/js/ core/static/js/

# Collect static files into /app/staticfiles/ for WhiteNoise — runs at BUILD time, not startup
RUN SECRET_KEY=$BUILD_SECRET_KEY python manage.py collectstatic --noinput

COPY docker/entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/docker-entrypoint.sh"]
