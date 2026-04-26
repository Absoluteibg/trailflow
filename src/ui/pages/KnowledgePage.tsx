const items = [
  { title: 'Tooling', desc: 'File, shell, git, memory, planner, and multi-file edit tools are available.' },
  { title: 'Monitoring', desc: 'Metrics exposed via /api/metrics and /api/metrics/prometheus for observability.' },
  { title: 'Persistence', desc: 'SQLite default path with PostgreSQL migration support through adapter-based wiring.' },
  { title: 'Deployment', desc: 'Compose production stack, Kubernetes manifests, and Helm chart are included.' },
];

export function KnowledgePage() {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-white/10 bg-black/20 p-6">
        <h2 className="text-xl font-semibold mb-2">Knowledge Center</h2>
        <p className="text-sm text-white/65">
          Quick overview of platform capabilities and infrastructure modules. This page can be extended with docs links,
          changelogs, and runbooks.
        </p>
      </section>
      <section className="grid md:grid-cols-2 gap-4">
        {items.map((item) => (
          <article key={item.title} className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-base font-semibold">{item.title}</h3>
            <p className="text-sm text-white/65 mt-1">{item.desc}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
