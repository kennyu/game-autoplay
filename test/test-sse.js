#!/usr/bin/env bun
/**
 * Test SSE streaming endpoint with EventSource
 * Usage: bun test-sse.js <game-url>
 */

const SERVER = 'http://localhost:3000';
const GAME_URL = process.argv[2] || 'https://playtictactoe.net/';

console.log('🚀 Testing SSE Streaming API');
console.log('================================');
console.log('Game URL:', GAME_URL);
console.log('');

// Step 1: Submit job
console.log('📤 Step 1: Submitting job...');

const response = await fetch(`${SERVER}/api/run`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ urls: [GAME_URL] }),
});

const result = await response.json();

if (!result.success || !result.jobs || result.jobs.length === 0) {
  console.error('❌ Error: Failed to create job');
  console.error('Response:', result);
  process.exit(1);
}

const jobId = result.jobs[0].id;
console.log('✅ Job created:', jobId);
console.log('');

// Step 2: Stream events via SSE (using fetch streaming)
console.log('📡 Step 2: Streaming events (SSE)...');
console.log('URL:', `${SERVER}/api/stream/${jobId}`);
console.log('================================');
console.log('');

// Fetch with streaming (works in Bun)
const streamResponse = await fetch(`${SERVER}/api/stream/${jobId}`);

if (!streamResponse.ok) {
  console.error('❌ Error:', streamResponse.status, streamResponse.statusText);
  process.exit(1);
}

// Parse SSE stream
const reader = streamResponse.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

const handleEvent = (eventType, data) => {
  try {
    const parsed = JSON.parse(data);
    
    switch (eventType) {
      case 'connected':
        console.log('🔌 Connected to SSE stream');
        console.log('   Client ID:', parsed.clientId);
        console.log('   Job ID:', parsed.jobId);
        console.log('');
        break;
        
      case 'job-started':
        console.log('▶️  Job started');
        console.log('   URL:', parsed.url);
        console.log('');
        break;
        
      case 'log':
        const icon = parsed.level === 'error' ? '❌' : parsed.level === 'warn' ? '⚠️' : 'ℹ️';
        console.log(`${icon} ${parsed.message}`);
        break;
        
      case 'action':
        const status = parsed.success ? '✅' : '❌';
        console.log(`${status} Action: ${parsed.action}`);
        console.log('');
        break;
        
      case 'screenshot':
        console.log(`📸 Screenshot: ${parsed.path}`);
        break;
        
      case 'job-completed':
        console.log('');
        console.log('================================');
        console.log('✅ Job completed!');
        console.log('');
        console.log('📊 Results:');
        console.log('   Status:', parsed.status);
        console.log('   Score:', parsed.playabilityScore + '/100');
        console.log('   Duration:', (parsed.duration / 1000).toFixed(1) + 's');
        console.log('   Actions:', parsed.actionCount);
        console.log('   Screenshots:', parsed.screenshotCount);
        console.log('');
        console.log('Checks:');
        console.log('   ' + (parsed.checks.gameLoaded ? '✅' : '❌') + ' Game Loaded');
        console.log('   ' + (parsed.checks.controlsResponsive ? '✅' : '❌') + ' Controls Responsive');
        console.log('   ' + (parsed.checks.gameStable ? '✅' : '❌') + ' Game Stable');
        
        if (parsed.issues && parsed.issues.length > 0) {
          console.log('');
          console.log('Issues:');
          parsed.issues.forEach(issue => {
            const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'major' ? '🟡' : '🔵';
            console.log('   ' + icon + ' [' + issue.severity + '] ' + issue.description);
          });
        }
        
        console.log('');
        console.log('✨ Test complete!');
        process.exit(0);
        
      case 'job-failed':
        console.log('');
        console.log('❌ Job failed!');
        console.log('   Error:', parsed.error);
        console.log('');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error parsing event data:', error);
  }
};

// Read stream
while (true) {
  const { done, value } = await reader.read();
  
  if (done) {
    console.log('Stream closed');
    break;
  }
  
  // Decode chunk and add to buffer
  buffer += decoder.decode(value, { stream: true });
  
  // Process complete messages (separated by \n\n)
  const messages = buffer.split('\n\n');
  buffer = messages.pop(); // Keep incomplete message in buffer
  
  for (const message of messages) {
    if (!message.trim()) continue;
    
    // Parse SSE format: "event: type\ndata: json"
    const lines = message.split('\n');
    let eventType = '';
    let data = '';
    
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.substring(7).trim();
      } else if (line.startsWith('data: ')) {
        data = line.substring(6).trim();
      }
    }
    
    if (eventType && data) {
      handleEvent(eventType, data);
    }
  }
}

// Timeout
setTimeout(() => {
  console.error('⏱️  Timeout: Job took too long');
  process.exit(1);
}, 600000);

