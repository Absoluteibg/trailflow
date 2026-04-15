import { Telegraf } from 'telegraf';
import { config } from '../config';
import { AgentRuntime } from '../agent/runtime';
import { getDb } from '../db';
import { logger } from '../logger';

export async function setupTelegram() {
  if (!config.TELEGRAM_BOT_TOKEN) {
    logger.warn('TELEGRAM_BOT_TOKEN not set, skipping Telegram setup');
    return;
  }

  const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);
  const agent = new AgentRuntime();

  bot.start(async (ctx) => {
    const userId = ctx.from.id.toString();
    if (config.ALLOWED_TELEGRAM_USER_IDS.length > 0 && !config.ALLOWED_TELEGRAM_USER_IDS.includes(userId)) {
      return ctx.reply('Unauthorized.');
    }
    ctx.reply('Welcome to Trailflow. Send me a coding task to begin.');
  });

  bot.on('text', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (config.ALLOWED_TELEGRAM_USER_IDS.length > 0 && !config.ALLOWED_TELEGRAM_USER_IDS.includes(userId)) {
      return;
    }

    const sessionId = `telegram_${userId}`;
    const task = ctx.message.text;

    const db = await getDb();
    await db.run('INSERT OR IGNORE INTO sessions (id) VALUES (?)', [sessionId]);
    await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [sessionId, 'user', task]);

    ctx.reply('Task received. Working on it...');

    try {
      const result = await agent.runTask(sessionId, task);
      ctx.reply(`Task Complete:\n\n${result}`);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Telegram task failed');
      ctx.reply(`Error: ${error.message}`);
    }
  });

  bot.launch();
  logger.info('Telegram bot launched');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
