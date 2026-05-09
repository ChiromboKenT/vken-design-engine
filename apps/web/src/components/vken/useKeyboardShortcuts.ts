import { useEffect } from 'react';

export function useKeyboardShortcuts(input: {
  enabled: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onApprove: () => void;
  onSkip: () => void;
  onHelp: () => void;
}) {
  useEffect(() => {
    if (!input.enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') return;
      if (event.key === 'j') {
        event.preventDefault();
        input.onNext();
      }
      if (event.key === 'k') {
        event.preventDefault();
        input.onPrevious();
      }
      if (event.key === 'a') {
        event.preventDefault();
        input.onApprove();
      }
      if (event.key === 's') {
        event.preventDefault();
        input.onSkip();
      }
      if (event.key === '?') {
        event.preventDefault();
        input.onHelp();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [input]);
}
