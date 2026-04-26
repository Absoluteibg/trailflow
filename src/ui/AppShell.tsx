import { SidebarNav } from './components/SidebarNav';
import { TopBar } from './components/TopBar';
import { SettingsPanel } from './components/SettingsPanel';
import { useTrailflowData } from './hooks/useTrailflowData';
import { ConversationPage } from './pages/ConversationPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { OverviewPage } from './pages/OverviewPage';
import { SessionsPage } from './pages/SessionsPage';
import { AppPage } from './types';
import { useMemo, useState } from 'react';

export function AppShell() {
  const [activePage, setActivePage] = useState<AppPage>('overview');
  const {
    sessions,
    activeSession,
    setActiveSession,
    messages,
    loading,
    error,
    settings,
    setSettings,
    stats,
    createSession,
    sendUserMessage,
  } = useTrailflowData();

  const page = useMemo(() => {
    if (activePage === 'overview') {
      return <OverviewPage stats={stats} />;
    }
    if (activePage === 'sessions') {
      return <SessionsPage sessions={sessions} activeSession={activeSession} onSelect={setActiveSession} />;
    }
    if (activePage === 'conversation') {
      return <ConversationPage messages={messages} loading={loading} onSend={sendUserMessage} settings={settings} />;
    }
    if (activePage === 'knowledge') {
      return <KnowledgePage />;
    }
    return <SettingsPanel settings={settings} onChange={setSettings} />;
  }, [activePage, activeSession, loading, messages, sendUserMessage, sessions, setActiveSession, setSettings, settings, stats]);

  return (
    <div className="h-screen w-screen bg-[radial-gradient(circle_at_top_right,_#24304f_0%,_#0c0d13_35%,_#08090d_100%)] text-white overflow-hidden">
      <div className="h-full grid md:grid-cols-[256px_1fr]">
        <SidebarNav activePage={activePage} onChange={setActivePage} />
        <div className="grid grid-rows-[64px_1fr_40px]">
          <TopBar page={activePage} onNewSession={createSession} />
          <main className="overflow-auto p-4 md:p-6">{page}</main>
          <footer className="border-t border-white/10 px-6 text-xs text-white/55 flex items-center justify-between">
            <span>Trailflow UI modules: `src/ui/*`</span>
            <span>{error ? `Warning: ${error}` : 'Secure local runtime active'}</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
