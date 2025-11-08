/**
 * Dashboard Frontend - WebSocket client and UI updates for parallel jobs
 */

class Dashboard {
  constructor() {
    this.ws = null;
    this.activeJobs = new Map(); // Map of jobId -> job data
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
    
    // Running jobs container
    this.runningJobsSection = document.getElementById('runningJobsSection');
    this.runningJobsContainer = document.getElementById('runningJobsContainer');
    
    // Results container
    this.resultsContainer = document.getElementById('resultsContainer');
    this.refreshResults = document.getElementById('refreshResults');
    
    // Connection status
    this.connectionStatus = document.getElementById('connectionStatus');
  }

  bindEvents() {
    this.runButton.addEventListener('click', () => this.handleRunTests());
    this.refreshResults.addEventListener('click', () => this.loadResults());
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.updateConnectionStatus(true);
      this.loadResults(); // Load historical results on connect
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
    // Show running jobs section
    this.runningJobsSection.style.display = 'block';
    
    // Create job section
    const jobSection = this.createJobSection(data);
    this.runningJobsContainer.appendChild(jobSection);
    
    // Track active job
    this.activeJobs.set(data.jobId, {
      ...data,
      actionCount: 0,
      startTime: Date.now(),
    });
    
    this.addLogToJob(data.jobId, 'info', `Started testing: ${data.url}`);
  }

  createJobSection(data) {
    const section = document.createElement('div');
    section.className = 'job-section';
    section.id = `job-${data.jobId}`;
    
    // Extract hostname for display
    const url = new URL(data.url);
    const displayUrl = url.hostname + url.pathname;
    
    section.innerHTML = `
      <div class="job-header" onclick="dashboard.toggleJob('${data.jobId}')">
        <div class="job-info">
          <span class="job-status">🔄</span>
          <span class="job-url">${displayUrl}</span>
          <span class="job-timer">0s</span>
        </div>
        <span class="job-toggle">▼</span>
      </div>
      <div class="job-content">
        <div class="progress-bar">
          <div class="progress-fill" data-job-progress="${data.jobId}"></div>
        </div>
        <div class="split-view">
          <div class="logs-container">
            <h4>Live Logs</h4>
            <div class="logs-area" data-job-logs="${data.jobId}"></div>
          </div>
          <div class="screenshots-container">
            <h4>Screenshots</h4>
            <div class="screenshots-gallery" data-job-screenshots="${data.jobId}"></div>
          </div>
        </div>
      </div>
    `;
    
    // Start timer
    this.startJobTimer(data.jobId);
    
    return section;
  }

  toggleJob(jobId) {
    const section = document.getElementById(`job-${jobId}`);
    if (!section) return;
    
    section.classList.toggle('collapsed');
    const toggle = section.querySelector('.job-toggle');
    toggle.textContent = section.classList.contains('collapsed') ? '▶' : '▼';
  }

