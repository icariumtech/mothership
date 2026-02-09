# External Integrations

**Analysis Date:** 2026-02-09

## APIs & External Services

**Anthropic Claude API:**
- Service: Claude LLM for CHARON AI responses
- What it's used for: Generate AI-driven responses for CHARON terminal system
  - Multi-channel conversation support (story, bridge, encounter-specific channels)
  - Location-aware responses using campaign knowledge
  - Moderation workflow (GM reviews/edits before displaying to players)
- SDK/Client: `anthropic` Python package (>= 0.39.0)
- Model: `claude-sonnet-4-20250514` (configured in `terminal/charon_ai.py`)
- Auth: `ANTHROPIC_API_KEY` environment variable
- Implementation: `terminal/charon_ai.py` (CharonAI class) and API endpoints in `terminal/views.py`
- Endpoint Pattern: All CHARON API endpoints prefixed with `/api/charon/` and `/api/gm/charon/`

**Obsidian Integration (Optional):**
- Service: Local Obsidian vault access for campaign knowledge
- What it's used for: Extract campaign lore and context to enhance Claude responses
- Implementation: `terminal/charon_knowledge.py` (CharonKnowledgeLoader)
- Auth: File system path only (no authentication)
- Configuration: `OBSIDIAN_VAULT_PATH` environment variable
- Note: Optional - system works without Obsidian integration (graceful degradation)

## Data Storage

**Databases:**
- SQLite 3 (file-based)
  - Location: `db.sqlite3` in project root
  - Client: Django ORM
  - Purpose: Stores application state only (ActiveView singleton, Messages, User auth)
  - Connection: Configured in `mothership_gm/settings.py` DATABASES setting
  - Size: Minimal (only state tracking, not campaign data)

**File Storage:**
- Local filesystem only
  - `data/` directory: Campaign YAML and Markdown files
  - `data/campaign/` - Campaign YAML files (crew, missions, notes)
  - `data/galaxy/` - Galaxy hierarchy (systems, planets, facilities)
  - `data/charon/` - CHARON configuration and knowledge context
  - `terminal/static/js/` - Built frontend JavaScript bundles
  - `terminal/templates/` - Django HTML templates
  - No cloud storage integration
- Image handling: Pillow (PIL) for image processing in utility scripts (`scripts/convert_*.py`)

**Caching:**
- File-based cache backend
  - Location: `/tmp/django_cache/`
  - TTL: 4 hours (14400 seconds, matches CACHE_TTL in `terminal/charon_session.py`)
  - Purpose: Store CHARON session data and conversation context
  - Configuration: `CACHES` setting in `mothership_gm/settings.py`

## Authentication & Identity

**Auth Provider:**
- Custom Django authentication (built-in Django User model)
  - Implementation: `django.contrib.auth` middleware and decorators
  - Pattern: Login required for GM console (`@login_required` decorator in `terminal/views.py`)
  - No external identity provider (GitHub, Google, etc.)

**Session Management:**
- Django session middleware (configured in MIDDLEWARE)
- Session storage: Database-backed (default Django configuration)
- CSRF Protection: Django CSRF middleware with token extraction in `src/services/api.ts`
  - Frontend intercepts requests to add `X-CSRFToken` header
  - Token extracted from `csrftoken` cookie via JavaScript

**Public Access:**
- Player terminal (`/terminal/`) - Public endpoints (no login required)
- Message API (`/api/messages/`) - Public endpoint (displays broadcast messages only)
- CHARON conversation endpoints - Public for players, GM endpoints require authentication

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, Rollbar, or similar integration
- Manual error logging via Python print() statements and Django logs

**Logs:**
- Django console output (development server logs)
- No log aggregation service detected
- CHARON generation includes fallback responses for API failures (`terminal/charon_ai.py`)

## CI/CD & Deployment

