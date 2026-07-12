#!/usr/bin/env bash
# Auto Moto Mobility Solutions - Fleet CRM launcher
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  Node.js is not installed yet."
  echo "  1. Go to https://nodejs.org and install the LTS version"
  echo "  2. Run this file again"
  echo ""
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First-time setup: downloading required packages (1-2 minutes, once only)..."
  npm install
fi

echo ""
echo "Starting the Auto Moto Mobility Solutions CRM..."
echo "Keep this window open while using the app. Press Ctrl+C to stop."
echo ""
npm run dev -- --open