  startJobTimer(jobId) {
    const interval = setInterval(() => {
      const job = this.activeJobs.get(jobId);
      if (!job) {
        clearInterval(interval);
        return;
      }
      
      const elapsed = Math.floor((Date.now() - job.startTime) / 1000);
      const section = document.getElementById(`job-${jobId}`);
      if (section) {
        const timer = section.querySelector('.job-timer');
        if (timer) {
          timer.textContent = `${elapsed}s`;
        }
      }
    }, 1000);
    
    // Store interval for cleanup
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.timerInterval = interval;
    }
  }

  handleLog(data) {
    if (!this.activeJobs.has(data.jobId)) return;
    this.addLogToJob(data.jobId, data.level, data.message);
  }

  handleScreenshot(data) {
    if (!this.activeJobs.has(data.jobId)) return;
    
    const gallery = document.querySelector(`[data-job-screenshots="${data.jobId}"]`);
    if (!gallery) {
      console.error('Screenshot gallery not found for job:', data.jobId);
      return;
    }
    
    console.log('📸 Received screenshot:', data.path, 'for job:', data.jobId);
    
    const img = document.createElement('img');
    
    // Normalize path: remove leading ./, convert backslashes to forward slashes, ensure leading /
    let normalizedPath = data.path.replace(/^\.\//, '').replace(/\\/g, '/');
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = '/' + normalizedPath;
    }
    
    console.log('📸 Normalized path:', normalizedPath);
    
    img.src = normalizedPath;
    img.alt = `${data.type} screenshot ${data.actionCount}`;
    img.title = `Action ${data.actionCount} - ${data.type}`;
    img.className = 'screenshot-thumb';
    
    // Click to enlarge
    img.addEventListener('click', () => {
      window.open(img.src, '_blank');
    });
    
    // Error handling
    img.onerror = () => {
      console.error('❌ Failed to load screenshot:', normalizedPath);
      console.error('   Original path:', data.path);
      img.style.opacity = '0.3';
      img.style.border = '2px solid red';
      img.alt = `⚠️ Failed to load ${data.type}`;
    };
    
    // Success logging
    img.onload = () => {
      console.log('✅ Screenshot loaded successfully:', normalizedPath);
    };
    
    gallery.appendChild(img);
  }

  handleAction(data) {
    if (!this.activeJobs.has(data.jobId)) return;
    
    const job = this.activeJobs.get(data.jobId);
    job.actionCount = data.count;
    
    const status = data.success ? '✅' : '❌';
    this.addLogToJob(data.jobId, 'info', `${status} Action ${data.count}: ${data.action}`);
    
    // Update progress (assume 10 actions max for progress bar)
    const progress = Math.min((data.count / 10) * 100, 100);
    const progressFill = document.querySelector(`[data-job-progress="${data.jobId}"]`);
    if (progressFill) {
      progressFill.style.width = progress + '%';
    }
  }

  handleJobCompleted(data) {
    const job = this.activeJobs.get(data.jobId);
    if (job) {
      clearInterval(job.timerInterval);
    }
    
    // Log evaluation results
    const statusEmoji = data.status === 'pass' ? '✅' : '❌';
    this.addLogToJob(data.jobId, 'info', `${statusEmoji} ${data.status.toUpperCase()} - Score: ${data.playabilityScore}/100`);
    this.addLogToJob(data.jobId, 'info', `  ${data.checks.gameLoaded ? '✅' : '❌'} Game Loaded`);
    this.addLogToJob(data.jobId, 'info', `  ${data.checks.controlsResponsive ? '✅' : '❌'} Controls Responsive`);
    this.addLogToJob(data.jobId, 'info', `  ${data.checks.gameStable ? '✅' : '❌'} Game Stable`);
    
    if (data.issues && data.issues.length > 0) {
      this.addLogToJob(data.jobId, 'warn', `Issues: ${data.issues.length}`);
      data.issues.forEach(issue => {
        const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'major' ? '🟡' : '🔵';
        this.addLogToJob(data.jobId, 'warn', `  ${icon} ${issue.description}`);
      });
    }
    
    this.addLogToJob(data.jobId, 'info', `Completed in ${(data.duration / 1000).toFixed(1)}s - ${data.actionCount} actions, ${data.screenshotCount} screenshots`);
    
    // Update progress to 100%
    const progressFill = document.querySelector(`[data-job-progress="${data.jobId}"]`);
    if (progressFill) {
      progressFill.style.width = '100%';
    }
    
    // Update job status icon based on evaluation
    const section = document.getElementById(`job-${data.jobId}`);
    if (section) {
      const statusIcon = section.querySelector('.job-status');
      if (statusIcon) {
        statusIcon.textContent = data.status === 'pass' ? '✅' : '❌';
      }
    }
    
    // Remove from active jobs after a delay
    setTimeout(() => {
      this.activeJobs.delete(data.jobId);
      const section = document.getElementById(`job-${data.jobId}`);
      if (section) {
        section.remove();
      }
      
      // Hide section if no more active jobs
      if (this.activeJobs.size === 0) {
        this.runningJobsSection.style.display = 'none';
      }
    }, 5000);
    
    // Add to history
    this.addToHistory(data);
  }

  handleJobFailed(data) {
    const job = this.activeJobs.get(data.jobId);
    if (job) {
      clearInterval(job.timerInterval);
    }
    
    this.addLogToJob(data.jobId, 'error', `❌ Failed: ${data.error}`);
    
    // Update job status icon
    const section = document.getElementById(`job-${data.jobId}`);
    if (section) {
      const statusIcon = section.querySelector('.job-status');
      if (statusIcon) {
        statusIcon.textContent = '❌';
      }
    }
    
    // Remove from active jobs after a delay
    setTimeout(() => {
      this.activeJobs.delete(data.jobId);
      const section = document.getElementById(`job-${data.jobId}`);
      if (section) {
        section.remove();
      }
      
      // Hide section if no more active jobs
      if (this.activeJobs.size === 0) {
        this.runningJobsSection.style.display = 'none';
      }
    }, 5000);
    
    // Add to history
    this.addToHistory({ ...data, success: false });
  }

  handleQueueUpdate(data) {
    this.pendingCount.textContent = data.pending || 0;
    this.runningCount.textContent = data.running || 0;
    this.completedCount.textContent = data.completed || 0;
    this.failedCount.textContent = data.failed || 0;
  }

  addLogToJob(jobId, level, message) {
    const logsArea = document.querySelector(`[data-job-logs="${jobId}"]`);
    if (!logsArea) return;
    
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
    
    logsArea.appendChild(logEntry);
    
    // Auto-scroll to bottom
    logsArea.scrollTop = logsArea.scrollHeight;
  }

  async loadResults() {
    try {
      const response = await fetch('/api/results');
      const data = await response.json();
      
      this.resultsContainer.innerHTML = '';
      
      if (data.runs.length === 0) {
        this.resultsContainer.innerHTML = '<p class="empty-state">No test runs found. Run some tests to get started!</p>';
        return;
      }
      
      data.runs.forEach(run => {
        const resultCard = this.createResultCard(run);
        this.resultsContainer.appendChild(resultCard);
      });
    } catch (error) {
      console.error('Failed to load results:', error);
      this.resultsContainer.innerHTML = '<p class="empty-state error">Failed to load results. Please refresh.</p>';
    }
  }

  createResultCard(run) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.id = `result-${run.folder}`;
    
    // Use evaluation status if available, fallback to old success field
    const hasEvaluation = run.status !== undefined;
    const status = hasEvaluation ? (run.status === 'pass' ? '✅' : '❌') : (run.success ? '✅' : '❌');
    const statusClass = hasEvaluation ? run.status : (run.success ? 'success' : 'failed');
    const duration = (run.duration / 1000).toFixed(1);
    const date = new Date(run.startedAt).toLocaleString();
    
    let url;
    try {
      const parsedUrl = new URL(run.url);
      url = parsedUrl.hostname + parsedUrl.pathname;
    } catch {
      url = run.url;
    }
    
    // Build evaluation section if available
    let evaluationHTML = '';
    if (hasEvaluation) {
      const scoreColor = run.playabilityScore >= 70 ? '#4ade80' : run.playabilityScore >= 50 ? '#fbbf24' : '#f87171';
      evaluationHTML = `
        <div class="evaluation-summary">
          <div class="score-display" style="color: ${scoreColor};">
            <span class="score-number">${run.playabilityScore}</span>
            <span class="score-label">/100</span>
          </div>
          <div class="checks-list">
            <div class="check-item ${run.checks.gameLoaded ? 'pass' : 'fail'}">
              ${run.checks.gameLoaded ? '✅' : '❌'} Game Loaded <span class="check-points">(30pts)</span>
            </div>
            <div class="check-item ${run.checks.controlsResponsive ? 'pass' : 'fail'}">
              ${run.checks.controlsResponsive ? '✅' : '❌'} Controls Responsive <span class="check-points">(40pts)</span>
            </div>
            <div class="check-item ${run.checks.gameStable ? 'pass' : 'fail'}">
              ${run.checks.gameStable ? '✅' : '❌'} Game Stable <span class="check-points">(30pts)</span>
            </div>
          </div>
          ${run.issues && run.issues.length > 0 ? `
            <div class="issues-list">
              <h5>Issues (${run.issues.length})</h5>
              ${run.issues.map(issue => {
                const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'major' ? '🟡' : '🔵';
                return `
                  <div class="issue-item ${issue.severity}">
                    ${icon} <strong>[${issue.severity}]</strong> ${issue.description}
                    ${issue.evidence ? `<div class="issue-evidence">${issue.evidence}</div>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }
    
    card.innerHTML = `
      <div class="result-header ${statusClass}" onclick="dashboard.toggleResult('${run.folder}')">
        <div class="result-info">
          <span class="result-status">${status}</span>
          <span class="result-url">${url}</span>
          ${hasEvaluation ? `<span class="result-score">${run.playabilityScore}/100</span>` : ''}
          <span class="result-meta">${date} • ${duration}s • ${run.actionCount} actions</span>
        </div>
        <span class="result-toggle">▼</span>
      </div>
      <div class="result-content">
        ${evaluationHTML}
        <div class="actions-list">
          <h4>Actions (${run.actionCount})</h4>
          ${run.actions && run.actions.length > 0 ? run.actions.map((action, i) => `
            <div class="action-item ${action.success ? 'success' : 'failed'}">
              <span class="action-number">${i + 1}</span>
              <span class="action-status">${action.success ? '✅' : '❌'}</span>
              <span class="action-text">${action.action}</span>
              ${action.error ? `<span class="action-error">${action.error}</span>` : ''}
            </div>
          `).join('') : '<p class="empty-state">No action data available</p>'}
        </div>
        <div class="screenshots-grid">
          <h4>Screenshots (${run.screenshotCount || 0})</h4>
          <div class="screenshot-gallery">
            ${run.screenshots && run.screenshots.length > 0 ? run.screenshots.map((screenshot, i) => {
              const filename = screenshot.split(/[/\\]/).pop();
              const isBeforeAction = filename.includes('-before.');
              const label = filename.replace('.png', '').replace('action-', 'Action ').replace('-before', ' Before').replace('-after', ' After');
              // Normalize path: remove leading ./, convert backslashes, ensure leading /
              let normalizedPath = screenshot.replace(/^\.\//, '').replace(/\\/g, '/');
              if (!normalizedPath.startsWith('/')) {
                normalizedPath = '/' + normalizedPath;
              }
              return `
                <div class="screenshot-item ${isBeforeAction ? 'before' : 'after'}">
                  <img src="${normalizedPath}" alt="${label}" onclick="window.open(this.src, '_blank')" onerror="console.error('Failed to load:', this.src)" />
                  <span class="screenshot-label">${label}</span>
                </div>
              `;
            }).join('') : '<p class="empty-state">No screenshots available</p>'}
          </div>
        </div>
      </div>
    `;
    
    return card;
  }

  toggleResult(folder) {
    const card = document.getElementById(`result-${folder}`);
    if (!card) return;
    
    card.classList.toggle('collapsed');
    const toggle = card.querySelector('.result-toggle');
    toggle.textContent = card.classList.contains('collapsed') ? '▶' : '▼';
  }
}

// Global reference for onclick handlers
let dashboard;

// Initialize dashboard when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { dashboard = new Dashboard(); });
} else {
  dashboard = new Dashboard();
}
