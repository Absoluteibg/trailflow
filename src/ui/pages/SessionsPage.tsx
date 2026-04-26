import { Session } from '../types';

interface SessionsPageProps {
  sessions: Session[];
  activeSession: string | null;
  onSelect: (id: string) => void;
}

export function SessionsPage({ sessions, activeSession, onSelect }: SessionsPageProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-5">
      <h2 className="text-sm uppercase tracking-[0.2em] text-white/60 mb-4">Session History</h2>
      <div className="space-y-2 max-h-[65vh] overflow-auto pr-1">
        {sessions.map((session) => {
          const active = session.id === activeSession;
          return (
            <button
              key={session.id}
              onClick={() => onSelect(session.id)}
              className={`w-full text-left p-3 rounded-lg border transition ${
                active ? 'border-white/40 bg-white/10' : 'border-white/10 hover:border-white/25 bg-white/5'
              }`}
            >
              <div className="font-medium text-sm truncate">{session.id}</div>
              <div className="text-xs text-white/55 mt-1">
                Last active: {new Date(session.last_active).toLocaleString()}
              </div>
            </button>
          );
        })}
        {sessions.length === 0 && <p className="text-sm text-white/55">No sessions available yet.</p>}
      </div>
    </div>
  );
}
