import { useEffect, useMemo, useState } from 'react';
import type { VkenProviderInfoResponse, VkenSampleId } from '@open-design/contracts';
import { navigate } from '../../router';
import { vkenFetch } from '../../providers/registry';
import { providerLabel } from '../../state/byok';
import type { AgentInfo, AppConfig, ExecMode } from '../../types';
import { AgentPicker } from '../AgentPicker';
import { AppChromeHeader } from '../AppChromeHeader';
import { AvatarMenu } from '../AvatarMenu';
import { ConversationsMenu, type ConversationMenuItem } from '../ConversationsMenu';
import { PetRail } from '../pet/PetRail';
import { ByokPanel } from './ByokPanel';
import { KBPanel } from './KBPanel';
import { Leaderboard } from './Leaderboard';
import { useVkenSse, type VkenRunState } from './useVkenSse';
import { Workshop } from './Workshop';
import './tokens.css';
import './vken.css';

const SAMPLES: VkenSampleId[] = ['landing-generic', 'dashboard-cluttered', 'ecommerce-basic'];

export function VkenApp({
  runId,
  page,
  config,
  agents,
  daemonLive,
  onModeChange,
  onAgentChange,
  onAgentModelChange,
  onOpenSettings,
  onRefreshAgents,
  onAdoptPetInline,
  onTogglePet,
  onOpenPetSettings,
  onBack,
}: {
  runId: string | null;
  page: 'home' | 'leaderboard' | 'kb';
  config: AppConfig;
  agents: AgentInfo[];
  daemonLive: boolean;
  onModeChange: (mode: ExecMode) => void;
  onAgentChange: (id: string) => void;
  onAgentModelChange: (id: string, choice: { model?: string; reasoning?: string }) => void;
  onOpenSettings: () => void;
  onRefreshAgents: () => void;
  onAdoptPetInline: (petId: string) => void;
  onTogglePet: () => void;
  onOpenPetSettings: () => void;
  onBack: () => void;
}) {
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | undefined>();
  const [byokOpen, setByokOpen] = useState(false);
  const [provider, setProvider] = useState<VkenProviderInfoResponse | null>(null);
  const [petRailHidden, setPetRailHidden] = useState(false);
  const state = useVkenSse(runId);

  useEffect(() => {
    document.body.classList.add('vken-body-lock');
    return () => document.body.classList.remove('vken-body-lock');
  }, []);

  useEffect(() => {
    void (async () => {
      const resp = await vkenFetch('/api/vken/provider/info');
      if (resp.ok) setProvider((await resp.json()) as VkenProviderInfoResponse);
    })();
  }, [byokOpen]);

  const conversations = useMemo<ConversationMenuItem[]>(() => {
    const now = Date.now();
    const activeRun = runId
      ? [
          {
            id: runId,
            projectId: 'vken',
            title: `Run ${shortRunId(runId)}`,
            createdAt: now,
            updatedAt: now,
            kind: 'vken' as const,
          },
        ]
      : [];
    return [
      ...activeRun,
      ...SAMPLES.map((sampleId, index) => ({
        id: `sample:${sampleId}`,
        projectId: 'vken',
        title: `Heal: ${sampleId}`,
        createdAt: now - index - 1,
        updatedAt: now - index - 1,
        kind: 'vken' as const,
      })),
    ];
  }, [runId]);

  const vkenAgents = useMemo<AgentInfo[]>(() => {
    const withoutDuplicate = agents.filter((agent) => agent.id !== 'vken');
    return [
      {
        id: 'vken',
        name: 'VKEN',
        bin: 'vken',
        available: true,
        version: 'repair cockpit',
        models: [{ id: 'default', label: 'Pipeline default' }],
      },
      ...withoutDuplicate,
    ];
  }, [agents]);

  async function startSample(sampleId: VkenSampleId) {
    await startRun({ intake: { kind: 'sample', sampleId } });
  }

  async function startUrl(url: string) {
    await startRun({ intake: isRepoUrl(url) ? { kind: 'url', url } : { kind: 'website', url } });
  }

  async function startRun(
    body: {
      intake:
        | { kind: 'sample'; sampleId: VkenSampleId }
        | { kind: 'url'; url: string }
        | { kind: 'website'; url: string };
    },
  ) {
    setStarting(true);
    setStartError(undefined);
    try {
      const resp = await vkenFetch('/api/vken/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error(await friendlyStartError(resp));
      const responseBody = (await resp.json()) as { runId: string };
      navigate({ kind: 'vken', runId: responseBody.runId, page: 'home' });
    } catch (error) {
      setStartError(error instanceof Error ? error.message : String(error));
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="vken-app app">
      <AppChromeHeader
        onBack={onBack}
        backLabel="Back to projects"
        subHeader={
          <VkenSubHeader
            runId={runId}
            page={page}
            provider={provider}
            starting={starting}
            onStartSample={(sampleId) => void startSample(sampleId)}
            onOpenProvider={() => setByokOpen(true)}
          />
        }
        actions={
          <AvatarMenu
            config={config}
            agents={vkenAgents}
            daemonLive={daemonLive}
            onModeChange={onModeChange}
            onAgentChange={onAgentChange}
            onAgentModelChange={onAgentModelChange}
            onOpenSettings={onOpenSettings}
            onRefreshAgents={onRefreshAgents}
            onBack={onBack}
          />
        }
      >
        <div className="vken-header-controls">
          <ConversationsMenu
            conversations={conversations}
            activeId={runId}
            readOnly
            heading="VKEN runs"
            onSelect={(id) => {
              if (id.startsWith('sample:')) {
                void startSample(id.slice('sample:'.length) as VkenSampleId);
                return;
              }
              navigate({ kind: 'vken', runId: id, page: 'home' });
            }}
            onCreate={() => navigate({ kind: 'vken', runId: null, page: 'home' })}
            onDelete={() => undefined}
            onRename={() => undefined}
          />
          <AgentPicker
            mode={config.mode}
            agents={vkenAgents}
            agentId="vken"
            daemonLive={daemonLive}
            onModeChange={onModeChange}
            onAgentChange={onAgentChange}
            onRefresh={onRefreshAgents}
          />
        </div>
      </AppChromeHeader>

      <div className={`vken-shell${petRailHidden ? ' no-pet-rail' : ''}`}>
        {petRailHidden ? null : (
          <PetRail
            config={config}
            healState={petHealState(state)}
            onAdoptInline={onAdoptPetInline}
            onOpenPetSettings={onOpenPetSettings}
            onTuck={onTogglePet}
            onHide={() => setPetRailHidden(true)}
          />
        )}
        <main className="vken-shell-main">
          {page === 'leaderboard' ? (
            <div className="vken-secondary-page">
              <Leaderboard />
            </div>
          ) : page === 'kb' ? (
            <div className="vken-secondary-page">
              <KBPanel />
            </div>
          ) : (
            <Workshop
              runId={runId}
              state={state}
              starting={starting}
              startError={startError}
              onStartSample={(sampleId) => void startSample(sampleId)}
              onStartUrl={startUrl}
            />
          )}
        </main>
      </div>
      <ByokPanel open={byokOpen} onClose={() => setByokOpen(false)} />
    </div>
  );
}

function isRepoUrl(url: string): boolean {
  return /^https:\/\/(github\.com|gitlab\.com|codeberg\.org)\/[\w.-]+\/[\w.-]+(?:\.git)?$/i.test(url.trim());
}

function VkenSubHeader({
  runId,
  page,
  provider,
  starting,
  onStartSample,
  onOpenProvider,
}: {
  runId: string | null;
  page: 'home' | 'leaderboard' | 'kb';
  provider: VkenProviderInfoResponse | null;
  starting: boolean;
  onStartSample: (sampleId: VkenSampleId) => void;
  onOpenProvider: () => void;
}) {
  return (
    <div className="vken-subheader">
      <div className="vken-subheader-id">
        <strong>VKEN</strong>
        <span>{runId ? `run ${shortRunId(runId)}` : 'no active run'}</span>
      </div>
      <nav className="vken-page-tabs" aria-label="VKEN pages">
        <button
          type="button"
          className={page === 'home' ? 'active' : ''}
          onClick={() => navigate({ kind: 'vken', runId, page: 'home' })}
        >
          Cockpit
        </button>
        <button
          type="button"
          className={page === 'leaderboard' ? 'active' : ''}
          onClick={() => navigate({ kind: 'vken', runId: null, page: 'leaderboard' })}
        >
          Leaderboard
        </button>
        <button
          type="button"
          className={page === 'kb' ? 'active' : ''}
          onClick={() => navigate({ kind: 'vken', runId: null, page: 'kb' })}
        >
          KB
        </button>
      </nav>
      <div className="vken-sample-tabs" aria-label="Start sample">
        {SAMPLES.map((sampleId) => (
          <button key={sampleId} type="button" disabled={starting} onClick={() => onStartSample(sampleId)}>
            {sampleId}
          </button>
        ))}
      </div>
      <button type="button" className="vken-provider-chip" onClick={onOpenProvider}>
        {providerLabel(provider)}
      </button>
    </div>
  );
}

function petHealState(state: VkenRunState): 'watching' | 'worried' | 'cheering' | 'resting' {
  if (state.status === 'failed' || state.error) return 'worried';
  if (state.status === 'succeeded') return 'resting';
  if (state.patches.some((patch) => patch.status === 'applied')) return 'cheering';
  if (state.status === 'running' || state.status === 'queued') return 'watching';
  return 'resting';
}

function shortRunId(runId: string): string {
  return runId.length <= 10 ? runId : `${runId.slice(0, 4)}-${runId.slice(-4)}`;
}

async function friendlyStartError(resp: Response): Promise<string> {
  const payload = (await resp.json().catch(() => null)) as { error?: { message?: string }; message?: string } | null;
  const message = payload?.error?.message ?? payload?.message ?? resp.statusText;
  if (message.includes('V1 supports Vite + React + Tailwind')) return 'V1 supports public Vite + React + Tailwind repos only.';
  if (message.includes('Only public GitHub')) return 'Use a public GitHub, GitLab, or Codeberg HTTPS repository URL.';
  if (message.includes('limit is 50 MB')) return message;
  return message || `Run failed (${resp.status})`;
}
