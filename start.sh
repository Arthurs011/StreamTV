#!/bin/bash
# Start a local server for StreamTV

PORT=${1:-8000}

echo "🚀 Starting local server on http://localhost:$PORT"
echo "📂 Serving files from: $(pwd)"
echo ""
echo "Open your browser and go to:"
echo "   👉 http://localhost:$PORT"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Try Python 3 first, then Python 2, then Node.js
if command -v python3 &> /dev/null; then
    python3 -m http.server $PORT
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer $PORT
elif command -v npx &> /dev/null; then
    npx serve -p $PORT
else
    echo "❌ No server found. Install Node.js or Python."
    exit 1
fi
