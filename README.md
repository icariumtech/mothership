# Mothership RPG - Game Master Terminal

A retro-futuristic web application for game masters running Mothership RPG campaigns. Features an atmospheric terminal interface inspired by the CHARON computer from Aliens.

## Features

- **Atmospheric Terminal Messaging**: Send in-character messages to players styled like classic sci-fi computer systems
- **Retro CRT Aesthetic**: Green monospace terminal with scanline effects and screen flicker
- **Priority Levels**: Mark messages as LOW, NORMAL, HIGH, or CRITICAL with visual indicators
- **GM Console**: Easy-to-use interface for game masters to broadcast messages
- **Player Terminal**: Clean message viewer for players to receive communications

## Quick Start

### 1. Install Dependencies

```bash
# Create virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

### 2. Set Up Database

```bash
# Run migrations
python manage.py migrate

# Create superuser (GM account)
python manage.py createsuperuser
```

### 3. Run the Server

```bash
./start_server.sh
```

The script will display URLs for local and network access!

**For Network Access (players on phones/tablets):**
- The server is now accessible from any device on your local network
- Share the network URL with your players (e.g., `http://192.168.1.100:8000/terminal/`)
- See [NETWORK_ACCESS.md](NETWORK_ACCESS.md) for detailed instructions

Visit http://127.0.0.1:8000/terminal/ to access the terminal locally!

## Usage

### For Game Masters

1. Log in at http://127.0.0.1:8000/accounts/login/
2. Navigate to the GM Console at http://127.0.0.1:8000/terminal/gm/
3. Compose and send messages to players with customizable:
   - Sender name (e.g., "CHARON", "Station Control", "Ship AI")
   - Priority level (LOW, NORMAL, HIGH, CRITICAL)
   - Message content

### For Players

1. Log in with player credentials
2. View messages at http://127.0.0.1:8000/terminal/
3. Messages display with atmospheric terminal styling

### Admin Panel

Access the Django admin at http://127.0.0.1:8000/admin/ for advanced management of messages and users.

## Creating Player Accounts

Use the Django admin panel to create player accounts:
1. Go to http://127.0.0.1:8000/admin/
2. Add users under "Users"
3. Give each player their username/password

## Technology Stack

- **Backend**: Django 5.2.7
- **Database**: SQLite (development)
- **Frontend**: HTML/CSS with retro terminal styling

## Next Steps

Future features planned:
- Campaign tracking (characters, ships, missions)
- Interactive universe map
- Session management and GM notes
- Real-time message notifications
- Player character sheet management

## License

MIT License - See [LICENSE](LICENSE) for details