import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n';
import type { Conversation } from '../types';

export type ConversationMenuKind = 'chat' | 'vken';
export type ConversationMenuItem = Conversation & { kind?: ConversationMenuKind };

interface Props {
  conversations: ConversationMenuItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  readOnly?: boolean;
  heading?: string;
  newLabel?: string;
}

export function ConversationsMenu({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  readOnly = false,
  heading,
  newLabel,
}: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const pillRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (pillRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <>
      <button
        ref={pillRef}
        type="button"
        className={`conv-pill ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title={t('conv.switch')}
      >
        <span className="conv-pill-icon" aria-hidden>
          {active?.kind === 'vken' ? 'VK' : 'C'}
        </span>
        <span className="conv-pill-label">
          {active ? active.title || t('conv.label') : heading ?? t('conv.heading')}
        </span>
        <span className="conv-pill-count">{conversations.length}</span>
      </button>
      {open
        ? createPortal(
            <ConversationsDropdown
              menuRef={menuRef}
              anchor={pillRef.current}
              conversations={conversations}
              activeId={activeId}
              readOnly={readOnly}
              heading={heading}
              newLabel={newLabel}
              onClose={() => setOpen(false)}
              onSelect={(id) => {
                setOpen(false);
                onSelect(id);
              }}
              onCreate={() => {
                setOpen(false);
                onCreate();
              }}
              onDelete={onDelete}
              onRename={onRename}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function ConversationsDropdown({
  menuRef,
  anchor,
  conversations,
  activeId,
  readOnly,
  heading,
  newLabel,
  onClose: _onClose,
  onSelect,
  onCreate,
  onDelete,
  onRename,
}: {
  menuRef: React.MutableRefObject<HTMLDivElement | null>;
  anchor: HTMLElement | null;
  conversations: ConversationMenuItem[];
  activeId: string | null;
  readOnly: boolean;
  heading?: string;
  newLabel?: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  const t = useT();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useLayoutEffect(() => {
    if (!anchor) return;
    function update() {
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left });
    }
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [anchor]);

  if (!pos) return null;

  return (
    <div ref={menuRef} className="conv-menu" style={{ top: pos.top, left: pos.left }}>
      <div className="conv-menu-header">
        <span>{heading ?? t('conv.heading')}</span>
        {!readOnly ? (
          <button className="ghost conv-add-btn" onClick={onCreate}>
            {newLabel ?? t('conv.new')}
          </button>
        ) : null}
      </div>
      {conversations.length === 0 ? (
        <div className="conv-menu-empty">{t('conv.empty')}</div>
      ) : (
        <ul className="conv-list">
          {conversations.map((c) => (
            <li key={c.id} className={`conv-item ${c.id === activeId ? 'active' : ''}`}>
              {editing === c.id && !readOnly ? (
                <input
                  autoFocus
                  className="conv-rename-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    onRename(c.id, draft);
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onRename(c.id, draft);
                      setEditing(null);
                    } else if (e.key === 'Escape') {
                      setEditing(null);
                    }
                  }}
                />
              ) : (
                <button
                  className="conv-item-button"
                  onClick={() => onSelect(c.id)}
                  onDoubleClick={() => {
                    if (readOnly) return;
                    setEditing(c.id);
                    setDraft(c.title ?? '');
                  }}
                  title={readOnly ? c.title ?? undefined : t('conv.renameTooltip')}
                >
                  <span className="conv-item-name">{c.title || t('conv.untitled')}</span>
                  <span className="conv-item-meta">{relTime(c.updatedAt, t)}</span>
                </button>
              )}
              {!readOnly ? (
                <button
                  className="conv-item-del"
                  title={t('conv.delete')}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      confirm(
                        t('conv.deleteConfirm', {
                          title: c.title || t('conv.untitled'),
                        }),
                      )
                    ) {
                      onDelete(c.id);
                    }
                  }}
                >
                  x
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function relTime(ts: number, t: ReturnType<typeof useT>): string {
  const diff = Date.now() - ts;
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return t('common.now');
  if (diff < hr) return t('common.minutesShort', { n: Math.floor(diff / min) });
  if (diff < day) return t('common.hoursShort', { n: Math.floor(diff / hr) });
  if (diff < 7 * day) return t('common.daysShort', { n: Math.floor(diff / day) });
  return new Date(ts).toLocaleDateString();
}
