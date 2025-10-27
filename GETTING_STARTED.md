# Getting Started with Mothership GM Terminal

## First Time Setup

### Step 1: Create Your GM Account

```bash
# Make sure you're in the project directory
cd /home/gjohnson/github/mothership

# Run the start script (it will guide you through setup)
./start_server.sh
```

The script will:
1. Activate the virtual environment
2. Run database migrations (if needed)
3. Prompt you to create a superuser account (your GM account)
4. Start the development server

### Step 2: Access the Terminal

Once the server is running, open your browser and go to:
- **Terminal**: http://127.0.0.1:8000/terminal/
- **Login**: http://127.0.0.1:8000/accounts/login/

Log in with the superuser credentials you just created.

### Step 3: Send Your First Message

1. Navigate to the **GM Console** at http://127.0.0.1:8000/terminal/gm/
2. Fill out the form:
   - **Sender**: "CHARON" (or customize it!)
   - **Priority**: Choose from LOW, NORMAL, HIGH, or CRITICAL
   - **Message**: Write your atmospheric message

Example messages:

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

3. Click **TRANSMIT MESSAGE**

### Step 4: View Messages as a Player

Navigate to http://127.0.0.1:8000/terminal/ to see your messages displayed in the retro terminal interface with:
- Green monospaced text on black background
- CRT scanline effects
- Screen flicker animation
- Priority indicators that pulse for urgent messages

## Creating Player Accounts

### Method 1: Django Admin (Recommended)

1. Go to http://127.0.0.1:8000/admin/
2. Click "Users" under Authentication and Authorization
3. Click "Add User" button
4. Enter username and password for the player
5. Click "Save"
6. Give the player their login credentials

### Method 2: Command Line

```bash
source .venv/bin/activate
python manage.py createsuperuser  # For another GM
# Or use Django shell for regular players
```

## Tips for Great Atmosphere

### Message Styling Tips

- **Use all caps** for urgent system messages
- **Keep it terse and technical** - think 70s/80s computer systems
- **Use technical jargon**: Hull integrity, life support systems, coordinates
- **Be ominous when appropriate**: "SPECIAL ORDER 937" vibes
- **Vary the sender**: Ship AI, Station Control, Company, Unknown Source

### Priority Guidelines

- **LOW**: Routine maintenance, supply updates, non-urgent notices
- **NORMAL**: Standard communications, mission updates, general info
- **HIGH**: Urgent situations, threats detected, system warnings (pulses yellow)
- **CRITICAL**: Life-threatening emergencies, immediate danger (pulses red)

### Sender Name Ideas

- CHARON (ship computer)
- STATION CONTROL
- WEYLAND-YUTANI CORP
- EMERGENCY SYSTEMS
- LIFE SUPPORT
- NAVIGATION
- UNKNOWN SOURCE
- [SIGNAL CORRUPTED]

## Troubleshooting

### Server won't start
```bash
# Make sure you're in the right directory
cd /home/gjohnson/github/mothership

# Activate virtual environment
source .venv/bin/activate

# Try running manually
python manage.py runserver
```

### Can't log in
- Make sure you created a superuser account
- Try resetting password via admin panel

### Messages not showing
- Make sure you're logged in
- Check that messages were created successfully
- Refresh the page

## Next Features to Build

Once you're comfortable with the messaging system, we can add:
1. **Character sheets** - Track player stats, stress, equipment
2. **Universe map** - Visual representation of systems and stations
3. **Ship status** - Track hull integrity, systems, crew
4. **Session notes** - Keep track of story developments
5. **Real-time updates** - Messages appear instantly via WebSockets

## Getting Help

Check out:
- [README.md](README.md) - Full project documentation
- [CLAUDE.md](CLAUDE.md) - Development guidelines and architecture
- Django admin: http://127.0.0.1:8000/admin/

Have fun running your Mothership campaign!
