import { Bot, Gauge, Layers, MessageSquare, Settings } from 'lucide-react';
import { ComponentType } from 'react';
import { AppPage } from '../types';

interface SidebarNavProps {
  activePage: AppPage;
  onChange: (page: AppPage) => void;
}

const items: { id: AppPage; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'sessions', label: 'Sessions', icon: Layers },
  { id: 'conversation', label: 'Conversation', icon: MessageSquare },
  { id: 'knowledge', label: 'Knowledge', icon: Bot },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function SidebarNav({ activePage, onChange }: SidebarNavProps) {
  return (
    <aside className="w-64 border-r border-white/10 bg-black/20 backdrop-blur-xl p-5 hidden md:block">
      <div className="text-xs uppercase tracking-[0.35em] text-white/55 mb-8">Trailflow Suite</div>
      <nav className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`w-full text-left rounded-xl px-3 py-3 flex items-center gap-3 transition ${
                active ? 'bg-white/10 text-white border border-white/15' : 'text-white/70 hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
