#!/bin/bash
# Test SSE streaming endpoint
# Usage: ./test-sse.sh <game-url>

set -e

# Configuration
SERVER="http://localhost:3000"
GAME_URL="${1:-https://playtictactoe.net/}"

echo "🚀 Testing SSE Streaming API"
echo "================================"
echo "Game URL: $GAME_URL"
echo ""

# Step 1: Submit job
echo "📤 Step 1: Submitting job..."
RESPONSE=$(curl -s -X POST "$SERVER/api/run" \
  -H "Content-Type: application/json" \
  -d "{\"urls\": [\"$GAME_URL\"]}")

echo "Response: $RESPONSE"
echo ""

# Extract job ID (using grep and sed as jq might not be available)
JOB_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"\(.*\)"/\1/')

if [ -z "$JOB_ID" ]; then
  echo "❌ Error: Could not extract job ID"
  echo "Response was: $RESPONSE"
  exit 1
fi

echo "✅ Job created: $JOB_ID"
echo ""

# Step 2: Stream events via SSE
echo "📡 Step 2: Streaming events (SSE)..."
echo "URL: $SERVER/api/stream/$JOB_ID"
echo "================================"
echo ""

# Use curl with -N (no buffering) to stream SSE events
curl -N "$SERVER/api/stream/$JOB_ID" 2>&1 | while IFS= read -r line; do
  # Parse SSE format (event: type, data: json)
  if [[ $line == event:* ]]; then
    EVENT_TYPE="${line#event: }"
    echo "📨 Event: $EVENT_TYPE"
  elif [[ $line == data:* ]]; then
    DATA="${line#data: }"
    echo "   Data: $DATA"
    echo ""
    
    # Stop streaming when job completes or fails
    if [[ $DATA == *"\"type\":\"job-completed\""* ]] || [[ $DATA == *"\"type\":\"job-failed\""* ]]; then
      echo "✅ Stream completed!"
      break
    fi
  fi
done

echo ""
echo "================================"
echo "✨ Test complete!"



