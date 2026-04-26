import { config } from './config';
import { logger } from './logger';
import { DbAdapter } from './persistence/types';
import { SqliteAdapter } from './persistence/sqlite/adapter';
import { PostgresAdapter } from './persistence/postgres/adapter';

let db: DbAdapter | null = null;

export async function getDb() {
  if (db) return db;
  if (config.DB_PROVIDER === 'postgres') {
    if (!config.DATABASE_URL) {
      throw new Error('DATABASE_URL is required when DB_PROVIDER=postgres');
    }
    db = new PostgresAdapter(config.DATABASE_URL);
    logger.info('Using PostgreSQL persistence adapter');
  } else {
    db = new SqliteAdapter();
    logger.info('Using SQLite persistence adapter');
  }

  await db.init();

  if (config.DB_PROVIDER === 'sqlite') {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        role TEXT,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        parent_task_id INTEGER,
        description TEXT,
        status TEXT DEFAULT 'pending',
        result TEXT,
        plan_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(session_id) REFERENCES sessions(id),
        FOREIGN KEY(parent_task_id) REFERENCES tasks(id)
      );

      CREATE TABLE IF NOT EXISTS plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        objective TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
      );
    `);
  }

  return db;
}
