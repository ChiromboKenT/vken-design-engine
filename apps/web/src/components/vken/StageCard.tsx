import type { ReactNode } from 'react';
import { Icon } from '../Icon';

export type VkenStageState = 'done' | 'active' | 'queued' | 'failed';

export function StageCard({
  id,
  title,
  eyebrow,
  summary,
  state,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  eyebrow: string;
  summary: string;
  state: VkenStageState;
  expanded: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}) {
  const icon = state === 'done' ? 'check' : state === 'active' ? 'spinner' : state === 'failed' ? 'bell' : 'minus';
  return (
    <article className={`vken-stage-card ${state}${expanded ? ' expanded' : ' collapsed'}`}>
      <button
        type="button"
        className="vken-stage-toggle"
        onClick={() => onToggle(id)}
        aria-expanded={expanded}
      >
        <span className="vken-stage-icon" aria-hidden>
          <Icon name={icon} size={15} />
        </span>
        <span className="vken-stage-copy">
          <span className="vken-stage-eyebrow">{eyebrow}</span>
          <span className="vken-stage-title">{title}</span>
        </span>
        <span className="vken-stage-summary">{summary}</span>
        <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={14} />
      </button>
      {expanded ? <div className="vken-stage-body">{children}</div> : null}
    </article>
  );
}
