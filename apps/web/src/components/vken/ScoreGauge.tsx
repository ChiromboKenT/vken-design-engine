export function ScoreGauge({ value }: { value: number | null }) {
  const percent = Math.max(0, Math.min(100, Math.round((value ?? 0) * 10)));
  return (
    <div
      style={{
        width: 132,
        height: 132,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        background: `conic-gradient(#2563eb ${percent}%, #e5e7eb 0)`,
      }}
      aria-label={`VKEN score ${value ?? 0}`}
    >
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: 'var(--color-bg, #fff)',
          display: 'grid',
          placeItems: 'center',
          fontSize: 28,
          fontWeight: 700,
        }}
      >
        {value == null ? '--' : value.toFixed(1)}
      </div>
    </div>
  );
}

