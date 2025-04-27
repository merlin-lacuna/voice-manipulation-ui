#!/bin/bash
# Start both the API and frontend

# Start the API in the background
echo "Starting API server..."
cd "$(dirname "$0")/api"
./start.sh &
API_PID=$!

# Wait a moment for the API to initialize
sleep 2

# Start the frontend
echo "Starting frontend server..."
cd "$(dirname "$0")"
if command -v pnpm &> /dev/null
then
    # Clear Next.js cache first
    echo "Clearing Next.js cache..."
    pnpm clean
    pnpm dev
else
    # Clear Next.js cache first
    echo "Clearing Next.js cache..."
    npm run clean
    npm run dev
fi

# When frontend is stopped, also stop the API
kill $API_PID