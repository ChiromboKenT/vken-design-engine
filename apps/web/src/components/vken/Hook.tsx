import { useEffect, useState } from 'react';

const climb = [3.8, 4.1, 4.9, 5.6, 6.4, 7.2];

export function Hook({
  starting,
  onStartSample,
}: {
  starting: boolean;
  onStartSample: () => void;
}) {
  const [score, setScore] = useState(climb[0]!);

  useEffect(() => {
    let index = 0;
    const timer = window.setInterval(() => {
      index = (index + 1) % climb.length;
      setScore(climb[index]!);
    }, 900);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28 }}>VKEN Design Engine</h1>
        <p style={{ margin: '6px 0 0', color: '#64748b' }}>
          Neuroinclusive AI design repair that critiques, proposes, applies, validates, learns, and opens a reviewable output.
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <strong style={{ fontSize: 24 }}>{score.toFixed(1)}</strong>
        <button
          type="button"
          onClick={onStartSample}
          disabled={starting}
          style={{
            minHeight: 40,
            padding: '0 16px',
            borderRadius: 8,
            border: 0,
            background: '#111827',
            color: 'white',
          }}
        >
          {starting ? 'Starting...' : 'Try landing-generic'}
        </button>
      </div>
    </header>
  );
}
