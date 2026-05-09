export type VkenSampleId = 'landing-generic' | 'dashboard-cluttered' | 'ecommerce-basic';

export type VkenRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
export type VkenViewport = 'desktop' | 'tablet' | 'mobile';
export type VkenRiskLevel = 'low' | 'medium' | 'high';
export type VkenSeverity = 'P0' | 'P1' | 'P2' | 'P3';
export type VkenPatchStatus = 'proposed' | 'approved' | 'skipped' | 'applied' | 'reverted';
export type VkenPatchFormat = 'search-replace';
export type VkenProblemCategoryId = 'tokens' | 'spacing' | 'contrast' | 'repetition';

export interface VkenProblemEvidence {
  file: string;
  line?: number;
  label: string;
  value?: string;
  severity?: VkenSeverity;
}

export interface VkenProblemCategoryBreakdown {
  category: VkenProblemCategoryId;
  label: string;
  total: number;
  remaining: number;
  fixed: number;
  queued: number;
  evidence: VkenProblemEvidence[];
}

export interface VkenCreateRunRequest {
  intake:
    | { kind: 'url'; url: string }
    | { kind: 'website'; url: string }
    | { kind: 'sample'; sampleId: VkenSampleId };
  enableRepoMemory?: boolean;
}

export interface VkenCreateRunResponse {
  runId: string;
  status: 'queued';
}

export interface VkenPickDirectionRequest {
  directionId: string;
}

export interface VkenPickDirectionResponse {
  ok: true;
}

export interface VkenApprovePatchesRequest {
  patchIds: string[];
}

export interface VkenApprovePatchesResponse {
  ok: true;
  applied: string[];
  failed: Array<{ patchId: string; reason: string }>;
}

export interface VkenScrubRequest {
  checkpoint: 'initial' | { patchId: string };
}

export interface VkenScrubResponse {
  scoreAt: number;
  pixelDeltaToInitial: number | null;
}

export interface VkenFinalizeResponse {
  prUrl: string;
  bundleUrl: string;
  scorecardUrl: string;
  scoreBefore: number;
  scoreAfter: number;
}

export interface VkenRunStatusResponse {
  id: string;
  status: VkenRunStatus;
  startedAt: number | null;
  endedAt: number | null;
  scoreInitial: number | null;
  scoreFinal: number | null;
  patchesProposed: number;
  patchesApproved: number;
  prUrl: string | null;
}

export interface VkenLeaderboardRow {
  sampleId: string;
  scenarioId: string;
  bestScoreDelta: number;
  bestRunId: string;
  attempts: number;
}

export interface VkenLeaderboardResponse {
  rows: VkenLeaderboardRow[];
  generatedAt: number;
}

export interface VkenWorkspaceIndex {
  framework: 'vite-react-tailwind';
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  tailwindVersion: 3 | 4;
  routes: Array<{
    path: string;
    componentFile: string;
    auth: false;
  }>;
  components: Array<{
    file: string;
    name: string;
    lines: number;
    primitives: string[];
  }>;
  tokens: {
    colors: Record<string, string>;
    spacings: Record<string, string>;
    radii: Record<string, string>;
    coverageRatio: number;
  };
  hardcodedValues: Array<{
    file: string;
    line: number;
    kind: 'color' | 'spacing' | 'radius';
    value: string;
  }>;
  dependencies: Record<string, string>;
}

export interface VkenDirection {
  id: string;
  name: string;
  mood: string;
  summary: string;
  changes: string[];
  effort: VkenRiskLevel;
  risk: VkenRiskLevel;
  evidenceKbIds: string[];
}

export interface VkenPatch {
  id: string;
  findingIds: string[];
  categories?: VkenProblemCategoryId[];
  filePath: string;
  format: VkenPatchFormat;
  hunks: Array<{ search: string; replace: string }>;
  rationale: string;
  severity: VkenSeverity;
  impact: number;
  risk: number;
  effort: number;
  confidence: number;
  patchable: number;
  evidenceKbIds: string[];
  status: VkenPatchStatus;
}

export interface VkenProviderInfoResponse {
  id: string;
  vlModel: string;
  coderModel: string;
  source: 'env' | 'header';
  amdPreset?: {
    baseUrl: string;
    token?: string;
    vlModel: string;
    coderModel: string;
  };
}

export interface VkenKbRuleSummary {
  id: string;
  findingType: string;
  framework: string;
  severity: VkenSeverity;
  ruleText: string;
  acceptCount: number;
  rejectCount: number;
  avgScoreDelta: number;
  evidenceRuns: string[];
  tier: 2 | 3;
  status: 'active' | 'quarantined' | 'retired';
  signatureVerified: boolean;
  updatedAt: number;
}

export interface VkenKbListResponse {
  rules: VkenKbRuleSummary[];
  generatedAt: number;
}

export interface VkenKbBenchDelta {
  sample: VkenSampleId;
  scoreInitial: number;
  scoreFinal: number;
  delta: number;
  patchesApplied: number;
  rulesApplied: string[];
}

export interface VkenKbBenchResponse {
  variant: 'seed-only' | 'seed+learned';
  deltas: VkenKbBenchDelta[];
  aggregate: number;
  generatedAt: number;
  ruleCounts: {
    seed: number;
    learned: number;
    signed: number;
  };
}
