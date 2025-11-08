# 09_WEB_DASHBOARD

## Overview

Create a simple web dashboard for viewing test results and history. Provides a user-friendly interface to browse past test runs, view detailed results, and visualize playability scores and issues. Serves as a web UI complement to CLI and serverless interfaces.

## High-Level Approach

1. Create lightweight web server (using Bun's built-in HTTP server or Express)
2. Serve static HTML/CSS/JavaScript frontend
3. Implement API endpoints to read test results from output directory
4. Create dashboard UI with test history, result details, and visualizations
5. Display screenshots, metrics, and issue summaries
6. Support filtering and searching test results
7. Deploy as optional companion service

## Key Components

### Core Modules

**`src/dashboard/server.ts`** - Web server
- `DashboardServer` class: HTTP server setup
- `start(port)`: Start web server
- `setupRoutes()`: Define API routes
- `serveStatic()`: Serve frontend assets

**`src/dashboard/api.ts`** - API endpoints
- `APIRouter` class: API route handlers
- `GET /api/runs`: List all test runs
- `GET /api/runs/:runId`: Get specific test run details
- `GET /api/runs/:runId/screenshot/:index`: Serve screenshot image
- `GET /api/stats`: Get aggregated statistics
- `GET /api/search`: Search test runs by URL or date

**`src/dashboard/storage.ts`** - Result data access
- `ResultStorage` class: Reads test results from filesystem
- `listRuns()`: Scan output directory for test runs
- `getRun(runId)`: Load test run data
- `getStats()`: Calculate aggregate statistics

**`src/dashboard/frontend/`** - Web UI
- `index.html`: Main dashboard page
- `styles.css`: Dashboard styling
- `app.js`: Frontend JavaScript
- `components/`: UI components (run list, result view, charts)

**`src/dashboard/index.ts`** - Dashboard entry point
- `startDashboard(port)`: Main function to start dashboard
- CLI command: `qa-agent --dashboard [port]`

## Implementation Steps

1. **Web Server Setup**
   - Create `src/dashboard/server.ts` with DashboardServer class
   - Use Bun's built-in HTTP server or lightweight framework
   - Set up CORS headers for API access
   - Configure static file serving for frontend

2. **API Endpoints**
   - Create `src/dashboard/api.ts` with APIRouter class
   - Implement `GET /api/runs`:
     - Scan output directory
     - Return list of RunListItem with metadata
     - Support pagination and sorting
   - Implement `GET /api/runs/:runId`:
     - Load full RunDetail from filesystem
     - Return JSON with all test data
   - Implement `GET /api/runs/:runId/screenshot/:index`:
     - Serve screenshot images with proper content-type
     - Handle missing files gracefully
   - Implement `GET /api/stats`:
     - Calculate aggregate statistics
     - Return DashboardStats
   - Implement `GET /api/search`:
     - Search runs by URL pattern or date range
     - Return filtered RunListItem[]

3. **Result Storage Layer**
   - Create `src/dashboard/storage.ts` with ResultStorage class
   - Implement `listRuns()`: Read output directory structure
   - Implement `getRun(runId)`: Load JSON files from run directory
   - Parse metadata.json and result.json files
   - Cache frequently accessed data (optional)

4. **Frontend HTML Structure**
   - Create `src/dashboard/frontend/index.html`:
     - Dashboard layout with header
     - Run list sidebar
     - Main content area for result details
     - Screenshot gallery section
   - Add basic styling structure

5. **Frontend Styling**
   - Create `src/dashboard/frontend/styles.css`:
     - Modern, clean design
     - Responsive layout
     - Color coding for pass/fail status
     - Screenshot grid layout
   - Use CSS variables for theming

6. **Frontend JavaScript**
   - Create `src/dashboard/frontend/app.js`:
     - Fetch and display run list
     - Handle run selection
     - Display run details (score, issues, metrics)
     - Render screenshot gallery
     - Implement search/filter functionality
   - Use vanilla JavaScript (no framework dependency)

7. **Visualizations**
   - Add simple charts for:
     - Playability score over time
     - Pass/fail trend
     - Issue category breakdown
   - Use lightweight charting library (e.g., Chart.js) or CSS-based visuals

8. **CLI Integration**
   - Add `--dashboard` flag to CLI
   - Start dashboard server on specified port (default: 3000)
   - Option: `--dashboard-port <port>`
   - Run dashboard independently: `qa-agent --dashboard`

9. **Error Handling**
   - Handle missing test results gracefully
   - Show error messages in UI
   - Handle invalid run IDs
   - Handle missing screenshots

10. **Deployment Considerations**
    - Document how to run dashboard
    - Support environment variable configuration
    - Option to run dashboard as separate service
    - Consider security (don't expose sensitive data)

## Dependencies

### Internal Dependencies
- `src/types/index.ts` - QAResult, Issue types
- File system access to output directory

### External Dependencies
- Bun HTTP server (built-in) or lightweight web framework
- Optional: Chart.js or similar for visualizations

### Integration Dependencies
- Reads output from REPORTING module
- Displays results from EXECUTION_INTERFACE
- Optional companion to CLI/serverless interfaces

## Integration Points

- **Reads**: Test results from output directory (created by REPORTING)
- **Displays**: QAResult data from EXECUTION_INTERFACE
- **Optional**: Can run independently or alongside CLI
- **Enhances**: User experience for viewing test history

## Testing Strategy

1. **Unit Tests**
   - Test API endpoint handlers with mock data
   - Test result storage layer file reading
   - Test data parsing and transformation

2. **Integration Tests**
   - Test API endpoints with real test result files
   - Test screenshot serving
   - Test search and filtering

3. **Manual Testing**
   - Start dashboard server
   - Navigate to dashboard in browser
   - Verify run list displays correctly
   - Click on runs to view details
   - Verify screenshots load
   - Test search functionality

4. **Edge Cases**
   - Empty output directory (no test runs)
   - Missing screenshot files
   - Corrupted result JSON files
   - Very large result sets (pagination)
   - Invalid run IDs in URLs

