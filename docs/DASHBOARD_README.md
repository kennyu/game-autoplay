# Game QA Agent Dashboard

A real-time web dashboard for testing multiple game URLs with the autonomous browser agent.

## Features

- **Multiple URL Testing**: Enter multiple game URLs and run them sequentially
- **Real-time Monitoring**: Watch logs and screenshots appear in real-time via WebSocket
- **Organized Output**: Each run gets its own timestamped directory with all artifacts
- **Run History**: View past test runs with statistics
- **Live Queue Status**: See pending, running, completed, and failed jobs

## Quick Start

### 1. Start the Dashboard Server

```bash
bun server.ts
```

The server will start on `http://localhost:3000`

### 2. Open in Browser

Navigate to `http://localhost:3000` in your web browser.

### 3. Enter URLs

Enter game URLs in the textarea, one per line. For example:

```
https://playtictactoe.net/
https://isnoahalive.com/games/snake/
https://isnoahalive.com/games/pong/
```

### 4. Run Tests

Click the "Run Tests" button. The dashboard will:
- Add jobs to the queue
- **Process them in parallel** (up to 5 in LOCAL mode, 10 in BROWSERBASE mode)
- Show real-time logs and screenshots for each job
- Save all artifacts to organized output directories

Each running job appears in its own **collapsible section** with:
- Status icon (🔄 running, ✅ completed, ❌ failed)
- Live timer showing elapsed time
- Expand/collapse button
- Individual logs and screenshots

## Output Structure

Each test run creates a unique directory:

```
output/
  playtictactoe-net_2025-11-05_001530/
    action-1-before.png
    action-1-after.png
    action-2-before.png
    action-2-after.png
    ...
    run-metadata.json
  snake-game-com_2025-11-05_001545/
    ...
```

## Configuration

The agent uses the same configuration as `qa.ts`:
- Model: GPT-5 (configurable via `MODEL_NAME` env var)
- Browser Mode: LOCAL (configurable via `BROWSER_MODE` env var)
- Duration: 15 seconds per URL
- Max Actions: 10 per run
- **Parallel Execution**: 5 concurrent jobs (LOCAL) / 10 concurrent (BROWSERBASE)

Set these in your `.env` file:

```bash
# Browser Settings
BROWSER_MODE=LOCAL
HEADLESS=false

# Parallel Execution Limits
MAX_CONCURRENT_LOCAL=5          # 5 jobs in parallel (LOCAL mode)
MAX_CONCURRENT_BROWSERBASE=10   # 10 jobs in parallel (BROWSERBASE mode)

# Model Settings
MODEL_NAME=gpt-5
MODEL_PROVIDER=openai
OPENAI_API_KEY=your-key-here

# Optional: For Browserbase mode
BROWSERBASE_API_KEY=your-key
BROWSERBASE_PROJECT_ID=your-project
```

## Architecture

```
┌─────────────┐
│   Browser   │ ← User interface
│  Dashboard  │
└──────┬──────┘
       │ WebSocket
       ↓
┌─────────────┐
│   Server    │ ← HTTP + WebSocket
│  (Bun.js)   │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│  Job Queue  │ ← Sequential processing
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ Job Runner  │ ← Executes agent
└──────┬──────┘
       │
       ↓
┌─────────────┐
│Browser Agent│ ← CUA with GPT-5
└─────────────┘
```

## WebSocket Events

The dashboard streams real-time events:

- `job-started`: A new test begins
- `log`: Console log messages
- `screenshot`: Screenshot captured
- `action`: Agent action executed
- `job-completed`: Test finished successfully
- `job-failed`: Test failed
- `queue-update`: Queue statistics updated

## Troubleshooting

### WebSocket Disconnected

If you see "Disconnected" in the top-right:
1. Ensure the server is running
2. Refresh the page
3. The client will attempt automatic reconnection

### No Screenshots Appearing

- Check that the output directory is writable
- Verify browser mode is set correctly
- Look for errors in the server logs

### Jobs Stuck in Queue

- Check server terminal for errors
- Restart the server
- Ensure agent configuration is valid

## Development

To modify the dashboard:

- **Server**: Edit `src/server/index.ts`
- **Job Queue**: Edit `src/server/queue.ts`
- **Job Runner**: Edit `src/server/runner.ts`
- **Frontend HTML**: Edit `public/index.html`
- **Frontend JS**: Edit `public/app.js`
- **Frontend CSS**: Edit `public/styles.css`

After changes, restart the server with:

```bash
bun server.ts
```

## API Endpoints

- `POST /api/run` - Submit URLs for testing
- `GET /api/status` - Get current queue statistics
- `GET /api/history` - Get run history
- `/ws` - WebSocket connection for real-time updates

## Performance

- **Parallel Processing**: Multiple jobs run simultaneously (5 in LOCAL, 10 in BROWSERBASE)
- **Streaming**: All logs and screenshots stream in real-time
- **Efficient**: Uses Bun's native WebSocket and HTTP server
- **Responsive**: Updates appear within milliseconds
- **Resource Management**: Automatic job slot management prevents overload

### Resource Usage

**LOCAL Mode:**
- 5 concurrent jobs ≈ 2.5-5GB RAM
- Each browser ≈ 500MB-1GB RAM
- Recommended: 8GB+ RAM for optimal performance

**BROWSERBASE Mode:**
- 10+ concurrent jobs with minimal local resources
- All processing happens remotely
- Recommended for high-volume testing

Enjoy automated game testing! 🎮🤖

