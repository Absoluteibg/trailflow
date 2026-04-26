import { Message, Session } from '../types';

export async function getSessions(): Promise<Session[]> {
  const res = await fetch('/api/sessions');
  if (!res.ok) {
    throw new Error('Failed to fetch sessions');
  }
  return res.json();
}

export async function getMessages(sessionId: string): Promise<Message[]> {
  const res = await fetch(`/api/sessions/${sessionId}/messages`);
  if (!res.ok) {
    throw new Error('Failed to fetch messages');
  }
  return res.json();
}

export async function getMetrics(): Promise<Record<string, any>> {
  const res = await fetch('/api/metrics');
  if (!res.ok) {
    throw new Error('Failed to fetch metrics');
  }
  return res.json();
}

export async function sendMessage(input: {
  sessionId: string;
  message: string;
  usePlan: boolean;
}): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to send message');
  }
}