**Hosting:**
- Self-hosted (no AWS, Heroku, Vercel, etc. detected)
- Target: Local development machine or self-managed server
- Deployment: Manual (no CI/CD pipeline detected)

**CI Pipeline:**
- None detected - No GitHub Actions, GitLab CI, Jenkins, etc.
- Build: Manual via `npm run build` and Django management commands

**Build Process:**
- Frontend: Vite build with multi-entry rollup configuration
  - Outputs to `terminal/static/js/`
  - Bundles: `shared-console.bundle.js`, `gm-console.bundle.js`, `player-console.bundle.js`, `test-panel.bundle.js`
  - CSS inlined into JS bundles (no separate CSS files)
- Backend: Django collectstatic for static file serving

**Startup:**
- Development: `./start_server.sh` starts Django on port 8000
- Vite dev server runs on port 5173 (with proxy to Django for `/api` and `/gmconsole`)

## Environment Configuration

**Required env vars:**
- `ANTHROPIC_API_KEY` - Claude API key (required for AI features)

**Optional env vars:**
- `OBSIDIAN_VAULT_PATH` - Path to Obsidian vault (leave empty if not using)

**Secrets location:**
- `.env` file in project root (gitignored, not committed)
- `.env.example` provides template for setup

**Configuration files:**
- `data/charon/context.yaml` - CHARON system prompt and config (fallback in code if missing)
- Django settings in `mothership_gm/settings.py`:
  - `SECRET_KEY` - Django secret (hardcoded in development, change for production)
  - `DEBUG = True` - Development mode
  - `ALLOWED_HOSTS = ['*']` - Accept all hosts (change for production)

## Webhooks & Callbacks

**Incoming:**
- None detected - No webhook receivers implemented

**Outgoing:**
- None detected - No external service callbacks or notifications

## API Endpoints (Backend)

**View Control:**
- `GET/POST /api/active-view/` - Get current display state (location, view type, encounter level)
- `POST /api/gm/switch-view/` - Switch active view (GM only)

**Messages:**
- `GET /api/messages/` - Get broadcast messages (public, with optional `since` parameter)
- `POST /api/messages/create/` - Create new message (GM only)

**CHARON Terminal (Multi-Channel):**
- `GET /charon/{channel}/conversation/` - Get conversation history for channel
- `POST /charon/{channel}/submit/` - Submit query for Claude generation
- `POST /gm/charon/{channel}/send/` - Send manual message (GM only)
- `POST /gm/charon/{channel}/generate/` - Generate response with Claude (GM only)
- `GET /gm/charon/{channel}/pending/` - Get pending responses awaiting approval
- `POST /gm/charon/{channel}/approve/` - Approve generated response
- `POST /gm/charon/{channel}/reject/` - Reject generated response
- `POST /gm/charon/{channel}/clear/` - Clear conversation history
- `POST /gm/charon/{channel}/mark-read/` - Mark channel as read
- `GET /gm/charon/channels/` - List all CHARON channels

**Legacy Endpoints (Default Channel):**
- `GET /charon/conversation/` - Get conversation (default channel)
- `POST /charon/submit-query/` - Submit query (default channel)
- Similar GM endpoints under `/gm/charon/` (non-channel-specific)

**View Types:**
- `POST /gm/charon/mode/` - Switch CHARON mode (DISPLAY or QUERY)
- `POST /gm/charon/location/` - Set CHARON location context
- `POST /gm/charon/toggle-dialog/` - Show/hide CHARON dialog overlay

## Frontend API Client

**Service Files:**
- `src/services/api.ts` - Base axios instance with CSRF token intercept
- `src/services/charonApi.ts` - CHARON terminal API methods (45+ endpoints)

**Request/Response Pattern:**
- Base URL: `/api` (configured in Vite proxy for dev)
- Content-Type: `application/json`
- CSRF Token: Automatically added to POST requests via axios interceptor
- Error Handling: No global error handler (component-level try/catch)

---

*Integration audit: 2026-02-09*
