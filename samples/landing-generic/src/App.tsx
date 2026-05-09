const features = [
  'Instant deploys',
  'Usage snapshots',
  'Team approvals',
  'Audit trails',
  'Branch previews',
  'Budget alerts',
];

const plans = ['Starter', 'Team', 'Scale'];

export function App() {
  return (
    <main className="page">
      <nav className="nav">
        <strong>CloudPilot</strong>
        <a href="#features">Features</a>
        <a href="#pricing">Pricing</a>
        <button className="nav-action">Sign in</button>
      </nav>

      <section className="hero">
        <p className="eyebrow">Deploy faster</p>
        <h1>Hosting tools for teams shipping every week</h1>
        <p className="lede">
          A generic cloud landing page with intentional token, contrast, spacing, and hierarchy debt.
        </p>
        <div className="hero-actions">
          <button className="cta" data-cta>
            Start now
          </button>
          <button className="secondary">View demo</button>
        </div>
      </section>

      <section className="stats" aria-label="metrics">
        {['12k deploys', '98 teams', '4 regions', '9 checks'].map((stat) => (
          <article key={stat} className="stat-card">
            <span>{stat}</span>
            <small>last 30 days</small>
          </article>
        ))}
      </section>

      <section className="cards" id="features">
        {features.map((label, index) => (
          <article key={label} className={`feature-card feature-card-${index + 1}`}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <h2>{label}</h2>
            <p>Operational copy that should be tighter, clearer, and more visually grouped.</p>
          </article>
        ))}
      </section>

      <section className="pricing" id="pricing">
        {plans.map((plan) => (
          <article key={plan} className="price-card">
            <h2>{plan}</h2>
            <p>$49</p>
            <button className="secondary">Choose {plan}</button>
          </article>
        ))}
      </section>
    </main>
  );
}
