# Fly.io Deployment Guide

## Prerequisites

1. **Install Fly CLI**
   ```bash
   # Windows (PowerShell)
   iwr https://fly.io/install.ps1 -useb | iex
   
   # Mac/Linux
   curl -L https://fly.io/install.sh | sh
   ```

2. **Authenticate with Fly.io**
   ```bash
   fly auth login
   ```

3. **Set up secrets** (API keys)
   ```bash
   fly secrets set OPENAI_API_KEY=sk-your-key-here
   
   # Optional: If using Anthropic
   fly secrets set ANTHROPIC_API_KEY=your-key-here
   ```

## Initial Deployment

### 1. Create the Fly app
```bash
# This will use the fly.toml config
fly launch --no-deploy

# Or specify app name explicitly
fly launch --name game-autoplay-dashboard --no-deploy
```

### 2. Configure app (if needed)
Edit `fly.toml` to adjust:
- `primary_region` - Choose closest region (dfw, sea, lhr, etc.)
- `memory_mb` - Increase if needed (browser uses ~1GB)
- `cpus` - Adjust based on workload

### 3. Deploy
```bash
fly deploy
```

### 4. Open the dashboard
```bash
fly open
```

## Configuration

### Environment Variables

Set via `fly secrets` (for sensitive data):
```bash
fly secrets set OPENAI_API_KEY=sk-xxx
fly secrets set ANTHROPIC_API_KEY=sk-ant-xxx
```

Set via `fly.toml` [env] section (for non-sensitive):
```toml
[env]
  BROWSER_MODE = "LOCAL"
  HEADLESS = "true"
  MODEL_NAME = "gpt-4.1-mini"
```

### Regions

Available regions:
- `dfw` - Dallas, Texas
- `sea` - Seattle, Washington  
- `lhr` - London, UK
- `fra` - Frankfurt, Germany
- `syd` - Sydney, Australia

Change region:
```bash
fly regions set dfw sea
```

### Scaling

**Vertical scaling** (more resources per machine):
```bash
# Increase memory
fly scale memory 4096  # 4GB

# Increase CPUs
fly scale vm shared-cpu-2x  # 2 CPUs
```

**Horizontal scaling** (more machines):
```bash
fly scale count 2  # Run 2 instances
```

## Monitoring

### View logs
```bash
# Real-time logs
fly logs

# Filter by level
fly logs --filter="level=error"
```

### Check status
```bash
fly status
```

### SSH into machine
```bash
fly ssh console
```

### View metrics
```bash
fly dashboard  # Opens web dashboard
```

## Troubleshooting

### Browser not starting
**Issue**: "Failed to launch browser"

**Solution**: Increase memory
```bash
fly scale memory 2048  # At least 2GB for browser
```

### Out of memory crashes
**Symptom**: App restarts frequently

**Solution**: 
```bash
# Check memory usage
fly ssh console
> free -h

# Increase if needed
fly scale memory 4096
```

### Slow performance
**Solution 1**: Use faster model
```bash
fly secrets set MODEL_NAME=gpt-4.1-mini
```

**Solution 2**: Add more CPUs
```bash
fly scale vm shared-cpu-2x
```

### Health checks failing
**Check**:
```bash
fly checks list
```

**Fix**: Ensure server starts on PORT 8080
```typescript
// server.ts should use process.env.PORT || 3000
const port = process.env.PORT || 3000;
```

## Costs

### Typical monthly costs:
- **Free tier**: 3 shared-cpu-1x VMs (160GB-month)
  - Should cover light usage!
  
- **Paid usage**:
  - VM (shared-cpu-2x, 2GB RAM): ~$12/month
  - Outbound bandwidth: $0.02/GB
  - OpenAI API: Variable based on usage

### Minimize costs:
1. Use `gpt-4.1-mini` instead of `gpt-5`
2. Scale to 0 when not in use: `fly scale count 0`
3. Use `HEADLESS=true` (reduces memory)
4. Delete output screenshots regularly

## Persistence

By default, `/app/output` is ephemeral (lost on deploy).

**To persist screenshots**:

1. Create volume:
   ```bash
   fly volumes create game_autoplay_data --size 10  # 10GB
   ```

2. Uncomment in `fly.toml`:
   ```toml
   [mounts]
     source = "game_autoplay_data"
     destination = "/app/output"
   ```

3. Redeploy:
   ```bash
   fly deploy
   ```

## CI/CD

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Fly.io

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

Get token: `fly tokens create deploy`

Add to GitHub secrets: `FLY_API_TOKEN`

## Updating

### Deploy new version
```bash
git pull
fly deploy
```

### Rollback to previous version
```bash
fly releases  # List releases
fly releases rollback <version>
```

## Cleanup

### Stop app (but keep it)
```bash
fly scale count 0
```

### Delete app completely
```bash
fly apps destroy game-autoplay-dashboard
```

## Support

- Fly.io Docs: https://fly.io/docs/
- Fly.io Community: https://community.fly.io/
- Status: https://status.fly.io/


