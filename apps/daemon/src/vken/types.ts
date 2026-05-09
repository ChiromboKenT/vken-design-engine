export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

export interface VisualGapDimensions {
  pHashDistance: number;
  diffRatio: number;
  ssim: number;
}

export interface VisualGapResult extends VisualGapDimensions {
  visualGap: number;
  match: 'identical' | 'minor' | 'significant';
}

export interface HardcodedValueFinding {
  file: string;
  line: number;
  kind: 'color' | 'spacing' | 'radius';
  value: string;
}

export interface RadiusFinding {
  file: string;
  line: number;
  value: string;
}

export interface A11yFinding {
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  description: string;
  selector?: string;
}

export type VkenSampleId = 'landing-generic' | 'dashboard-cluttered' | 'ecommerce-basic';
export type VkenViewport = 'desktop' | 'tablet' | 'mobile';
export type VkenRiskLevel = 'low' | 'medium' | 'high';
export type VkenSeverity = 'P0' | 'P1' | 'P2' | 'P3';
export type VkenPatchStatus = 'proposed' | 'approved' | 'skipped' | 'applied' | 'reverted';

export interface VkenCreateRunRequest {
  intake:
    | { kind: 'url'; url: string }
    | { kind: 'sample'; sampleId: VkenSampleId };
  enableRepoMemory?: boolean;
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
  hardcodedValues: HardcodedValueFinding[];
  dependencies: Record<string, string>;
}

export interface VkenScorePayload {
  when: 'initial' | 'final' | 'scrub';
  value: number;
  dimensions: {
    designQuality: number;
    tokenCoverage: number;
    accessibility: number;
    neuroinclusive: number;
    responsive: number;
    buildHealth: number;
  };
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
  filePath: string;
  format: 'search-replace';
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
