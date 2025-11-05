/**
 * Dashboard Frontend - WebSocket client and UI updates
 */

class Dashboard {
  constructor() {
    this.ws = null;
    this.currentJobId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    
    this.initElements();
    this.bindEvents();
    this.connect();
  }

  initElements() {
    // Input
    this.urlInput = document.getElementById('urlInput');
    this.runButton = document.getElementById('runButton');
    
    // Stats
    this.pendingCount = document.getElementById('pendingCount');
    this.runningCount = document.getElementById('runningCount');
    this.completedCount = document.getElementById('completedCount');
    this.failedCount = document.getElementById('failedCount');
    
    // Current run
    this.currentRunSection = document.getElementById('currentRunSection');
    this.currentUrl = document.getElementById('currentUrl');
    this.progressFill = document.getElementById('progressFill');
    this.logsArea = document.getElementById('logsArea');
    this.screenshotsGallery = document.getElementById('screenshotsGallery');
    
    // History
    this.historyTable = document.getElementById('historyTable');
    
    // Connection status
    this.connectionStatus = document.getElementById('connectionStatus');
  }

  bindEvents() {
    this.runButton.addEventListener('click', () => this.handleRunTests());
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.updateConnectionStatus(true);
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.updateConnectionStatus(false);
      this.attemptReconnect();
    };
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
    }
  }

  updateConnectionStatus(connected) {
    this.connectionStatus.textContent = connected ? 'Connected' : 'Disconnected';
    this.connectionStatus.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
    this.runButton.disabled = !connected;
  }

  async handleRunTests() {
    const urls = this.urlInput.value
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);
    
    if (urls.length === 0) {
      alert('Please enter at least one URL');
      return;
    }

    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });

      const result = await response.json();
      
      if (result.success) {
        // Clear input
        this.urlInput.value = '';
        console.log('Jobs added:', result.jobs);
      } else {
        alert('Failed to start tests: ' + result.message);
      }
    } catch (error) {
      console.error('Error submitting tests:', error);
      alert('Failed to submit tests');
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case 'job-started':
        this.handleJobStarted(message.data);
        break;
      case 'log':
        this.handleLog(message.data);
        break;
      case 'screenshot':
        this.handleScreenshot(message.data);
        break;
      case 'action':
        this.handleAction(message.data);
        break;
      case 'job-completed':
        this.handleJobCompleted(message.data);
        break;
      case 'job-failed':
        this.handleJobFailed(message.data);
        break;
      case 'queue-update':
        this.handleQueueUpdate(message.data);
        break;
    }
  }

  handleJobStarted(data) {
    this.currentJobId = data.jobId;
    this.currentUrl.textContent = data.url;
    this.currentRunSection.style.display = 'block';
    this.logsArea.innerHTML = '';
    this.screenshotsGallery.innerHTML = '';
    this.progressFill.style.width = '0%';
    
    this.addLog('info', `Started testing: ${data.url}`);
  }

  handleLog(data) {
    if (data.jobId !== this.currentJobId) return;
    this.addLog(data.level, data.message);
  }

  handleScreenshot(data) {
    if (data.jobId !== this.currentJobId) return;
    
    const img = document.createElement('img');
    img.src = '/' + data.path;
    img.alt = `${data.type} screenshot ${data.actionCount}`;
    img.title = `Action ${data.actionCount} - ${data.type}`;
    img.className = 'screenshot-thumb';
    
    // Click to enlarge
    img.addEventListener('click', () => {
      window.open(img.src, '_blank');
    });
    
    this.screenshotsGallery.appendChild(img);
  }

  handleAction(data) {
    if (data.jobId !== this.currentJobId) return;
    
    const status = data.success ? '✅' : '❌';
    this.addLog('info', `${status} Action ${data.count}: ${data.action}`);
    
    // Update progress (assume 10 actions max for progress bar)
    const progress = Math.min((data.count / 10) * 100, 100);
    this.progressFill.style.width = progress + '%';
  }

  handleJobCompleted(data) {
    this.addLog('info', `✅ Completed in ${(data.duration / 1000).toFixed(1)}s - ${data.actionCount} actions, ${data.screenshotCount} screenshots`);
    this.progressFill.style.width = '100%';
    
    // Add to history
    this.addToHistory(data);
  }

  handleJobFailed(data) {
    this.addLog('error', `❌ Failed: ${data.error}`);
    
    // Add to history
    this.addToHistory({ ...data, success: false });
  }

  handleQueueUpdate(data) {
    this.pendingCount.textContent = data.pending || 0;
    this.runningCount.textContent = data.running || 0;
    this.completedCount.textContent = data.completed || 0;
    this.failedCount.textContent = data.failed || 0;
  }

  addLog(level, message) {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${level}`;
    
    const timestamp = new Date().toLocaleTimeString();
    const levelIcon = {
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      debug: '🔍'
    }[level] || '';
    
    logEntry.textContent = `[${timestamp}] ${levelIcon} ${message}`;
    
    this.logsArea.appendChild(logEntry);
    
    // Auto-scroll to bottom
    this.logsArea.scrollTop = this.logsArea.scrollHeight;
  }

  addToHistory(data) {
    // Remove empty state
    const emptyState = this.historyTable.querySelector('.empty-state');
    if (emptyState) {
      emptyState.remove();
    }

    const row = document.createElement('div');
    row.className = 'history-row';
    
    const status = data.success ? '✅' : '❌';
    const duration = data.duration ? `${(data.duration / 1000).toFixed(1)}s` : '-';
    const actions = data.actionCount || 0;
    const screenshots = data.screenshotCount || 0;
    
    const url = new URL(data.url);
    const displayUrl = url.hostname + url.pathname;
    
    row.innerHTML = `
      <span class="history-status">${status}</span>
      <span class="history-url">${displayUrl}</span>
      <span class="history-duration">${duration}</span>
      <span class="history-actions">${actions} actions</span>
      <span class="history-screenshots">${screenshots} screenshots</span>
    `;
    
    // Insert at top
    this.historyTable.insertBefore(row, this.historyTable.firstChild);
  }
}

// Initialize dashboard when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new Dashboard());
} else {
  new Dashboard();
}

