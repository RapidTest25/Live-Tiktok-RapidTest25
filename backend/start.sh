#!/bin/bash
# TikTok LIVE Backend - Startup Script
# Run this on RDP server

set -e

cd "$(dirname "$0")"

echo "=== TikTok LIVE Backend ==="

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo "[1/3] Installing dependencies..."
  npm install
else
  echo "[1/3] Dependencies OK"
fi

# Start server in background
echo "[2/3] Starting server on port 8081..."
node server.js &
SERVER_PID=$!
sleep 2

# Verify server is running
if curl -s http://localhost:8081/health > /dev/null 2>&1; then
  echo "      Server OK (PID: $SERVER_PID)"
else
  echo "      WARNING: Server may not be running. Check logs."
fi

# Start cloudflared tunnel
echo "[3/3] Starting cloudflared tunnel..."
echo ""
echo "============================================"
echo "  Backend : http://localhost:8081"
echo "  Health  : http://localhost:8081/health"
echo "============================================"
echo ""
echo "Copy the tunnel URL below and paste it into"
echo "the Backend URL field in the dashboard."
echo "============================================"
echo ""

cloudflared tunnel --url http://localhost:8081

# Cleanup on exit
kill $SERVER_PID 2>/dev/null
