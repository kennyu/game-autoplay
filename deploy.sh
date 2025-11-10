#!/bin/bash
# Quick deployment script for Fly.io

set -e

echo "🚀 Game Autoplay Agent - Fly.io Deployment"
echo "=========================================="
echo ""

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo "❌ Fly CLI not found!"
    echo ""
    echo "Install it:"
    echo "  macOS/Linux: curl -L https://fly.io/install.sh | sh"
    echo "  Windows: powershell -Command \"iwr https://fly.io/install.ps1 -useb | iex\""
    exit 1
fi

echo "✅ Fly CLI found: $(fly version)"
echo ""

# Check if logged in
if ! fly auth whoami &> /dev/null; then
    echo "🔐 Not logged in to Fly.io"
    echo "Running: fly auth login"
    fly auth login
fi

echo "✅ Logged in as: $(fly auth whoami)"
echo ""

# Check if app exists
APP_NAME=$(grep "^app = " fly.toml | cut -d'"' -f2)
echo "📦 App name: $APP_NAME"

if ! fly apps list | grep -q "$APP_NAME"; then
    echo ""
    echo "⚠️  App '$APP_NAME' doesn't exist yet"
    read -p "Create it now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        fly apps create "$APP_NAME"
    else
        echo "❌ Cancelled. Create app manually with: fly apps create $APP_NAME"
        exit 1
    fi
fi

echo ""

# Check for secrets
echo "🔑 Checking secrets..."
if ! fly secrets list --app "$APP_NAME" | grep -q "OPENAI_API_KEY"; then
    echo "⚠️  OPENAI_API_KEY not set!"
    echo ""
    read -p "Do you want to set it now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your OpenAI API key: " openai_key
        fly secrets set OPENAI_API_KEY="$openai_key" --app "$APP_NAME"
    else
        echo "⚠️  Warning: App may not work without OPENAI_API_KEY"
    fi
fi

echo ""
echo "✅ Pre-flight checks complete!"
echo ""

# Confirm deployment
read -p "Deploy to Fly.io now? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 0
fi

echo ""
echo "🚀 Deploying..."
echo "==============="
echo ""

# Deploy
fly deploy --app "$APP_NAME"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your app is live at:"
fly info --app "$APP_NAME" | grep "Hostname"
echo ""
echo "📊 Check status: fly status --app $APP_NAME"
echo "📝 View logs:    fly logs --app $APP_NAME"
echo "🌍 Open app:     fly open --app $APP_NAME"
echo ""
echo "🎉 Done!"



