# Setup Instructions

## Quick Start (Automated)

For a fresh clone of the project, run the setup script:

```bash
./setup.sh
```

This will automatically:
1. Create a Python virtual environment (`.venv`)
2. Install Python dependencies (Django, PyYAML, etc.)
3. Install Node.js dependencies (React, Vite, Three.js, etc.)
4. Copy `.env.example` to `.env`
5. Build the frontend assets
6. Run Django database migrations

After setup completes, start the server:

```bash
./start_server.sh
```

On first run, you'll be prompted to create a superuser (GM) account.

---

## Manual Setup (Alternative)

If you prefer to run setup steps manually:

### 1. Create Python Virtual Environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Install Python Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Install Node.js Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` to configure:
- `ANTHROPIC_API_KEY` - For CHARON AI features (optional)
- `OBSIDIAN_VAULT_PATH` - For Obsidian vault integration (optional)

### 5. Build Frontend

```bash
npm run build
```

### 6. Initialize Database

```bash
python manage.py migrate
```

### 7. Start the Server

```bash
./start_server.sh
```

---

## System Requirements

### Required Software

- **Python 3.8+** - Backend server
- **Node.js 18+** - Frontend build tools
- **npm 9+** - Package management

### Check Installed Versions

```bash
python3 --version
node --version
npm --version
```

---

## Development Workflow

### Starting the Development Server

```bash
./start_server.sh
```

This starts the Django backend on `http://127.0.0.1:8000/` with network access enabled.

### Frontend Development

For frontend development with hot module replacement:

```bash
npm run dev
```

This starts Vite dev server on `http://localhost:5173/` (separate from Django).

### Building for Production

```bash
npm run build
```

Compiles TypeScript and bundles assets to `dist/` directory.

### Type Checking

```bash
npm run typecheck
```

Runs TypeScript compiler without emitting files.

---

## Troubleshooting

### Python Virtual Environment Not Activating

If `source .venv/bin/activate` doesn't work, try:

```bash
# Linux/Mac
. .venv/bin/activate

# Windows Git Bash
source .venv/Scripts/activate
```

### Port Already in Use

If port 8000 is already in use:

```bash
python manage.py runserver 8080
```

### Node Modules Issues

If npm install fails or frontend won't build:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Database Issues

Reset the database:

```bash
rm db.sqlite3
python manage.py migrate
```

---

## Next Steps

After setup, see:
- [GETTING_STARTED.md](GETTING_STARTED.md) - First time usage guide
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Common URLs and commands
- [README.md](README.md) - Full project documentation
- [CLAUDE.md](CLAUDE.md) - Developer documentation

---

## File Structure After Setup

```
mothership/
├── .venv/                  # Python virtual environment (created by setup)
├── .env                    # Environment variables (created by setup)
├── db.sqlite3              # SQLite database (created on first run)
├── node_modules/           # Node dependencies (created by setup)
├── dist/                   # Built frontend assets (created by build)
├── data/                   # Campaign data files
├── src/                    # Frontend source code
├── terminal/               # Django app
├── setup.sh                # Run once to initialize project
└── start_server.sh         # Run to start development server
```
