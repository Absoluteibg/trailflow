import { Activity, Plus } from 'lucide-react';
import { AppPage } from '../types';

interface TopBarProps {
  page: AppPage;
  onNewSession: () => void;
}

const pageTitle: Record<AppPage, string> = {
  overview: 'Command Overview',
  sessions: 'Session Manager',
  conversation: 'Conversation Studio',
  knowledge: 'Knowledge & Tools',
  settings: 'Client Settings',
};

export function TopBar({ page, onNewSession }: TopBarProps) {
  return (
    <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-black/25 backdrop-blur-md">
      <div>
        <h1 className="text-lg font-semibold">{pageTitle[page]}</h1>
        <p className="text-xs text-white/55 tracking-wide">OpenClaw-inspired, modular Trailflow workspace</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2 text-xs text-white/70 border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 rounded-full">
          <Activity className="w-3 h-3 text-emerald-300" />
          System online
        </span>
        <button
          onClick={onNewSession}
          className="inline-flex items-center gap-2 text-sm rounded-lg border border-white/20 px-3 py-2 hover:bg-white/10 transition"
        >
          <Plus className="w-4 h-4" />
          New Session
        </button>
      </div>
    </header>
  );
}
