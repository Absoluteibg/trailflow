import express from 'express';
import rateLimit from 'express-rate-limit';
import { AgentRuntime, getMetrics } from '../agent/runtime';
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
  if (config.API_KEY) {
    if (!apiKey || apiKey !== config.API_KEY) {
      return res.status(401).json({ error: 'Invalid or missing API key' });
    }
  }

  next()
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

router.get('/metrics', async (req, res) => {
  res.json(getMetrics());
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

// Export a full session (session metadata + all messages + plan steps) as JSON
router.get('/sessions/:id/export', async (req, res) => {
  const { id } = req.params;
  const db = await getDb();

  const session = await db.get('SELECT * FROM sessions WHERE id = ?', [id]);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const messages = await db.all(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC',
    [id]
  );
  const plan = await db.all(
    'SELECT * FROM tasks WHERE session_id = ? ORDER BY plan_order ASC',
    [id]
  );

  res.setHeader('Content-Disposition', `attachment; filename="session-${id}.json"`);
  res.json({ exportedAt: new Date().toISOString(), session, messages, plan });
});

// Import a session from a previously exported JSON payload
router.post('/sessions/import', async (req, res) => {
  const { session, messages, plan } = req.body;

  if (!session?.id || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid import payload: must contain session.id and messages[]' });
  }

  const db = await getDb();

  // Upsert session
  await db.run(
    'INSERT OR REPLACE INTO sessions (id, created_at, last_active) VALUES (?, ?, ?)',
    [session.id, session.created_at ?? new Date().toISOString(), new Date().toISOString()]
  );

  // Replay messages (skip duplicates by id)
  for (const msg of messages) {
    await db.run(
      'INSERT OR IGNORE INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
      [msg.id, session.id, msg.role, msg.content, msg.created_at]
    );
  }

  // Replay plan steps if present
  if (Array.isArray(plan)) {
    for (const step of plan) {
      await db.run(
        'INSERT OR IGNORE INTO tasks (id, session_id, description, status, plan_order, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [step.id, session.id, step.description, step.status, step.plan_order, step.result, step.created_at]
      );
    }
  }

  logger.info({ sessionId: session.id, messages: messages.length }, 'Session imported');
  res.json({ ok: true, sessionId: session.id, messagesImported: messages.length });
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
  await db.run('INSERT OR IGNORE INTO sessions (id) VALUES (?)', [sanitizedSessionId]);
  await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [sanitizedSessionId, 'user', sanitizedMessage]);

  try {
    // Use plan mode for complex tasks
    const result = usePlan
      ? await agent.runWithPlan(sanitizedSessionId, sanitizedMessage)
      : await agent.runTask(sanitizedSessionId, sanitizedMessage);
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
