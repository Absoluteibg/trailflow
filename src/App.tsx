import { useState, useEffect, useRef } from 'react';
import { Terminal, Send, Activity, Database, MessageSquare, Code, ChevronRight, User, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: number;
  role: string;
  content: string;
  created_at: string;
}

interface Session {
  id: string;
  created_at: string;
  last_active: string;
}

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (activeSession) {
      fetchMessages(activeSession);
    }
  }, [activeSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      setSessions(data);
      if (data.length > 0 && !activeSession) {
        setActiveSession(data[0].id);
      }
    } catch (e) {
      console.error('Failed to fetch sessions', e);
    }
  };

  const fetchMessages = async (id: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}/messages`);
      const data = await res.json();
      setMessages(data);
    } catch (e) {
      console.error('Failed to fetch messages', e);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const sessionId = activeSession || `web_${Date.now()}`;
    if (!activeSession) setActiveSession(sessionId);

    setLoading(true);
    const userMsg = input;
    setInput('');

    // Optimistic update
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: userMsg, created_at: new Date().toISOString() }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: userMsg }),
      });
      const data = await res.json();
      fetchMessages(sessionId);
      fetchSessions();
    } catch (e) {
      console.error('Failed to send message', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-[80px_1fr_340px] grid-rows-[80px_1fr_80px] h-screen w-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden">
      {/* Sidebar Left */}
      <div className="row-span-3 border-r border-[var(--line)] flex flex-col items-center justify-center gap-12">
        <div className="vertical-text">ESTABLISHED MMXXVI</div>
        <div className="vertical-text">TRAILFLOW NO. 01</div>
      </div>

      {/* Header */}
      <header className="col-span-2 border-b border-[var(--line)] flex items-center justify-between px-10">
        <div className="flex gap-10">
          <span className={`nav-item ${activeSession ? 'active' : ''}`}>Identity</span>
          <span className="nav-item">Engine</span>
          <span className="nav-item">Legacy</span>
        </div>
        <div className="nav-item flex items-center gap-2">
          <Activity className="w-3 h-3 text-[var(--accent)]" />
          SYSTEM STATUS / [ONLINE]
        </div>
      </header>

      {/* Main Content (Chat) */}
      <main className="relative flex flex-col overflow-hidden border-r border-[var(--line)]">
        <div className="p-10 pb-0">
          <h1 className="hero-title">
            The<br />Greatest<br /><span className="accent-text">Programmer</span>
          </h1>
        </div>

        <div className="terminal-deco">
          <div className="terminal-header">
            <div className="dot"></div>
            <div className="dot"></div>
            <div className="dot"></div>
          </div>
          &gt; INITIALIZING TRAILFLOW_KERNEL...<br />
          &gt; COMPILING AGENT_LOGIC.TS<br />
          &gt; OPTIMIZING NEURAL_PATHWAYS...<br />
          &gt; SYSTEM STATUS: PEAK_PERFORMANCE<br />
          &gt; _
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-8 z-10">
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div 
                key={m.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex gap-6 ${m.role === 'user' ? 'justify-end' : ''}`}
              >
                <div className={`max-w-[85%] ${m.role === 'user' ? 'text-right' : ''}`}>
                  <div className="chat-bubble">
                    {m.content.startsWith('Observation:') ? (
                      <div className="terminal-box whitespace-pre-wrap">
                        {m.content}
                      </div>
                    ) : (
                      <div className="text-sm leading-relaxed whitespace-pre-wrap font-medium">
                        {m.content}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] mt-2 uppercase tracking-widest opacity-40 font-bold">
                    {m.role === 'user' ? 'Human' : 'Architect'} / {new Date(m.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && (
            <div className="flex gap-6">
              <div className="chat-bubble italic text-xs opacity-50 border-dashed">
                Architect is architecting...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-10 pt-0 z-10">
          <div className="relative">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="ENTER COMMAND..."
              className="w-full p-6 bg-transparent border border-[var(--line)] text-sm tracking-widest focus:outline-none focus:border-[var(--accent)] transition-colors uppercase font-bold"
            />
            <button 
              onClick={handleSend}
              disabled={loading}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-[var(--accent)] hover:scale-110 transition-transform"
            >
              <Send className={`w-5 h-5 ${loading ? 'opacity-20' : ''}`} />
            </button>
          </div>
        </div>
      </main>

      {/* Sidebar Right (Stats & Sessions) */}
      <aside className="p-10 flex flex-col gap-10 overflow-hidden">
        <div className="stat-block">
          <span className="stat-label">Tasks Completed</span>
          <span className="stat-value text-[var(--accent)]">{messages.filter(m => m.content.includes('Final Answer:')).length}</span>
        </div>
        <div className="stat-block">
          <span className="stat-label">Active Session</span>
          <span className="text-xs font-mono truncate opacity-60">{activeSession || 'NONE'}</span>
        </div>
        
        <div className="flex-1 overflow-y-auto mt-4">
          <span className="stat-label mb-4 block">Session History</span>
          <div className="space-y-2">
            {sessions.map(s => (
              <div 
                key={s.id} 
                onClick={() => setActiveSession(s.id)}
                className={`p-3 border border-[var(--line)] cursor-pointer transition-colors ${activeSession === s.id ? 'bg-[var(--accent)] text-[var(--bg)]' : 'hover:border-[var(--accent)]'}`}
              >
                <div className="text-[10px] font-bold truncate">{s.id}</div>
              </div>
            ))}
          </div>
        </div>

        <div 
          onClick={() => {
            const id = `web_${Date.now()}`;
            setActiveSession(id);
            setMessages([]);
          }}
          className="mt-auto color-[var(--accent)] text-[var(--accent)] text-[11px] font-bold border border-[var(--accent)] p-4 text-center cursor-pointer hover:bg-[var(--accent)] hover:text-[var(--bg)] transition-colors tracking-widest"
        >
          NEW ARCHITECTURE
        </div>
      </aside>

      {/* Footer */}
      <footer className="col-span-2 border-t border-[var(--line)] flex items-center px-10 justify-between text-[10px] tracking-widest opacity-40 font-bold uppercase">
        <div>&copy; 2026 TRAILFLOW AGENT. ALL RIGHTS RESERVED.</div>
        <div className="flex gap-6">
          <span>ENCRYPTED CONNECTION [TLS 1.3]</span>
          <span>LATENCY: 42MS</span>
        </div>
      </footer>
    </div>
  );
}
