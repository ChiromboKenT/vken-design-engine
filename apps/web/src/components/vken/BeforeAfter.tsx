import type { VkenCaptureSummary } from './useVkenSse';

export function BeforeAfter({
  captures,
  previewUrl,
}: {
  captures: VkenCaptureSummary[];
  previewUrl: string | null;
}) {
  const desktop = captures.find((capture) => capture.viewport === 'desktop') ?? captures[0];
  return (
    <section style={{ marginTop: 20 }}>
      <h2>Before / After</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        <figure style={{ margin: 0 }}>
          {desktop ? (
            <img
              src={desktop.screenshotUrl}
              alt={`${desktop.routePath} ${desktop.viewport} before`}
              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8 }}
            />
          ) : (
            <div style={emptyFrame}>Waiting for capture</div>
          )}
          <figcaption style={caption}>BEFORE</figcaption>
        </figure>
        <figure style={{ margin: 0 }}>
          {previewUrl ? (
            <iframe
              title="VKEN after preview"
              src={previewUrl}
              style={{ width: '100%', minHeight: 360, border: '1px solid #e5e7eb', borderRadius: 8, background: 'white' }}
            />
          ) : (
            <div style={emptyFrame}>Approve a patch to generate the after preview</div>
          )}
          <figcaption style={caption}>AFTER</figcaption>
        </figure>
      </div>
    </section>
  );
}

const caption = { fontSize: 12, color: '#64748b', marginTop: 6, fontWeight: 700 };
const emptyFrame = {
  minHeight: 260,
  display: 'grid',
  placeItems: 'center',
  border: '1px dashed #cbd5e1',
  borderRadius: 8,
  color: '#64748b',
};
