#!/bin/bash

# Frontend startup script for Vi3W
# This script starts the Next.js development server

cd "$(dirname "$0")"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if .env.local exists (optional warning)
if [ ! -f ".env.local" ]; then
    echo "⚠️  Warning: No .env.local file found"
    echo "   Make sure environment variables are set"
    echo "   See RUNNING_GUIDE.md for details"
    echo ""
fi

# Start the development server
echo "🚀 Starting frontend development server on http://localhost:3000"
echo ""
npm run dev






