import { Send, Sparkles, User } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Message, UiSettings } from '../types';

interface ConversationPageProps {
  messages: Message[];
  loading: boolean;
  onSend: (value: string) => Promise<void>;
  settings: UiSettings;
}

export function ConversationPage({ messages, loading, onSend, settings }: ConversationPageProps) {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend() {
    const value = draft.trim();
    if (!value || loading) return;
    setDraft('');
    await onSend(value);
  }

  return (
    <div className="h-full grid grid-rows-[1fr_auto] gap-4">
      <section className="rounded-2xl border border-white/15 bg-gradient-to-b from-white/8 to-white/3 backdrop-blur-xl p-5 overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Premium Conversation Studio</h2>
          <span className="text-xs px-3 py-1 rounded-full border border-white/20 bg-black/20 text-white/70">
            High focus mode
          </span>
        </div>
        <div className="h-[58vh] overflow-auto space-y-3 pr-1">
          {messages.map((message) => {
            const user = message.role === 'user';
            return (
              <motion.div
                key={message.id}
                initial={settings.animations ? { opacity: 0, y: 8 } : false}
                animate={settings.animations ? { opacity: 1, y: 0 } : false}
                className={`flex ${user ? 'justify-end' : 'justify-start'}`}
              >
                <article
                  className={`max-w-[80%] rounded-2xl border p-4 ${
                    user
                      ? 'border-transparent text-black'
                      : 'border-white/15 bg-black/35 text-white'
                  }`}
                  style={user ? { backgroundColor: settings.accentColor } : undefined}
                >
                  <div className="flex items-center gap-2 mb-2 text-xs opacity-80">
                    {user ? <User className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                    {user ? 'You' : 'Trailflow Agent'}
                  </div>
                  <p className={`whitespace-pre-wrap ${settings.compactMode ? 'text-sm' : 'text-[15px] leading-7'}`}>
                    {message.content}
                  </p>
                  {settings.showTimestamps && (
                    <div className="text-[11px] mt-2 opacity-65">{new Date(message.created_at).toLocaleTimeString()}</div>
                  )}
                </article>
              </motion.div>
            );
          })}
          {loading && (
            <div className="inline-flex items-center gap-2 text-sm text-white/65 border border-white/15 rounded-xl px-3 py-2">
              <Sparkles className="w-4 h-4 animate-pulse" />
              Agent is thinking...
            </div>
          )}
          <div ref={endRef} />
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => (e.key === 'Enter' ? handleSend() : undefined)}
            placeholder="Ask Trailflow anything..."
            className="flex-1 rounded-lg border border-white/20 bg-black/25 px-4 py-3 text-sm outline-none focus:border-white/45"
          />
          <button
            onClick={handleSend}
            disabled={loading}
            className="rounded-lg px-4 text-black font-semibold disabled:opacity-50"
            style={{ backgroundColor: settings.accentColor }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
