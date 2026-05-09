import type { VkenApplyPayload, VkenSseEvent } from '@open-design/contracts';
import { vkenFetch } from '../../providers/registry';

export function Timeline({
  runId,
  events,
  activeCheckpoint,
}: {
  runId: string | null;
  events: VkenSseEvent[];
  activeCheckpoint: string;
}) {
  async function scrub(checkpoint: 'initial' | { patchId: string }) {
    if (!runId) return;
    await vkenFetch(`/api/vken/runs/${encodeURIComponent(runId)}/scrub`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkpoint }),
    });
  }

  const applied = events
    .filter((event) => event.event === 'vken:apply' && event.data.ok)
    .map((event) => event.data as VkenApplyPayload);
  return (
    <section>
      <h2 style={{ marginTop: 0 }}>Timeline</h2>
      <button type="button" onClick={() => scrub('initial')} style={checkpointStyle(activeCheckpoint === 'initial')}>
        Initial
      </button>
      {applied.map((event) => (
        <button
          key={event.patchId}
          type="button"
          onClick={() => scrub({ patchId: event.patchId })}
          style={checkpointStyle(activeCheckpoint === event.patchId)}
        >
          {event.patchId.slice(0, 10)}
        </button>
      ))}
      <ol style={{ paddingLeft: 18 }}>
        {events.slice(-12).map((event, index) => (
          <li key={index} style={{ marginBottom: 8 }}>
            <code>{event.event}</code>
          </li>
        ))}
      </ol>
    </section>
  );
}

function checkpointStyle(active: boolean) {
  return {
    minHeight: 30,
    margin: '0 6px 8px 0',
    borderRadius: 8,
    border: active ? '1px solid #111827' : '1px solid #d0d5dd',
    background: active ? '#111827' : 'white',
    color: active ? 'white' : '#344054',
  };
}
