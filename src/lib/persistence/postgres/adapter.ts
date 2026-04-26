import { Pool } from 'pg';
import { DbAdapter, RunResult } from '../types';

function convertPlaceholders(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => {
    i += 1;
    return `$${i}`;
  });
}

function rewriteSql(sql: string): string {
  const trimmed = sql.trim();
  if (trimmed.startsWith('INSERT OR IGNORE INTO sessions')) {
    return 'INSERT INTO sessions (id) VALUES ($1) ON CONFLICT DO NOTHING';
  }
  if (trimmed.startsWith('INSERT OR REPLACE INTO sessions')) {
    return 'INSERT INTO sessions (id, created_at, last_active) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET created_at = EXCLUDED.created_at, last_active = EXCLUDED.last_active';
  }
  if (trimmed.startsWith('INSERT OR IGNORE INTO messages')) {
    return 'INSERT INTO messages (id, session_id, role, content, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING';
  }
  if (trimmed.startsWith('INSERT OR IGNORE INTO tasks')) {
    return 'INSERT INTO tasks (id, session_id, description, status, plan_order, result, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING';
  }
  return convertPlaceholders(sql);
}

export class PostgresAdapter implements DbAdapter {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async init(): Promise<void> {
    await this.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id BIGSERIAL PRIMARY KEY,
        session_id TEXT REFERENCES sessions(id),
        role TEXT,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id BIGSERIAL PRIMARY KEY,
        session_id TEXT REFERENCES sessions(id),
        parent_task_id BIGINT REFERENCES tasks(id),
        description TEXT,
        status TEXT DEFAULT 'pending',
        result TEXT,
        plan_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS plans (
        id BIGSERIAL PRIMARY KEY,
        session_id TEXT REFERENCES sessions(id),
        objective TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );
    `);
  }

  async run(sql: string, params: any[] = []): Promise<RunResult> {
    const rewritten = rewriteSql(sql);
    const result = await this.pool.query(rewritten, params);
    const firstRow = result.rows[0] as any;
    return {
      changes: result.rowCount ?? 0,
      lastID: firstRow?.id,
    };
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    const rewritten = rewriteSql(sql);
    const result = await this.pool.query(rewritten, params);
    return result.rows[0] as T | undefined;
  }

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const rewritten = rewriteSql(sql);
    const result = await this.pool.query(rewritten, params);
    return result.rows as T[];
  }

  async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
