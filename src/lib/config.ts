import { z } from 'zod';
import path from 'path';
import fs from 'fs';

const ConfigSchema = z.object({
  GEMINI_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('gemma4:e4b'),
  APP_URL: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  WORKSPACE_DIR: z.string().default('./workspace'),
  ALLOWED_TELEGRAM_USER_IDS: z.string().default('').transform(s => s ? s.split(',').map(id => id.trim()) : []),
  LOG_LEVEL: z.string().default('info').transform(s => ['info', 'debug', 'error'].includes(s) ? s : 'info'),
  // API key for web route authentication (optional — skip auth if not set)
  API_KEY: z.string().optional(),
  // Max wall-clock time for a single agent task (ms). Default: 5 minutes.
  AGENT_TIMEOUT_MS: z.coerce.number().default(300_000),
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const config = ConfigSchema.parse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
    OLLAMA_MODEL: process.env.OLLAMA_MODEL,
    APP_URL: process.env.APP_URL,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    WORKSPACE_DIR: process.env.WORKSPACE_DIR,
    ALLOWED_TELEGRAM_USER_IDS: process.env.ALLOWED_TELEGRAM_USER_IDS,
    LOG_LEVEL: process.env.LOG_LEVEL,
    API_KEY: process.env.API_KEY,
    AGENT_TIMEOUT_MS: process.env.AGENT_TIMEOUT_MS,
  });

  // Ensure workspace exists
  const workspacePath = path.resolve(process.cwd(), config.WORKSPACE_DIR);
  if (!fs.existsSync(workspacePath)) {
    fs.mkdirSync(workspacePath, { recursive: true });
  }

  return config;
}

export const config = loadConfig();
