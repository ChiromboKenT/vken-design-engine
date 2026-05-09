import type { SseErrorPayload } from '../errors';
import type {
  VkenDirection,
  VkenPatch,
  VkenProblemCategoryBreakdown,
  VkenViewport,
} from '../api/vken';
import type { SseTransportEvent } from './common';

export interface VkenIntakePayload {
  repo: { name: string; sourceRef: string; sample?: string };
  framework: 'vite-react-tailwind' | 'website-capture';
}

export interface VkenScanPayload {
  durationMs: number;
  components: number;
  routes: number;
  hardcodedValues: number;
  tokenCoverage: number;
  categories?: VkenProblemCategoryBreakdown[];
  done?: boolean;
}

export interface VkenCapturePayload {
  checkpoint?: string;
  routePath?: string;
  viewport?: VkenViewport;
  screenshotUrl?: string;
  done?: boolean;
  count?: number;
}

export interface VkenScorePayload {
  when: 'initial' | 'final' | 'scrub';
  value: number;
  categories?: VkenProblemCategoryBreakdown[];
  dimensions: {
    designQuality: number;
    tokenCoverage: number;
    accessibility: number;
    neuroinclusive: number;
    responsive: number;
    buildHealth: number;
  };
}

export interface VkenDirectionPayload extends Partial<VkenDirection> {
  done?: boolean;
  picked?: boolean;
}

export interface VkenPatchPayload extends Partial<VkenPatch> {
  done?: boolean;
}

export interface VkenApplyPayload {
  patchId: string;
  ok: boolean;
  reason?: string;
  scoreDelta?: number;
  pixelDeltaToInitial?: number;
  previewUrl?: string;
  directionPicked?: string;
  categories?: VkenProblemCategoryBreakdown[];
}

export interface VkenValidatePayload {
  stage: 'build' | 'tsc' | 'a11y' | 'pixel' | 'console';
  ok: boolean;
  details?: unknown;
}

export interface VkenFinalizePayload {
  prUrl: string;
  bundleUrl: string;
  scorecardUrl: string;
}

export interface VkenLearnPayload {
  ruleId?: string;
  ruleText?: string;
  evidenceRunIds?: string[];
  status?: 'proposed' | 'accepted' | 'rejected';
  reason?: string;
  done?: boolean;
}

export interface VkenSteerPayload {
  kind: 'steer' | 'discuss';
  patchId?: string;
  text: string;
  answers: Record<string, string | string[]>;
}

export type VkenSseEvent =
  | SseTransportEvent<'vken:intake', VkenIntakePayload>
  | SseTransportEvent<'vken:scan', VkenScanPayload>
  | SseTransportEvent<'vken:capture', VkenCapturePayload>
  | SseTransportEvent<'vken:score', VkenScorePayload>
  | SseTransportEvent<'vken:direction', VkenDirectionPayload>
  | SseTransportEvent<'vken:patch', VkenPatchPayload>
  | SseTransportEvent<'vken:apply', VkenApplyPayload>
  | SseTransportEvent<'vken:validate', VkenValidatePayload>
  | SseTransportEvent<'vken:finalize', VkenFinalizePayload>
  | SseTransportEvent<'vken:learn', VkenLearnPayload>
  | SseTransportEvent<'vken:steer', VkenSteerPayload>
  | SseTransportEvent<'error', SseErrorPayload>
  | SseTransportEvent<'end', { status: 'succeeded' | 'failed' | 'canceled' }>;

export type VkenSseEventName =
  VkenSseEvent extends SseTransportEvent<infer N, unknown> ? N : never;
