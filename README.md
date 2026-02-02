# Mothership RPG - Game Master Terminal

A retro-futuristic web application for game masters running Mothership RPG campaigns. Features an atmospheric terminal interface inspired by the CHARON computer from Aliens.

## Features

- **Bridge View Dashboard**: Interactive 3D galaxy/system/orbit map navigation with tabbed interface for crew, contacts, notes, and status
- **CHARON AI Terminal**: Interactive AI chat interface with typewriter effect, processing indicators, and inline query input
- **3D Visualization**: React Three Fiber-powered galaxy maps with stars, nebulae, travel routes, and drill-down navigation
- **Multi-View Terminal System**: Display different views (BRIDGE, ENCOUNTER, COMM_TERMINAL, CHARON) on shared terminal
- **Atmospheric Messaging**: Send in-character messages styled like classic sci-fi computer systems
- **Retro CRT Aesthetic**: Muted teal/amber color scheme with chamfered angular panels and subtle scanline effects
- **Priority Levels**: Mark messages as LOW, NORMAL, HIGH, or CRITICAL with visual indicators
- **Network Access**: Players connect from phones/tablets on local network
- **File-Based Campaign Data**: Git-friendly YAML + Markdown storage with nested location hierarchy

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

## Setup for Development

### Quick Setup (Automated)

For a fresh clone of the project:

```bash
./setup.sh
```

This will automatically:
1. Create Python virtual environment (`.venv`)
2. Install Python dependencies (Django, PyYAML, etc.)
3. Install Node.js dependencies (React, Vite, Three.js, etc.)
4. Copy `.env.example` to `.env`
5. Build frontend assets
6. Run Django database migrations

After setup completes, start the server:

```bash
./start_server.sh
```

On first run, you'll be prompted to create a superuser (GM) account.

### Manual Setup (Alternative)

If you prefer to run setup steps manually:

#### 1. Create Python Virtual Environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

#### 2. Install Python Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

#### 3. Install Node.js Dependencies

```bash
npm install
```

#### 4. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` to configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes (for CHARON AI) | Your Anthropic API key for Claude integration. Get one at https://console.anthropic.com/ |
| `OBSIDIAN_VAULT_PATH` | No | Path to your Obsidian vault containing campaign lore. CHARON will read linked notes for context-aware responses. |

#### 5. Build Frontend

```bash
npm run build
```

#### 6. Initialize Database

```bash
python manage.py migrate
```

#### 7. Create Superuser (GM Account)

```bash
python manage.py createsuperuser
```

---

## Development Workflow

### Starting the Development Server

```bash
./start_server.sh
```

This starts Django on `http://127.0.0.1:8000/` with network access enabled.

The script displays both local and network URLs:

```
Server will be accessible at:
  Local:    http://127.0.0.1:8000/
  Network:  http://192.168.1.100:8000/

GM Console: http://192.168.1.100:8000/gmconsole/
Terminal:   http://192.168.1.100:8000/terminal/
```

### Frontend Development with Hot Reload

For frontend development with Vite's hot module replacement:

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

## Usage

### Access URLs

- **GM Console**: http://127.0.0.1:8000/gmconsole/ (requires login)
- **Shared Terminal**: http://127.0.0.1:8000/terminal/ (no login required)
- **Player Messages**: http://127.0.0.1:8000/messages/ (requires login)
- **Admin Panel**: http://127.0.0.1:8000/admin/ (superuser only)

### Network Access for Players

The server is accessible from any device on your local network!

**Setup:**
1. Start the server: `./start_server.sh`
2. Note the network IP displayed (e.g., `192.168.1.100`)
3. Share the network URL with players: `http://192.168.1.100:8000/terminal/`

**Requirements:**
- All devices must be on the same WiFi/network
- Server computer must not be blocking port 8000
- Players need the IP address and port

**Network URL Examples:**
- **Terminal**: `http://YOUR_IP:8000/terminal/`
- **Login**: `http://YOUR_IP:8000/accounts/login/`
- **Messages**: `http://YOUR_IP:8000/messages/`

