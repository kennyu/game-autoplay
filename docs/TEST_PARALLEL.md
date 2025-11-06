# Parallel Execution Test

## Quick Test for Parallel Jobs

### 1. Start the Server
```bash
bun server.ts
```

### 2. Open Dashboard
Navigate to: `http://localhost:3000`

### 3. Test with Multiple URLs

Paste these 5 URLs to test parallel execution:

```
https://playtictactoe.net/
https://isnoahalive.com/games/snake/
https://isnoahalive.com/games/pong/
http://www.playtictactoe.org/
https://playtictactoe.net/
```

### 4. Click "Run Tests"

You should see:
- **All 5 jobs run in parallel** (up to 5 concurrent in LOCAL mode)
- **Each job has its own collapsible section** with:
  - Status icon (🔄 running, ✅ completed, ❌ failed)
  - URL and timer
  - Expand/collapse button (▼/▶)
  - Individual logs area
  - Individual screenshots gallery
  - Individual progress bar

### 5. Expected Behavior

**Parallel Execution:**
- Jobs 1-5 start immediately (all at once)
- Each job runs independently
- Logs and screenshots appear in their respective sections
- Status icons update independently

**Collapsible Sections:**
- Click any job header to collapse/expand
- Collapsed jobs show just the header
- Expanded jobs show full logs and screenshots

**Queue Stats:**
- Pending: 5 → 0 (as jobs start)
- Running: 0 → 5 → decreases as jobs complete
- Completed: 0 → increases as jobs finish
- Failed: Shows any errors

**Output Directories:**
Each job creates its own unique directory:
```
output/
  playtictactoe-net_2025-11-05_123456/
  isnoahalive-com-games-snake_2025-11-05_123457/
  isnoahalive-com-games-pong_2025-11-05_123458/
  playtictactoe-org_2025-11-05_123459/
  playtictactoe-net_2025-11-05_123500/
```

### 6. Configuration

**LOCAL Mode (current default):**
- Max concurrent: 5 jobs
- Uses local Chrome browser
- More resource-intensive

**BROWSERBASE Mode:**
- Max concurrent: 10 jobs
- Uses remote Browserbase sessions
- Less local resource usage
- Set `BROWSER_MODE=BROWSERBASE` in `.env`

**Customize Limits:**
Add to `.env`:
```bash
MAX_CONCURRENT_LOCAL=3         # 3 jobs max in LOCAL mode
MAX_CONCURRENT_BROWSERBASE=20  # 20 jobs max in BROWSERBASE mode
```

### 7. Visual Verification

Look for these indicators of parallel execution:
- ✅ Multiple job sections visible at once
- ✅ Timers running simultaneously on multiple jobs
- ✅ Logs appearing in different sections at the same time
- ✅ Queue "Running" count > 1
- ✅ Terminal logs showing "X/5 concurrent" messages

### 8. Success Criteria

- ✅ All 5 jobs start within 1-2 seconds
- ✅ Jobs run simultaneously (not sequentially)
- ✅ Each job has isolated logs and screenshots
- ✅ Collapsible sections work (click to expand/collapse)
- ✅ All jobs complete or fail independently
- ✅ Run history shows all 5 results

## Troubleshooting

### Only 1 job running at a time
- Check server logs for max concurrent setting
- Restart server after changing `.env`
- Verify `maxConcurrentJobs` in config

### Jobs stuck in "Pending"
- Check browser resources (RAM/CPU)
- Reduce concurrent limit if needed
- Check for errors in server terminal

### Collapsible sections not working
- Hard refresh browser (Ctrl+Shift+R)
- Check browser console for errors
- Verify `app.js` loaded correctly

## Performance Notes

**LOCAL Mode:**
- 5 concurrent jobs = ~2.5-5GB RAM
- Each browser instance = ~500MB-1GB
- Recommended: 8GB+ RAM for 5 concurrent

**BROWSERBASE Mode:**
- 10+ concurrent = no local resource impact
- Limited by Browserbase API and plan
- Recommended for high-volume testing


