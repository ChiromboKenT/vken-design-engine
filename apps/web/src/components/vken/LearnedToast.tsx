import { useEffect, useState } from 'react';
import type { VkenLearnPayload } from '@open-design/contracts';

export function LearnedToast({ learns }: { learns: VkenLearnPayload[] }) {
  const latest = learns.filter((learn) => learn.ruleId).at(-1) ?? null;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!latest) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 6000);
    return () => window.clearTimeout(timer);
  }, [latest]);

  if (!latest || !visible) return null;
  return (
    <aside style={toastStyle}>
      <strong>Learned rule</strong>
      <p style={{ margin: '4px 0 0' }}>{latest.ruleText}</p>
    </aside>
  );
}

const toastStyle = {
  position: 'fixed' as const,
  right: 20,
  bottom: 20,
  maxWidth: 360,
  background: '#111827',
  color: 'white',
  padding: 16,
  borderRadius: 8,
  boxShadow: '0 16px 40px rgba(15, 23, 42, 0.24)',
  zIndex: 20,
};
