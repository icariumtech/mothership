# Network Access Guide

## Allowing Players to Connect from Other Devices

This guide explains how to let players access the Mothership terminal from their phones, tablets, or other computers on your local network.

## Quick Setup

The server is now configured to accept connections from any device on your local network!

### Step 1: Start the Server

```bash
./start_server.sh
```

The script will display your network IP address and URLs, something like:

```
Server will be accessible at:
  Local:    http://127.0.0.1:8000/terminal/
  Network:  http://192.168.1.100:8000/terminal/

GM Console: http://192.168.1.100:8000/terminal/gm/
Admin:      http://192.168.1.100:8000/admin/

Share the network URL with players on the same network!
```

### Step 2: Share the URL with Players

Give your players the **Network URL** (e.g., `http://192.168.1.100:8000/terminal/`)

They can:
- Open it on their phones
- Open it on their tablets
- Open it on their laptops

As long as they're on the **same WiFi/network** as your server, they'll be able to access it!

### Step 3: Create Player Accounts

1. Go to http://YOUR_IP:8000/admin/
2. Create user accounts for each player
3. Give each player their username and password

## Finding Your IP Address Manually

If the start script doesn't show your IP, you can find it manually:

### On Linux:
```bash
hostname -I
# or
ip addr show
```

### On Mac:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

### On Windows:
```cmd
ipconfig
```

Look for your local network IP address (usually starts with `192.168.` or `10.`)

## Firewall Considerations

If players can't connect, you may need to allow port 8000 through your firewall:

### Ubuntu/Debian:
```bash
sudo ufw allow 8000/tcp
```

### Fedora/RHEL:
```bash
sudo firewall-cmd --add-port=8000/tcp --permanent
sudo firewall-cmd --reload
```

## Testing the Connection

### From Your Computer:
```bash
curl http://localhost:8000/terminal/
```

### From Another Device:
Open a web browser and go to:
```
http://YOUR_IP_ADDRESS:8000/terminal/
```

Replace `YOUR_IP_ADDRESS` with your actual IP (e.g., `192.168.1.100`)

## Network Requirements

- All devices must be on the **same WiFi network** or local network
- The server computer must not be blocking port 8000
- Players need the IP address and port (e.g., `192.168.1.100:8000`)

## Using on Different Networks (Advanced)

If you want to access the server from outside your local network:

### Option 1: Port Forwarding (Home Network)
1. Access your router settings
2. Forward port 8000 to your server's local IP
3. Use your public IP address to access the server
4. **Security Warning**: This exposes your server to the internet!

### Option 2: VPN
Use a VPN like Tailscale or ZeroTier to create a private network

### Option 3: Ngrok (Quick Testing)
```bash
# Install ngrok
# Then run:
ngrok http 8000
```

This gives you a temporary public URL. **Not recommended for sensitive data!**

### Option 4: Deploy to a Server
Deploy to platforms like:
- DigitalOcean
- Heroku
- Railway
- PythonAnywhere

## Security Notes

### For Local Network Use (Development):
- Current settings are fine for local network gaming sessions
- `ALLOWED_HOSTS = ['*']` allows any host to connect
- `DEBUG = True` shows helpful error messages

### For Internet/Production Use:
You should update [settings.py](mothership_gm/settings.py):

```python
# Change these for production:
DEBUG = False
ALLOWED_HOSTS = ['yourdomain.com', 'www.yourdomain.com']
SECRET_KEY = 'generate-a-new-secure-random-key'

# Add HTTPS settings
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
```

## Troubleshooting

### "Connection refused" or "Can't connect"

1. **Check the server is running**: Look for "Starting development server..." message
2. **Verify the IP address**: Make sure you're using the correct network IP
3. **Check firewall**: Temporarily disable firewall to test
4. **Confirm same network**: Ensure both devices are on the same WiFi
5. **Try localhost first**: Test `http://127.0.0.1:8000` on the server computer

### "DisallowedHost" Error

This shouldn't happen anymore, but if it does:
1. Check [settings.py](mothership_gm/settings.py) has `ALLOWED_HOSTS = ['*']`
2. Restart the server

### Players can't log in

1. Make sure you created their user accounts in the admin panel
2. Verify they're using the correct username/password
3. Check that they're accessing `/accounts/login/` first

## Example Session Setup

**At the gaming table:**

1. GM starts the server on their laptop: `./start_server.sh`
2. GM notes the network IP: `192.168.1.100`
3. GM creates player accounts via admin panel
4. Players open `http://192.168.1.100:8000/terminal/` on their phones
5. Players log in with their credentials
6. GM sends atmospheric messages from `http://192.168.1.100:8000/terminal/gm/`
7. Players see messages appear on their devices in real-time terminal style!

## Need More Help?

- Check [README.md](README.md) for general documentation
- Check [GETTING_STARTED.md](GETTING_STARTED.md) for setup help
- Review Django's deployment docs for production hosting
