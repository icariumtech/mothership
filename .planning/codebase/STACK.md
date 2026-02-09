# Technology Stack

**Analysis Date:** 2026-02-09

## Languages

**Primary:**
- TypeScript 5.9.3 - Frontend React components and utilities
- Python 3.12.3 - Django backend, data loading, and CHARON AI integration

**Secondary:**
- JavaScript - Vite build configuration and development scripts
- CSS - UI styling with inline styles and CSS modules
- YAML - Configuration files and data storage (campaign data, maps, CHARON config)
- Markdown - Documentation and campaign notes

## Runtime

**Environment:**
- Node.js 20+ (for frontend build and dev server)
- Python 3.12.3 (Django backend)
- Browser (React frontend runs in modern browsers with ES2020 support)

**Package Manager:**
- npm (JavaScript dependencies)
- pip (Python dependencies)
- Lockfiles: `package-lock.json` present, Python uses `requirements.txt`

## Frameworks

**Core:**
- Django 5.2.7 - Web framework for backend APIs and template rendering
- React 19.2.3 - UI framework for interactive components
- TypeScript 5.9.3 - Type safety and development tooling

**3D Graphics & Animation:**
- React Three Fiber 9.5.0 - Declarative 3D scene management with Three.js
- Three.js 0.182.0 - WebGL 3D graphics library
- @react-three/drei 10.7.7 - Helper components for R3F (OrbitControls, Suspense, Stars, Html, etc.)
- @react-three/postprocessing 3.0.4 - Post-processing effects foundation (bloom, chromatic aberration)
- postprocessing 6.38.2 - Low-level post-processing effects library
- GSAP 3.14.2 - Animation library for camera transitions and smooth easing

**State Management:**
- Zustand 5.0.10 - Lightweight centralized state management for 3D scene state

**UI Components:**
- Ant Design 6.1.1 - Component library for layout, forms, tabs, icons
- @ant-design/icons 6.1.0 - Icon set for Ant Design

**HTTP Client:**
- Axios 1.13.2 - HTTP client for API requests with CSRF token interceptors

**Animation:**
- @react-spring/three 10.0.3 - Spring physics animations for React Three Fiber (unused in current implementation)

## Key Dependencies

**Critical:**
- Django 5.2.7 - Backend framework for API endpoints, database, and template rendering
- React Three Fiber 9.5.0 - Enables declarative 3D scene composition (replaced imperative Three.js classes)
- Three.js 0.182.0 - Core 3D graphics engine for galaxy/system/orbit visualizations
- anthropic >= 0.39.0 - Claude API client for CHARON AI integration
- PyYAML >= 6.0 - YAML parsing for campaign data and configuration
- Zustand 5.0.10 - Centralized Zustand store for 3D scene state (mapViewMode, selections, animations)

**Infrastructure:**
- asgiref 3.10.0 - ASGI support for Django
- sqlparse 0.5.3 - SQL parsing utility for Django
- python-dotenv >= 1.0.0 - Environment variable loading from .env file
- Vite 5.4.21 - Frontend build tool and dev server
- Terser 5.44.1 - JavaScript minification

**Development Tools:**
- TypeScript 5.9.3 - Type checking for frontend code
- @vitejs/plugin-react 4.7.0 - Vite plugin for React with Fast Refresh
- @types/react 19.2.7, @types/react-dom 19.2.3, @types/three 0.182.0 - Type definitions
- knip 5.82.1 - Unused code detection
- ts-prune 0.10.3 - TypeScript-specific dead code analysis
- depcheck 1.4.7 - Dependency analysis
- Ruff - Python linter (configuration in pyproject.toml or ruff.toml)

## Configuration

**Environment:**
- `.env` file (not committed, see `.env.example`)
  - `ANTHROPIC_API_KEY` - Required for CHARON AI features (Claude API key)
  - `OBSIDIAN_VAULT_PATH` - Optional path to Obsidian vault for knowledge integration
- Environment variables loaded via `python-dotenv` in `mothership_gm/settings.py`

**Build:**
- `vite.config.ts` - Frontend build configuration with React plugin, path aliases, multi-entry build
- `tsconfig.json` - TypeScript compiler options (ES2020 target, strict mode, path aliases)
- `tsconfig.node.json` - TypeScript config for build tool scripts

**Django:**
- `mothership_gm/settings.py` - Django settings (SQLite database, installed apps, middleware, caches)
  - Database: `db.sqlite3` (local file-based SQLite)
  - Cache: File-based cache at `/tmp/django_cache` (4-hour TTL)
  - Static files served from `/static/` URL path
- `mothership_gm/urls.py` - URL routing configuration
- `mothership_gm/wsgi.py` - WSGI application entry point

## Platform Requirements

**Development:**
- Node.js 20+ (or use .nvmrc/nvm if specified)
- Python 3.12.3
- Virtual environment (`.venv/` directory present)
- SQLite 3 (no external DB required)
- 2+ GB disk space (includes node_modules and Python packages)

**Production:**
- Deployment target: Self-hosted (no cloud platform specified)
- Web server: Django development server in production (not hardened, needs wsgiref/gunicorn for production use)
- Database: SQLite (file-based, suitable for single GM + few players)
- No external services required (except Anthropic API for Claude)

---

*Stack analysis: 2026-02-09*
