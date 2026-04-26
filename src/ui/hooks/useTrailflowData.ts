import { useEffect, useMemo, useState } from 'react';
import { getMessages, getMetrics, getSessions, sendMessage } from '../api/client';
import { Message, Session, UiSettings } from '../types';

const SETTINGS_KEY = 'trailflow.ui.settings.v1';

const defaultSettings: UiSettings = {
  accentColor: '#6ee7ff',
  compactMode: false,
  animations: true,
  showTimestamps: true,
  usePlanMode: true,
};

export function useTrailflowData() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [metrics, setMetrics] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<UiSettings>(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaultSettings;
      return { ...defaultSettings, ...(JSON.parse(raw) as Partial<UiSettings>) };
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  async function refreshSessions() {
    const data = await getSessions();
    setSessions(data);
    if (!activeSession && data.length > 0) {
      setActiveSession(data[0].id);
    }
  }

  async function refreshMetrics() {
    const data = await getMetrics();
    setMetrics(data);
  }

  async function refreshMessages(sessionId: string) {
    const data = await getMessages(sessionId);
    setMessages(data);
  }

  useEffect(() => {
    refreshSessions().catch((e: unknown) => setError(String(e)));
    refreshMetrics().catch((e: unknown) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!activeSession) return;
    refreshMessages(activeSession).catch((e: unknown) => setError(String(e)));
  }, [activeSession]);

  async function createSession() {
    const sessionId = `web_${Date.now()}`;
    setActiveSession(sessionId);
    setMessages([]);
    return sessionId;
  }

  async function sendUserMessage(text: string) {
    const clean = text.trim();
    if (!clean || loading) return;
    const sessionId = activeSession ?? (await createSession());

    setLoading(true);
    setError(null);
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: 'user', content: clean, created_at: new Date().toISOString() },
    ]);

    try {
      await sendMessage({ sessionId, message: clean, usePlan: settings.usePlanMode });
      await Promise.all([refreshMessages(sessionId), refreshSessions(), refreshMetrics()]);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    return {
      totalSessions: sessions.length,
      activeSession: activeSession ?? 'none',
      totalMessages: messages.length,
      tasksCompleted: Number(metrics?.tasksCompleted ?? 0),
      tasksFailed: Number(metrics?.tasksFailed ?? 0),
    };
  }, [activeSession, messages.length, metrics, sessions.length]);

  return {
    sessions,
    activeSession,
    setActiveSession,
    messages,
    metrics,
    loading,
    error,
    settings,
    setSettings,
    stats,
    refreshSessions,
    refreshMessages,
    refreshMetrics,
    createSession,
    sendUserMessage,
  };
}
