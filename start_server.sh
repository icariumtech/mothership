#!/bin/bash

# Mothership RPG GM Terminal - Start Server Script

echo "================================"
echo "MOTHERSHIP RPG - GM TERMINAL"
echo "================================"
echo ""

# Activate virtual environment
if [ -d ".venv" ]; then
    echo "Activating virtual environment..."
    source .venv/bin/activate
else
    echo "ERROR: Virtual environment not found!"
    echo "Please run: python3 -m venv .venv"
    exit 1
fi

# Check if database exists
if [ ! -f "db.sqlite3" ]; then
    echo "Database not found. Running migrations..."
    python manage.py migrate
    echo ""
    echo "Creating superuser account (GM)..."
    python manage.py createsuperuser
fi

echo ""
echo "Starting development server..."
echo "Detecting network configuration..."
echo ""

# Get local IP address
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo "Server will be accessible at:"
echo "  Local:    http://127.0.0.1:8000/terminal/"
echo "  Network:  http://$LOCAL_IP:8000/terminal/"
echo ""
echo "GM Console: http://$LOCAL_IP:8000/terminal/gm/"
echo "Admin:      http://$LOCAL_IP:8000/admin/"
echo ""
echo "Share the network URL with players on the same network!"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python manage.py runserver 0.0.0.0:8000
