# 08_ADVANCED_METRICS

## Overview

Implement advanced performance metrics collection including FPS (frames per second) monitoring and load time analysis. Enhances playability assessment with quantitative performance data beyond visual inspection.

## High-Level Approach

1. Inject performance monitoring scripts into browser context
2. Capture FPS data during gameplay execution
3. Measure page load times and resource loading
4. Track performance metrics timeline throughout session
5. Aggregate metrics into summary statistics
6. Include metrics in evaluation evidence for LLM analysis
7. Add metrics to final JSON output

## Key Components

### Core Modules

**`src/metrics/collector.ts`** - Metrics collection
- `MetricsCollector` class: Manages metrics gathering
- `initialize()`: Inject monitoring scripts into page
- `startCollection()`: Begin tracking metrics
- `collectFPS()`: Capture frame rate data
- `collectLoadTimes()`: Measure load performance
- `stopCollection()`: End collection and return data

**`src/metrics/fps.ts`** - FPS monitoring
- `FPSMonitor` class: Tracks frame rate
- `measureFPS()`: Calculate FPS using requestAnimationFrame
- `getAverageFPS()`: Compute average over time period
- `getFPSDrops()`: Identify FPS drops below threshold

**`src/metrics/performance.ts`** - Performance API integration
- `PerformanceMonitor` class: Uses browser Performance API
- `getLoadTime()`: Measure page load duration
- `getResourceTimings()`: Track resource loading times
- `getPaintTimings()`: Capture paint metrics (FCP, LCP)

**`src/metrics/analyzer.ts`** - Metrics analysis
- `MetricsAnalyzer` class: Analyzes collected metrics
- `analyzePerformance(metrics)`: Generate performance assessment
- `identifyBottlenecks(metrics)`: Find performance issues
- `generateScore(metrics)`: Calculate performance score

**`src/metrics/index.ts`** - Main metrics interface
- `PerformanceMetrics` class: Public API
- `collect(gameUrl)`: Run metrics collection
- Returns metrics data structure

## Implementation Steps

1. **FPS Monitoring**
   - Create `src/metrics/fps.ts` with FPSMonitor class
   - Inject JavaScript into page context to measure FPS:
     - Use requestAnimationFrame to track frame timing
     - Calculate FPS: 1000 / (frame_time_ms)
     - Sample FPS at regular intervals (e.g., every second)
   - Store FPS data points with timestamps
   - Calculate statistics: average, min, max, drops

2. **Performance API Integration**
   - Create `src/metrics/performance.ts` with PerformanceMonitor class
   - Use browser Performance API:
     - `performance.timing` for load times
     - `performance.getEntriesByType('resource')` for resource timing
     - `performance.getEntriesByType('paint')` for paint metrics
   - Extract key metrics:
     - DOMContentLoaded time
     - Window load time
     - First Contentful Paint (FCP)
     - Largest Contentful Paint (LCP)
     - Time to Interactive (TTI)

3. **Metrics Collection Orchestration**
   - Create `src/metrics/collector.ts` with MetricsCollector class
   - Initialize monitoring after page load
   - Start FPS collection during gameplay
   - Collect performance timings at appropriate times
   - Stop collection and retrieve data at end of session
   - Handle cases where Performance API not available

4. **Metrics Analysis**
   - Create `src/metrics/analyzer.ts` with MetricsAnalyzer class
   - Analyze FPS metrics:
     - Flag low average FPS (< 30 = critical, < 60 = warning)
     - Identify FPS drops and instability
     - Calculate stability score
   - Analyze load times:
     - Flag slow loads (> 5s = critical, > 3s = warning)
     - Identify slow resources
   - Generate performance score (0-100)
   - Create PerformanceIssue[] for inclusion in report

5. **Timeline Tracking**
   - Collect metrics at regular intervals during execution
   - Store snapshots with timestamps
   - Correlate metrics with agent phases (load, interaction, etc.)
   - Enable analysis of performance over time

6. **Integration with Agent**
   - Modify browser agent to initialize metrics collector
   - Start collection after page load
   - Continue collection during gameplay
   - Stop collection before evaluation
   - Pass metrics to evaluation module

7. **Integration with Evaluation**
   - Include metrics in evaluation evidence
   - Add performance-related prompts to LLM evaluation:
     - "Does the game maintain smooth frame rate?"
     - "Are load times acceptable?"
   - Use metrics to inform playability score
   - Include performance issues in final report

8. **Output Integration**
   - Add `performance_metrics` field to QAResult
   - Include metrics in final JSON output
   - Save detailed metrics to: `output/{runId}/metrics.json`
   - Add performance score to overall playability assessment

9. **Configuration**
   - Add metrics configuration to QAConfig:
     - Enable/disable metrics collection
     - FPS sampling rate
     - Performance thresholds
   - Support CLI flag: `--collect-metrics`

## Dependencies

### Internal Dependencies
- `src/agent/orchestrator.ts` - Integration point for metrics collection
- `src/evaluation/index.ts` - Include metrics in evaluation
- `src/types/index.ts` - Add PerformanceMetrics to types

### External Dependencies
- Browser Performance API (built-in)
- Browser JavaScript execution context

### Integration Dependencies
- Integrated with BROWSER_AGENT during execution
- Feeds data to AI_EVALUATION for analysis
- Included in final output from EXECUTION_INTERFACE

## Integration Points

- **Integrated with**: BROWSER_AGENT for metrics collection during execution
- **Feeds**: Performance data to AI_EVALUATION module
- **Enhances**: QAResult with performance_metrics field
- **Consumes**: Configuration from PROJECT_SETUP

## Testing Strategy

1. **Unit Tests**
   - Test FPS calculation logic
   - Test performance API data extraction
   - Test metrics analysis and scoring

2. **Integration Tests**
   - Test metrics collection with test page
   - Verify FPS data is captured
   - Verify load time measurements
   - Test metrics analysis

3. **Manual Testing**
   - Run metrics collection on test games
   - Verify FPS data is reasonable
   - Check load time measurements
   - Verify metrics appear in final output

4. **Edge Cases**
   - Performance API not available
   - Very low FPS games
   - Very slow loading games
   - Games that crash before metrics collection
   - Missing performance data (graceful degradation)

