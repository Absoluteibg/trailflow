interface OverviewPageProps {
  stats: {
    totalSessions: number;
    totalMessages: number;
    tasksCompleted: number;
    tasksFailed: number;
    activeSession: string;
  };
}

export function OverviewPage({ stats }: OverviewPageProps) {
  const cards = [
    { label: 'Active Session', value: stats.activeSession },
    { label: 'Total Sessions', value: String(stats.totalSessions) },
    { label: 'Total Messages', value: String(stats.totalMessages) },
    { label: 'Tasks Completed', value: String(stats.tasksCompleted) },
    { label: 'Tasks Failed', value: String(stats.tasksFailed) },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900/80 to-black/70 p-8">
        <h2 className="text-3xl font-semibold mb-2">Mission Control</h2>
        <p className="text-white/65 max-w-3xl">
          Manage sessions, monitor runtime behavior, and jump into a premium conversation workspace designed for focused
          work with your coding agent.
        </p>
      </section>

      <section className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/50">{card.label}</div>
            <div className="mt-2 text-xl font-semibold truncate">{card.value}</div>
          </article>
        ))}
      </section>
    </div>
  );
}
