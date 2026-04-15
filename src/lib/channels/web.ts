import express from 'express';
import { AgentRuntime } from '../agent/runtime';
import { getDb } from '../db';
import { logger } from '../logger';

const router = express.Router();
const agent = new AgentRuntime();

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

router.post('/chat', async (req, res) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !message) {
    return res.status(400).json({ error: 'Missing sessionId or message' });
  }

  const db = await getDb();
  await db.run('INSERT OR IGNORE INTO sessions (id) VALUES (?)', [sessionId]);
  await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [sessionId, 'user', message]);

  try {
    const result = await agent.runTask(sessionId, message);
    res.json({ result });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Web chat failed');
    res.status(500).json({ error: error.message });
  }
});

export default router;
