import { useEffect, useState, type FormEvent } from 'react';
import type { VkenSampleId } from '@open-design/contracts';
import hookStream from './hook-stream.json';

const climb: number[] = Array.isArray(hookStream.scores) && hookStream.scores.length >= 2
  ? hookStream.scores
  : [3.8, 4.1, 4.9, 5.6, 6.4, 7.2];
const intervalMs: number = typeof hookStream.intervalMs === 'number' ? hookStream.intervalMs : 900;
const samples: VkenSampleId[] = ['landing-generic', 'dashboard-cluttered', 'ecommerce-basic'];

export function Hook({
  starting,
  onStartSample,
  onStartUrl,
  error,
}: {
  starting: boolean;
  onStartSample: (sampleId: VkenSampleId) => void;
  onStartUrl: (url: string) => Promise<void>;
  error?: string;
}) {
  const [score, setScore] = useState(climb[0]!);
  const [url, setUrl] = useState('');

  useEffect(() => {
    let index = 0;
    const timer = window.setInterval(() => {
      index = (index + 1) % climb.length;
      setScore(climb[index]!);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, []);

  async function submitUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!url.trim()) return;
    await onStartUrl(url.trim());
  }

  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28 }}>VKEN Design Engine</h1>
        <p style={{ margin: '6px 0 0', color: '#64748b' }}>
          Neuroinclusive AI design repair that critiques, proposes, applies, validates, learns, and opens a reviewable output.
        </p>
      </div>
      <div style={{ display: 'grid', gap: 10, minWidth: 'min(100%, 520px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 24 }}>{score.toFixed(1)}</strong>
          {samples.map((sampleId) => (
            <button key={sampleId} type="button" onClick={() => onStartSample(sampleId)} disabled={starting} style={sampleButton}>
              {starting ? 'Starting...' : sampleId}
            </button>
          ))}
        </div>
        <form onSubmit={submitUrl} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://github.com/<user>/<vite-react-tailwind-repo>"
            aria-label="Public Vite React Tailwind repository URL"
            style={urlInput}
          />
          <button type="submit" disabled={starting || !url.trim()} style={primaryButton}>
            Run URL
          </button>
        </form>
        <small style={{ color: error ? '#b91c1c' : '#64748b', textAlign: 'right' }}>
          {error ?? 'Public repos only. Vite + React + Tailwind.'}
        </small>
      </div>
    </header>
  );
}

const sampleButton = {
  minHeight: 40,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid #d0d5dd',
  background: 'white',
  color: '#111827',
};

const primaryButton = {
  minHeight: 40,
  padding: '0 16px',
  borderRadius: 8,
  border: 0,
  background: '#111827',
  color: 'white',
};

const urlInput = {
  minHeight: 40,
  flex: '1 1 320px',
  border: '1px solid #d0d5dd',
  borderRadius: 8,
  padding: '0 12px',
};
