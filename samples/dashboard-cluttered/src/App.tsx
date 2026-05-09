const metrics = [
  ['Revenue', '$84.2k', 'up 4%'],
  ['Churn', '8.7%', 'needs review'],
  ['Latency', '410ms', 'p95'],
  ['Incidents', '12', 'open'],
  ['Tickets', '184', 'triage'],
  ['Usage', '73%', 'capacity'],
  ['NPS', '31', 'flat'],
  ['Deploys', '28', 'weekly'],
];

const queues = ['Billing escalations', 'Trial conversions', 'Enterprise renewals', 'Migration backlog'];

export function App() {
  return (
    <main className="dashboard">
      <nav className="topbar">
        <strong>MetricsGrid</strong>
        <button>Export</button>
        <button>Share</button>
        <button>Refresh</button>
      </nav>

      <section className="hero">
        <h1>Operations dashboard</h1>
        <p>Too many cards, uneven spacing, weak hierarchy, and low-contrast status badges by design.</p>
      </section>

      <section className="grid">
        {metrics.map(([label, value, meta], index) => (
          <article key={label} className={`card card-${index + 1}`}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{meta}</small>
          </article>
        ))}
      </section>

      <section className="workbench">
        <article className="table-panel">
          <h2>Queue health</h2>
          {queues.map((queue, index) => (
            <div key={queue} className="row">
              <span>{queue}</span>
              <b>{index * 7 + 11}</b>
              <button>Open</button>
            </div>
          ))}
        </article>
        <article className="notes-panel">
          <h2>Analyst notes</h2>
          <p>Every note blends into the panel because the spacing and contrast are under-specified.</p>
          <ul>
            <li>Renewal risk rising in segment B</li>
            <li>Incident tags are inconsistent</li>
            <li>Usage card needs a threshold token</li>
            <li>Buttons compete with metrics</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
