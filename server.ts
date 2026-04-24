import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { randomUUID } from "crypto";
import { setupTelegram } from "./src/lib/channels/telegram";
import webRouter from "./src/lib/channels/web";
import { logger } from "./src/lib/logger";
import { config } from "./src/lib/config";
import { Ollama } from "ollama";
import { getDb } from "./src/lib/db";

async function checkOllamaHealth(): Promise<boolean> {
  try {
    const ollama = new Ollama({ host: config.OLLAMA_BASE_URL });
    await ollama.list();
    logger.info({ url: config.OLLAMA_BASE_URL }, 'Ollama connection established');
    return true;
  } catch (error: any) {
    logger.error({ error: error.message, url: config.OLLAMA_BASE_URL }, 'Ollama health check failed');
    return false;
  }
}

async function startServer() {
  // Validate required environment variables
  if (!config.OLLAMA_BASE_URL) {
    logger.fatal('OLLAMA_BASE_URL is not set. Please set OLLAMA_BASE_URL in your .env file or environment.');
    process.exit(1);
  }

  // Validate Ollama connectivity before starting
  const ollamaHealthy = await checkOllamaHealth();
  if (!ollamaHealthy) {
    logger.fatal('Ollama is not reachable. Please ensure Ollama is running and OLLAMA_BASE_URL is correct.');
    process.exit(1);
  }
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Request ID middleware — stamps every request with a unique ID for log correlation
  app.use((req, res, next) => {
    const reqId = (req.headers['x-request-id'] as string) || randomUUID();
    res.setHeader('x-request-id', reqId);
    (req as any).reqId = reqId;
    next();
  });

  // Request logging middleware
  app.use((req, _res, next) => {
    logger.info({ reqId: (req as any).reqId, method: req.method, url: req.url }, 'incoming request');
    next();
  });

  // API routes
  app.use('/api', webRouter);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Setup Telegram
  setupTelegram().catch(err => logger.error(err, 'Failed to setup Telegram'));

  const server = app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown handler
  async function gracefulShutdown(signal: string) {
    logger.info({ signal }, 'Graceful shutdown initiated');

    // Close HTTP server
    server.close(async () => {
      logger.info('HTTP server closed');

      // Close database connections
      try {
        const db = await getDb();
        await db.close();
        logger.info('Database connection closed');
      } catch (e: any) {
        logger.error({ error: e.message }, 'Error closing database');
      }

      logger.info('Shutdown complete');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.fatal('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer();
