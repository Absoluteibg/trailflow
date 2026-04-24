import express from 'express';
import rateLimit from 'express-rate-limit';
import { AgentRuntime } from '../agent/runtime';
import { getDb } from '../db';
import { logger } from '../logger';
import { config } from '../config';

const router = express.Router();
const agent = new AgentRuntime();

// Rate limiting: 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limit for chat endpoint: 20 requests per minute
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many chat requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(limiter);

// API Key authentication middleware
function authenticateApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  const apiKey = req.headers['x-api-key'] || req.query['api_key'];

  // If API_KEY is set in config, require valid key
  const requiredKey = process.env.API_KEY;
  if (requiredKey) {
    if (!apiKey || apiKey !== requiredKey) {
      return res.status(401).json({ error: 'Invalid or missing API key' });
    }
  }

  next();
}

// Apply auth to all routes except health
router.use((req, res, next) => {
  if (req.path === '/health') {
    return next();
  }
  authenticateApiKey(req, res, next);
});

router.get('/health', async (req, res) => {
  res.json({ status: 'ok', service: 'Trailflow' });
});

router.get('/sessions', async (req, res) => {
  const db = await getDb();
  const sessions = await db.all('SELECT * FROM sessions ORDER BY last_active DESC');
  res.json(sessions);
});

router.get('/sessions/:id/messages', async (req, res) => {
  const db = await getDb();
  const messages = await db.all('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC', [req.params.id]);
  res.json(messages);
});

router.post('/chat', chatLimiter, async (req, res) => {
  const { sessionId, message, usePlan } = req.body;

  // Validate required fields
  if (!sessionId || !message) {
    return res.status(400).json({ error: 'Missing sessionId or message' });
  }

  // Sanitize input: trim whitespace, limit length
  const sanitizedMessage = String(message).trim().slice(0, 10000);
  const sanitizedSessionId = String(sessionId).trim().slice(0, 256);

  // Reject empty or suspicious input
  if (!sanitizedMessage || sanitizedMessage.length < 2) {
    return res.status(400).json({ error: 'Message too short' });
  }

  const db = await getDb();
  await db.run('INSERT OR IGNORE INTO sessions (id) VALUES (?)', [sessionId]);
  await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [sessionId, 'user', message]);

  try {
    // Use plan mode for complex tasks
    const result = usePlan
      ? await agent.runWithPlan(sessionId, sanitizedMessage)
      : await agent.runTask(sessionId, sanitizedMessage);
    res.json({ result });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Web chat failed');
    res.status(500).json({ error: error.message });
  }
});

router.get('/plans/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const plan = await agent.getPlan(sessionId);
  res.json(plan);
});

export default router;
