export interface RunResult {
  lastID?: number;
  changes?: number;
}

export interface DbAdapter {
  init(): Promise<void>;
  run(sql: string, params?: any[]): Promise<RunResult>;
  get<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
  all<T = any>(sql: string, params?: any[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}
