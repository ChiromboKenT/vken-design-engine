import { useEffect, useState } from 'react';
import type {
  VkenDirection,
  VkenLearnPayload,
  VkenPatch,
  VkenSseEvent,
  VkenValidatePayload,
} from '@open-design/contracts';
import { parseSseFrame } from '../../providers/sse';
import { vkenFetch } from '../../providers/registry';

export interface VkenRunState {
  status: 'idle' | 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
  events: VkenSseEvent[];
  score: number | null;
  captures: VkenCaptureSummary[];
  directions: VkenDirection[];
  directionPicked: string | null;
  patches: VkenPatch[];
  validations: VkenValidatePayload[];
  learns: VkenLearnPayload[];
  previewUrl: string | null;
  activeCheckpoint: string;
  prUrl: string | null;
  summary: {
    repoName?: string;
    framework?: string;
    components?: number;
    routes?: number;
    hardcodedValues?: number;
    tokenCoverage?: number;
  };
  error?: string;
}

export interface VkenCaptureSummary {
  routePath: string;
  viewport: string;
  screenshotUrl: string;
}

export function useVkenSse(runId: string | null): VkenRunState {
  const [state, setState] = useState<VkenRunState>(() => initialState(runId));

  useEffect(() => {
    if (!runId) {
      setState(initialState(null));
      return;
    }
    const controller = new AbortController();
    setState(initialState(runId));

    void (async () => {
      const resp = await vkenFetch(`/api/vken/runs/${encodeURIComponent(runId)}/sse`, {
        signal: controller.signal,
      });
      if (!resp.ok || !resp.body) {
        setState((curr) => ({ ...curr, status: 'failed', error: `daemon ${resp.status}` }));
        return;
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const parsed = parseSseFrame(frame);
          if (!parsed || parsed.kind !== 'event') continue;
          const event = parsed as unknown as VkenSseEvent;
          setState((curr) => reduceEvent(curr, event));
        }
      }
    })().catch((error) => {
      if ((error as Error).name === 'AbortError') return;
      setState((curr) => ({ ...curr, status: 'failed', error: String(error) }));
    });

    return () => controller.abort();
  }, [runId]);

  return state;
}

function initialState(runId: string | null): VkenRunState {
  return {
    status: runId ? 'queued' : 'idle',
    events: [],
    score: null,
    captures: [],
    directions: [],
    directionPicked: null,
    patches: [],
    validations: [],
    learns: [],
    previewUrl: null,
    activeCheckpoint: 'initial',
    prUrl: null,
    summary: {},
  };
}

function reduceEvent(curr: VkenRunState, event: VkenSseEvent): VkenRunState {
  const next: VkenRunState = {
    ...curr,
    status: curr.status === 'queued' ? 'running' : curr.status,
    events: [...curr.events, event],
  };
  if (event.event === 'vken:intake') {
    next.summary = {
      ...next.summary,
      repoName: event.data.repo.name,
      framework: event.data.framework,
    };
  }
  if (event.event === 'vken:scan') {
    next.summary = {
      ...next.summary,
      components: event.data.components,
      routes: event.data.routes,
      hardcodedValues: event.data.hardcodedValues,
      tokenCoverage: event.data.tokenCoverage,
    };
  }
  if (event.event === 'vken:capture' && event.data.routePath && event.data.viewport && event.data.screenshotUrl) {
    next.captures = [
      ...next.captures,
      {
        routePath: event.data.routePath,
        viewport: event.data.viewport,
        screenshotUrl: event.data.screenshotUrl,
      },
    ];
  }
  if (event.event === 'vken:score') next.score = event.data.value;
  if (event.event === 'vken:direction') {
    if (event.data.picked && event.data.id) next.directionPicked = event.data.id;
    if (!event.data.done && event.data.id && event.data.name) {
      next.directions = [
        ...next.directions.filter((direction) => direction.id !== event.data.id),
        event.data as VkenDirection,
      ];
    }
  }
  if (event.event === 'vken:patch' && !event.data.done && event.data.id) {
    next.patches = [
      ...next.patches.filter((patch) => patch.id !== event.data.id),
      event.data as VkenPatch,
    ];
  }
  if (event.event === 'vken:apply') {
    if (event.data.directionPicked) next.directionPicked = event.data.directionPicked;
    if (event.data.previewUrl) {
      next.previewUrl = event.data.previewUrl;
      next.activeCheckpoint = event.data.patchId;
    }
    next.patches = next.patches.map((patch) =>
      patch.id === event.data.patchId && event.data.ok ? { ...patch, status: 'applied' } : patch,
    );
  }
  if (event.event === 'vken:validate') next.validations = [...next.validations, event.data];
  if (event.event === 'vken:learn') next.learns = [...next.learns, event.data];
  if (event.event === 'vken:finalize') {
    next.prUrl = event.data.prUrl;
  }
  if (event.event === 'error') {
    next.status = 'failed';
    next.error = event.data.message;
  }
  if (event.event === 'end') next.status = event.data.status;
  return next;
}
