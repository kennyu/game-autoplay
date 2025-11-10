/**
 * HTTP Server with WebSocket support for Game QA Agent Dashboard
 */

import { ServerWebSocket } from 'bun';
import { logger } from '../utils/logger.js';

export interface WebSocketData {
  clientId: string;
}

export interface ServerConfig {
  port: number;
  publicDir: string;
}

interface SSEClient {
  id: string;
  controller: ReadableStreamDefaultController;
  jobId?: string; // Optional: if client is streaming a specific job
}

export class DashboardServer {
  private clients: Set<ServerWebSocket<WebSocketData>> = new Set();
  private sseClients: Map<string, SSEClient> = new Map();
  private config: ServerConfig;
  private apiHandlers: Map<string, (req: Request) => Promise<Response>> = new Map();

  constructor(config: ServerConfig) {
    this.config = config;
  }

  /**
   * Register API handler
   */
  registerApiHandler(path: string, handler: (req: Request) => Promise<Response>) {
    this.apiHandlers.set(path, handler);
  }

  /**
   * Start the HTTP server with WebSocket support
   */
  start() {
    const server = Bun.serve<WebSocketData>({
      port: this.config.port,
      
      fetch: async (req, server) => {
        const url = new URL(req.url);

        // WebSocket upgrade
        if (url.pathname === '/ws') {
          const upgraded = server.upgrade(req, {
            data: {
              clientId: crypto.randomUUID(),
            },
          });

          if (!upgraded) {
            return new Response('WebSocket upgrade failed', { status: 500 });
          }

          return undefined;
        }

        // API Routes
        if (url.pathname.startsWith('/api/')) {
          return this.handleApiRequest(url.pathname, req);
        }

        // Output directory (screenshots and artifacts)
        if (url.pathname.startsWith('/output/')) {
          return this.serveStatic(url.pathname, true);
        }

        // Static file serving (public directory)
        return this.serveStatic(url.pathname);
      },

      websocket: {
        open: (ws) => {
          this.clients.add(ws);
          logger.info(`WebSocket client connected: ${ws.data.clientId}`);
        },

        message: (ws, message) => {
          // Handle incoming messages from clients
          try {
            const data = JSON.parse(message.toString());
            this.handleWebSocketMessage(ws, data);
          } catch (error) {
            logger.error('Invalid WebSocket message', error as Error);
          }
        },

        close: (ws) => {
          this.clients.delete(ws);
          logger.info(`WebSocket client disconnected: ${ws.data.clientId}`);
        },
      },
    });

    logger.info(`Dashboard running at http://localhost:${this.config.port}`);
    return server;
  }

  /**
   * Handle API requests
   */
  private async handleApiRequest(pathname: string, req: Request): Promise<Response> {
    // Check for exact match first
    const exactHandler = this.apiHandlers.get(pathname);
    if (exactHandler) {
      return exactHandler(req);
    }
    
    // Check for pattern matches (e.g., /api/stream/:jobId)
    for (const [pattern, handler] of this.apiHandlers) {
      if (pattern.includes(':')) {
        const regex = this.patternToRegex(pattern);
        if (regex.test(pathname)) {
          return handler(req);
        }
      }
    }

    return new Response('Not Found', { status: 404 });
  }
  
  /**
   * Convert path pattern to regex (e.g., /api/stream/:jobId -> /api/stream/[^/]+)
   */
  private patternToRegex(pattern: string): RegExp {
    const regexPattern = pattern.replace(/:[^/]+/g, '[^/]+');
    return new RegExp(`^${regexPattern}$`);
  }

  /**
   * Handle WebSocket messages from clients
   */
  private handleWebSocketMessage(ws: ServerWebSocket<WebSocketData>, data: any) {
    // Placeholder for handling client messages
    logger.debug(`Message from ${ws.data.clientId}:`, data);
  }

  /**
   * Broadcast message to all connected clients (WebSocket and SSE)
   */
  broadcast(message: any) {
    // Send to WebSocket clients
    const payload = JSON.stringify(message);
    for (const client of this.clients) {
      try {
        client.send(payload);
      } catch (error) {
        logger.error('Failed to send to WebSocket client', error as Error);
      }
    }
    
    // Send to SSE clients
    for (const [clientId, sseClient] of this.sseClients) {
      try {
        // Filter by jobId if SSE client is subscribed to a specific job
        if (sseClient.jobId && message.data?.jobId !== sseClient.jobId) {
          continue; // Skip if message is for a different job
        }
        
        this.sendSSEEvent(sseClient.controller, message.type, message.data);
      } catch (error) {
        logger.error(`Failed to send to SSE client ${clientId}`, error as Error);
        // Remove dead client
        this.sseClients.delete(clientId);
      }
    }
  }
  
  /**
   * Send SSE event to a client
   */
  private sendSSEEvent(controller: ReadableStreamDefaultController, type: string, data: any) {
    const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    controller.enqueue(new TextEncoder().encode(message));
  }
  
  /**
   * Create SSE stream for a client
   */
  createSSEStream(jobId?: string): Response {
    const clientId = crypto.randomUUID();
    
    const stream = new ReadableStream({
      start: (controller) => {
        // Register client
        this.sseClients.set(clientId, { id: clientId, controller, jobId });
        logger.info(`SSE client connected: ${clientId}${jobId ? ` (job: ${jobId})` : ''}`);
        
        // Send initial connection message
        this.sendSSEEvent(controller, 'connected', { clientId, jobId });
      },
      cancel: () => {
        // Clean up when client disconnects
        this.sseClients.delete(clientId);
        logger.info(`SSE client disconnected: ${clientId}`);
      },
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  }

  /**
   * Serve static files from public directory or output directory
   */
  private async serveStatic(pathname: string, isOutputDir = false): Promise<Response> {
    // Default to index.html for root
    if (pathname === '/' && !isOutputDir) {
      pathname = '/index.html';
    }

    // Determine base directory
    const baseDir = isOutputDir ? '.' : this.config.publicDir;
    const filePath = isOutputDir ? pathname.slice(1) : `${baseDir}${pathname}`;

    logger.debug(`Serving static file: pathname=${pathname}, isOutputDir=${isOutputDir}, filePath=${filePath}`);

    try {
      const file = Bun.file(filePath);
      const exists = await file.exists();

      if (!exists) {
        logger.warn(`File not found: ${filePath}`);
        return new Response('Not Found', { status: 404 });
      }

      // Determine content type
      const ext = pathname.split('.').pop();
      const contentType = this.getContentType(ext || '');

      logger.debug(`Serving file: ${filePath} (${contentType})`);

      return new Response(file, {
        headers: {
          'Content-Type': contentType,
        },
      });
    } catch (error) {
      logger.error('Error serving static file:', error as Error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(ext: string): string {
    const types: Record<string, string> = {
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      json: 'application/json',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
    };

    return types[ext] || 'application/octet-stream';
  }
}

