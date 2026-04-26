export type AppPage = 'overview' | 'sessions' | 'conversation' | 'knowledge' | 'settings';

export interface Message {
  id: number;
  role: string;
  content: string;
  created_at: string;
}

export interface Session {
  id: string;
  created_at: string;
  last_active: string;
}

export interface UiSettings {
  accentColor: string;
  compactMode: boolean;
  animations: boolean;
  showTimestamps: boolean;
  usePlanMode: boolean;
}
