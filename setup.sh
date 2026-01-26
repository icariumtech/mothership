#!/bin/bash

# Mothership RPG GM Terminal - Setup Script
# Run this script once after cloning the repository

set -e  # Exit on any error

echo "========================================"
echo "MOTHERSHIP RPG - GM TERMINAL SETUP"
echo "========================================"
echo ""

# Check Python version
echo "Checking Python version..."
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed!"
    echo "Please install Python 3.8 or higher"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo "Found Python $PYTHON_VERSION"
echo ""

# Check Node/npm version
echo "Checking Node.js version..."
if ! command -v npm &> /dev/null; then
    echo "ERROR: Node.js/npm is not installed!"
    echo "Please install Node.js 18 or higher"
    exit 1
fi

NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
echo "Found Node.js $NODE_VERSION"
echo "Found npm $NPM_VERSION"
echo ""

# Step 1: Create Python virtual environment
echo "Step 1/6: Creating Python virtual environment..."
if [ -d ".venv" ]; then
    echo "Virtual environment already exists, skipping..."
else
    python3 -m venv .venv
    echo "✓ Virtual environment created"
fi
echo ""

# Step 2: Install Python dependencies
echo "Step 2/6: Installing Python dependencies..."
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
echo "✓ Python dependencies installed"
echo ""

# Step 3: Install Node dependencies
echo "Step 3/6: Installing Node.js dependencies..."
npm install
echo "✓ Node.js dependencies installed"
echo ""

# Step 4: Copy environment file
echo "Step 4/6: Setting up environment variables..."
if [ -f ".env" ]; then
    echo ".env file already exists, skipping..."
else
    cp .env.example .env
    echo "✓ Created .env file from .env.example"
    echo "NOTE: Edit .env to add your ANTHROPIC_API_KEY if using CHARON AI features"
fi
echo ""

# Step 5: Build frontend
echo "Step 5/6: Building frontend assets..."
npm run build
echo "✓ Frontend built successfully"
echo ""

# Step 6: Initialize database
echo "Step 6/6: Initializing database..."
python manage.py migrate
echo "✓ Database initialized"
echo ""

echo "========================================"
echo "SETUP COMPLETE!"
echo "========================================"
echo ""
echo "Next steps:"
echo ""
echo "1. (Optional) Edit .env to configure CHARON AI:"
echo "   - Add your ANTHROPIC_API_KEY for AI features"
echo "   - Set OBSIDIAN_VAULT_PATH if using Obsidian integration"
echo ""
echo "2. Start the server:"
echo "   ./start_server.sh"
echo ""
echo "3. On first run, you'll create a superuser (GM) account"
echo ""
echo "4. Access the application:"
echo "   - GM Console: http://127.0.0.1:8000/gmconsole/"
echo "   - Shared Terminal: http://127.0.0.1:8000/terminal/"
echo "   - Admin Panel: http://127.0.0.1:8000/admin/"
echo ""
echo "For more info, see GETTING_STARTED.md"
echo ""