**Firewall Note:** If players can't connect, allow port 8000:

```bash
# Ubuntu/Debian
sudo ufw allow 8000/tcp

# Fedora/RHEL
sudo firewall-cmd --add-port=8000/tcp --permanent
sudo firewall-cmd --reload
```

### For Game Masters

**Sending Messages:**
1. Log in at http://127.0.0.1:8000/accounts/login/
2. Navigate to GM Console at http://127.0.0.1:8000/gmconsole/
3. Use the tree view to navigate locations and control terminal displays
4. Click **DISPLAY** (eye icon) to show location maps on the terminal
5. Click **SHOW** (play icon) to set terminal overlay without clearing main display

**Broadcast Messages:**
Compose and send messages with:
- **Sender**: Customize (e.g., "CHARON", "Station Control", "Ship AI")
- **Priority**: LOW, NORMAL, HIGH, or CRITICAL
- **Message**: Your atmospheric content

**Example Messages:**

```
ATTENTION CREW MEMBERS
HULL BREACH DETECTED - SECTOR 7
INITIATING EMERGENCY PROTOCOLS
ALL PERSONNEL REPORT TO STATIONS
```

```
INCOMING TRANSMISSION FROM WEYLAND-YUTANI CORP
MISSION PARAMETERS UPDATED
NEW COORDINATES: 39.47.36 N / 116.23.40 W
SPECIAL ORDER 937 IN EFFECT
```

### For Players

**Viewing Messages:**
- **Shared Terminal** (no login): http://127.0.0.1:8000/terminal/
  - Broadcast messages for everyone
  - Recommended for shared display at gaming table
- **Personal Messages** (login required): http://127.0.0.1:8000/messages/
  - Individual character messages

Messages display with:
- Green/amber monospaced text on dark background
- CRT scanline effects
- Screen flicker animation
- Priority indicators (HIGH pulses yellow, CRITICAL pulses red)

### Creating Player Accounts

**Method 1: Django Admin (Recommended)**
1. Go to http://127.0.0.1:8000/admin/
2. Click "Users" under Authentication and Authorization
3. Click "Add User" button
4. Enter username and password
5. Click "Save"
6. Share credentials with player

**Method 2: Command Line**
```bash
source .venv/bin/activate
python manage.py createsuperuser  # For another GM
# Or use Django shell for regular players
```

### Tips for Great Atmosphere

**Message Styling:**
- **Use all caps** for urgent system messages
- **Keep it terse and technical** - think 70s/80s computer systems
- **Use technical jargon**: Hull integrity, life support, coordinates
- **Be ominous when appropriate**: "SPECIAL ORDER 937" vibes
- **Vary the sender**: Ship AI, Station Control, Company, Unknown Source

**Priority Guidelines:**
- **LOW**: Routine maintenance, supply updates, non-urgent notices
- **NORMAL**: Standard communications, mission updates, general info
- **HIGH**: Urgent situations, threats detected, system warnings
- **CRITICAL**: Life-threatening emergencies, immediate danger

**Sender Name Ideas:**
- CHARON (ship computer)
- STATION CONTROL
- WEYLAND-YUTANI CORP
- EMERGENCY SYSTEMS
- LIFE SUPPORT
- NAVIGATION
- UNKNOWN SOURCE
- [SIGNAL CORRUPTED]

### Example Gaming Session Setup

1. GM starts server on laptop: `./start_server.sh`
2. GM notes network IP: `192.168.1.100`
3. GM creates player accounts via admin panel
4. Players open `http://192.168.1.100:8000/terminal/` on their phones
5. Players log in with their credentials
6. GM sends atmospheric messages from GM Console
7. Players see messages appear in real-time terminal style!

---

## Troubleshooting

### Python Virtual Environment

If `source .venv/bin/activate` doesn't work:

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
python manage.py createsuperuser
```

### Server Won't Start

```bash
# Make sure you're in the right directory
cd /path/to/mothership

# Activate virtual environment
source .venv/bin/activate

