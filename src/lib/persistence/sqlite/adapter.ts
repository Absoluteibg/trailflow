import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { DbAdapter, RunResult } from '../types';

export class SqliteAdapter implements DbAdapter {
  private db: Database | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = await open({
      filename: path.join(dataDir, 'trailflow.db'),
      driver: sqlite3.Database,
    });

    await this.db.exec('PRAGMA journal_mode = WAL;');
    await this.db.exec('PRAGMA foreign_keys = ON;');
  }

  async run(sql: string, params: any[] = []): Promise<RunResult> {
    if (!this.db) throw new Error('SQLite adapter not initialized');
    const result = await this.db.run(sql, params);
    return { lastID: result.lastID, changes: result.changes };
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    if (!this.db) throw new Error('SQLite adapter not initialized');
    return this.db.get<T>(sql, params);
  }

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) throw new Error('SQLite adapter not initialized');
    return this.db.all<T[]>(sql, params) as unknown as T[];
  }

  async exec(sql: string): Promise<void> {
    if (!this.db) throw new Error('SQLite adapter not initialized');
    await this.db.exec(sql);
  }

  async close(): Promise<void> {
    if (!this.db) return;
    await this.db.close();
    this.db = null;
  }
}
