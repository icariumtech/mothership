# Quick Reference - Network Access

## Your Server IP Address
Your current local IP: **192.168.0.213**

## Access URLs

### On Your Computer (GM):
- Terminal: http://127.0.0.1:8000/terminal/
- GM Console: http://127.0.0.1:8000/terminal/gm/
- Admin: http://127.0.0.1:8000/admin/

### For Players (Network):
- Terminal: http://192.168.0.213:8000/terminal/
- Login: http://192.168.0.213:8000/accounts/login/

## Quick Start

```bash
# Start the server (shows all URLs)
./start_server.sh

# Create player accounts
# 1. Go to http://192.168.0.213:8000/admin/
# 2. Click "Users" → "Add User"
# 3. Create accounts for each player
# 4. Share login credentials with them
```

## Player Instructions

Send this to your players:

---

**Join the Mothership Terminal:**

1. Connect to the same WiFi as the GM
2. Open your phone/tablet browser
3. Go to: **http://192.168.0.213:8000/terminal/**
4. Log in with your credentials
5. Receive atmospheric messages from the ship computer!

---

## Troubleshooting

**Players can't connect?**
- Verify they're on the same WiFi network
- Check that the server is running (look for "Starting development server...")
- Try turning off firewall temporarily: `sudo ufw disable` (re-enable after: `sudo ufw enable`)

**IP address changed?**
- Run `hostname -I` to get your current IP
- Or let the start script show it automatically

**Need more help?**
- See [NETWORK_ACCESS.md](NETWORK_ACCESS.md) for detailed troubleshooting
- See [GETTING_STARTED.md](GETTING_STARTED.md) for general setup

## Example Message to Send

Once players are connected, send them a test message from the GM Console:

```
ATTENTION CREW MEMBERS
SYSTEM INITIALIZATION COMPLETE
CHARON ONLINE
ALL PERSONNEL ACKNOWLEDGED
AWAITING MISSION PARAMETERS
```

Priority: NORMAL or HIGH for dramatic effect!