# Try running manually
python manage.py runserver
```

### Network Connection Issues

**"Connection refused" or "Can't connect":**
1. Check server is running (look for "Starting development server..." message)
2. Verify the IP address is correct
3. Check firewall (temporarily disable to test)
4. Confirm both devices are on same WiFi network
5. Try localhost first: `http://127.0.0.1:8000` on server computer

**"DisallowedHost" Error:**
1. Check `settings.py` has `ALLOWED_HOSTS = ['*']`
2. Restart the server

**Players Can't Log In:**
1. Make sure you created their user accounts in admin panel
2. Verify correct username/password
3. Check they're accessing `/accounts/login/` first

### Finding Your IP Address Manually

If the start script doesn't display your IP:

```bash
# Linux
hostname -I
# or
ip addr show

# Mac
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig
```

Look for your local network IP (usually starts with `192.168.` or `10.`)

---

## Technology Stack

### Backend
- **Django 5.2.7** - Web framework
- **SQLite** - Database (stores ActiveView state and broadcast Messages only)
- **PyYAML** - YAML parsing for file-based data
- **Pillow** - Image generation

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite 5.4** - Build tool with hot module replacement
- **React Three Fiber 9.0** - Declarative 3D with Three.js
- **@react-three/drei** - R3F helpers (OrbitControls, Suspense, etc.)
- **GSAP 3.14** - Animation library for camera transitions
- **Ant Design 6.1** - UI component library
- **Axios 1.13** - HTTP client

### Data Storage
- **Hybrid approach**: SQLite for runtime state, YAML files for campaign content
- **File-based**: Markdown + YAML frontmatter (git-friendly, no DB sync)
- **Nested hierarchy**: Unlimited depth for locations (galaxy → systems → planets → facilities)

---

## Project Structure

```
mothership/
├── .venv/                  # Python virtual environment
├── .env                    # Environment variables
├── db.sqlite3              # SQLite database
├── node_modules/           # Node dependencies
├── dist/                   # Built frontend assets
├── data/                   # Campaign data (YAML + Markdown)
│   ├── campaign/           # Crew, missions, notes
│   └── galaxy/             # Location hierarchy
├── src/                    # Frontend source (React + TypeScript)
│   ├── entries/            # Entry points (GMConsole, SharedConsole)
│   ├── components/         # React components
│   │   ├── domain/         # Dashboard, maps, CHARON, terminal
│   │   ├── gm/             # GM Console components
│   │   ├── layout/         # Layout components
│   │   └── ui/             # Reusable UI components
│   ├── services/           # API clients
│   ├── hooks/              # Custom React hooks
│   └── types/              # TypeScript definitions
├── terminal/               # Django app
│   ├── models.py           # ActiveView, Message
│   ├── views.py            # API endpoints
│   ├── data_loader.py      # File-based data loading
│   └── templates/          # HTML templates
├── mothership_gm/          # Django project settings
├── scripts/                # Utility scripts
├── codemaps/               # Architecture documentation
├── setup.sh                # Initial setup script
└── start_server.sh         # Development server launcher
```

---

## Documentation

For detailed information, see:
- **[DATA_DIRECTORY_GUIDE.md](DATA_DIRECTORY_GUIDE.md)** - Data structure and YAML schemas
- **[STYLE_GUIDE.md](STYLE_GUIDE.md)** - UI design system and visual specifications
- **[CLAUDE.md](CLAUDE.md)** - Developer documentation and architecture
- **[codemaps/](codemaps/)** - Token-efficient architecture documentation

---

## Planned Features

- [ ] Campaign tracking (characters, ships, missions)
- [ ] Player character sheet management
- [ ] Session notes and GM tools
- [ ] Combat/encounter tracking on maps
- [ ] Real-time message notifications via WebSockets
- [ ] Sound effects and ambient audio
- [ ] NPC generator and random encounter tables
- [ ] Quick reference for Mothership RPG rules

---

## License

MIT License - Copyright (c) 2025 icariumtech

See [LICENSE](LICENSE) for details.

---

**Repository**: https://github.com/icariumtech/mothership

Have fun running your Mothership campaign!
