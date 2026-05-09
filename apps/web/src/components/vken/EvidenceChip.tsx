export function EvidenceChip({ ids }: { ids?: string[] }) {
  const count = ids?.length ?? 0;
  return (
    <span
      title={count ? ids!.join(', ') : 'No KB evidence yet'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 24,
        padding: '0 8px',
        borderRadius: 999,
        background: count ? '#ecfdf3' : '#f2f4f7',
        color: count ? '#027a48' : '#667085',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      evidence: {count}
    </span>
  );
}
