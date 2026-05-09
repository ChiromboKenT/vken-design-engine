import { useMemo, useState } from 'react';
import type { VkenDirection, VkenPatch } from '@open-design/contracts';
import type { QuestionForm } from '../../artifacts/question-form';
import { vkenFetch } from '../../providers/registry';
import { QuestionFormView } from '../QuestionForm';

const DIRECTION_PALETTES = [
  ['#2d3b2d', '#c9a96e', '#fafaf5', '#e8dfd0'],
  ['#2e6b8a', '#b8860b', '#f5f0e8', '#3d5a3d'],
  ['#c0392b', '#4a7a4a', '#f0ebe1', '#1a1a1a'],
];

export function SteerForm({
  runId,
  variant,
  directions = [],
  patch,
  onSubmitted,
}: {
  runId: string | null;
  variant: 'direction' | 'steer' | 'discuss' | 'design';
  directions?: VkenDirection[];
  patch?: VkenPatch;
  onSubmitted?: () => void;
}) {
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, string | string[]> | undefined>();
  const [error, setError] = useState<string | null>(null);
  const form = useMemo(
    () => (variant === 'direction' ? directionForm(directions) : feedbackForm(variant, patch)),
    [directions, patch, variant],
  );

  async function submit(text: string, answers: Record<string, string | string[]>) {
    if (!runId) return;
    setError(null);
    try {
      if (variant === 'direction') {
        const directionId = typeof answers.direction === 'string' ? answers.direction : '';
        if (!directionId) return;
        const resp = await vkenFetch(`/api/vken/runs/${encodeURIComponent(runId)}/direction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ directionId }),
        });
        if (!resp.ok) throw new Error(await responseText(resp));
      } else {
        const resp = await vkenFetch(`/api/vken/runs/${encodeURIComponent(runId)}/steer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: variant === 'discuss' ? 'discuss' : 'steer',
            patchId: patch?.id,
            text,
            answers,
          }),
        });
        if (!resp.ok) throw new Error(await responseText(resp));
      }
      setSubmittedAnswers(answers);
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className={`vken-steer-form ${variant}`}>
      <QuestionFormView
        form={form}
        interactive={Boolean(runId)}
        submittedAnswers={submittedAnswers}
        onSubmit={submit}
      />
      {error ? <p className="vken-form-error">{error}</p> : null}
    </div>
  );
}

function directionForm(directions: VkenDirection[]): QuestionForm {
  return {
    id: 'vken-direction',
    title: 'Pick the repair direction',
    description: 'Choose the first pass VKEN should execute.',
    submitLabel: 'Run direction',
    questions: [
      {
        id: 'direction',
        label: 'Direction',
        type: 'direction-cards',
        required: true,
        cards: directions.map((direction, index) => ({
          id: direction.id,
          label: direction.name,
          mood: `${direction.mood} ${direction.summary}`,
          references: direction.evidenceKbIds,
          palette: DIRECTION_PALETTES[index % DIRECTION_PALETTES.length] ?? DIRECTION_PALETTES[0]!,
          displayFont: 'Inter, ui-sans-serif, system-ui, sans-serif',
          bodyFont: 'Inter, ui-sans-serif, system-ui, sans-serif',
        })),
      },
    ],
  };
}

function feedbackForm(variant: 'steer' | 'discuss' | 'design', patch: VkenPatch | undefined): QuestionForm {
  if (variant === 'design') {
    return {
      id: 'vken-design-brief',
      title: 'Tell VKEN what to improve',
      description: 'Design steering is applied before the next proposal pass.',
      submitLabel: 'Apply design brief',
      questions: [
        {
          id: 'focus',
          label: 'Design focus',
          type: 'checkbox',
          required: true,
          maxSelections: 3,
          options: [
            'Preserve what already works',
            'Make hierarchy clearer',
            'Make it feel more premium',
            'Tighten spacing',
            'Strengthen the CTA',
            'Reduce generic dashboard feel',
            'Improve mobile composition',
          ],
        },
        {
          id: 'note',
          label: 'Specific instruction',
          type: 'textarea',
          placeholder: 'Example: the before has better product card proportions; keep that while improving color and CTA.',
        },
      ],
    };
  }

  if (variant === 'discuss') {
    return {
      id: `vken-discuss-${patch?.id ?? 'finding'}`,
      title: 'Discuss this finding',
      description: patch ? `${patch.severity} in ${patch.filePath}` : 'Attach feedback to the active finding.',
      submitLabel: 'Send feedback',
      questions: [
        {
          id: 'feedback',
          label: 'Feedback label',
          type: 'checkbox',
          required: true,
          maxSelections: 2,
          options: ['Wrong category', 'Right idea, wrong file', 'Breaks visual intent', 'Approve with edit'],
        },
        {
          id: 'note',
          label: 'Reviewer note',
          type: 'textarea',
          placeholder: 'Add the exact concern or preferred edit.',
        },
      ],
    };
  }

  return {
    id: `vken-steer-${patch?.id ?? 'active'}`,
    title: 'Steer mid-flight',
    description: patch ? `Applies before the next proposal after ${patch.id}.` : 'Applies to the next proposal.',
    submitLabel: 'Apply steering',
    questions: [
      {
        id: 'constraints',
        label: 'Constraints',
        type: 'checkbox',
        required: true,
        maxSelections: 3,
        options: ['Prefer fewer files touched', 'Avoid public components', 'Group by category', 'Skip this category'],
      },
      {
        id: 'note',
        label: 'Instruction',
        type: 'textarea',
        placeholder: 'Optional steering for the repair engine.',
      },
    ],
  };
}

async function responseText(resp: Response): Promise<string> {
  const payload = (await resp.json().catch(() => null)) as { error?: { message?: string }; message?: string } | null;
  return payload?.error?.message ?? payload?.message ?? resp.statusText;
}
