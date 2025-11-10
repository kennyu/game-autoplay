# Dockerfile for Game Autoplay Agent
# Optimized for Fly.io deployment with Bun + Playwright

FROM oven/bun:1.2-debian AS base
WORKDIR /app

# Install system dependencies for Playwright/Chromium
RUN apt-get update && apt-get install -y \
    # Chromium dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    # Additional dependencies
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libu2f-udev \
    xdg-utils \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json ./
COPY bun.lock[b] ./

# Install dependencies
RUN bun install --production

# Install Playwright browsers (Chromium only for efficiency)
RUN bunx playwright install chromium
RUN bunx playwright install-deps chromium

# Copy application code
COPY . .

# Create output directory
RUN mkdir -p /app/output

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Run the dashboard server
CMD ["bun", "run", "server.ts"]




