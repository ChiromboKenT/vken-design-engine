import { useEffect, useMemo, useState } from 'react';
import type { VkenKbListResponse, VkenKbRuleSummary, VkenSeverity } from '@open-design/contracts';
import { vkenFetch } from '../../providers/registry';
import { LearningBench } from './LearningBench';

type SortKey = 'avgScoreDelta' | 'acceptCount' | 'updatedAt';

interface RuleDetail {
  examples?: Array<{
    id: string;
    finding_summary?: string;
    score_delta?: number;
    source_run_id?: string;
    patch?: { filePath?: string; hunks?: Array<{ search: string; replace: string }> };
  }>;
}

export function KBPanel() {
  const [rules, setRules] = useState<VkenKbListResponse['rules']>([]);
  const [findingType, setFindingType] = useState('all');
  const [severity, setSeverity] = useState<'all' | VkenSeverity>('all');
  const [status, setStatus] = useState<'all' | VkenKbRuleSummary['status']>('all');
  const [sort, setSort] = useState<SortKey>('avgScoreDelta');
  const [openRule, setOpenRule] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, RuleDetail>>({});

  useEffect(() => {
    void (async () => {
      const resp = await vkenFetch('/api/vken/kb');
      if (!resp.ok) return;
      const body = (await resp.json()) as VkenKbListResponse;
      setRules(body.rules ?? []);
    })();
  }, []);

  const findingTypes = useMemo(() => ['all', ...new Set(rules.map((rule) => rule.findingType))], [rules]);
  const visible = useMemo(() => {
    return rules
      .filter((rule) => findingType === 'all' || rule.findingType === findingType)
      .filter((rule) => severity === 'all' || rule.severity === severity)
      .filter((rule) => status === 'all' || rule.status === status)
      .sort((a, b) => Number(b[sort]) - Number(a[sort]));
  }, [findingType, rules, severity, sort, status]);

  async function toggleRule(ruleId: string) {
    const next = openRule === ruleId ? null : ruleId;
    setOpenRule(next);
    if (!next || details[next]) return;
    const resp = await vkenFetch(`/api/vken/kb/${encodeURIComponent(next)}`);
    if (!resp.ok) return;
    const detail = (await resp.json()) as RuleDetail;
    setDetails((current) => ({ ...current, [next]: detail }));
  }

  return (
    <main style={{ minHeight: '100vh', padding: 24, background: '#f8fafc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>VKEN KB</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={findingType} onChange={(event) => setFindingType(event.target.value)} style={controlStyle}>
            {findingTypes.map((value) => (
              <option key={value} value={value}>
                {value === 'all' ? 'All findings' : value}
              </option>
            ))}
          </select>
          <select value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)} style={controlStyle}>
            {['all', 'P0', 'P1', 'P2', 'P3'].map((value) => (
              <option key={value} value={value}>
                {value === 'all' ? 'All severity' : value}
              </option>
            ))}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} style={controlStyle}>
            {['all', 'active', 'quarantined', 'retired'].map((value) => (
              <option key={value} value={value}>
                {value === 'all' ? 'All status' : value}
              </option>
            ))}
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} style={controlStyle}>
            <option value="avgScoreDelta">Sort delta</option>
            <option value="acceptCount">Sort accepts</option>
            <option value="updatedAt">Sort updated</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <LearningBench />
      </div>

      <section style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        {visible.length === 0 ? <p>No committed rules match the current filters.</p> : null}
        {visible.map((rule) => (
          <article key={rule.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
            <button type="button" onClick={() => toggleRule(rule.id)} style={rowButtonStyle}>
              <span>
                <strong>{rule.id}</strong>
                <span style={badgeStyle}>Tier {rule.tier}</span>
                <span style={badgeStyle}>{rule.signatureVerified ? 'signature verified' : 'signature invalid'}</span>
              </span>
              <span>{openRule === rule.id ? 'Hide' : 'Details'}</span>
            </button>
            <p>{rule.ruleText}</p>
            <small>
              {rule.findingType} / {rule.severity} / accepts {rule.acceptCount} / rejects {rule.rejectCount} / delta{' '}
              {Number(rule.avgScoreDelta).toFixed(2)}
            </small>
            {openRule === rule.id ? <RuleDetailView rule={rule} detail={details[rule.id]} /> : null}
          </article>
        ))}
      </section>
    </main>
  );
}

function RuleDetailView({ rule, detail }: { rule: VkenKbRuleSummary; detail?: RuleDetail }) {
  return (
    <div style={{ marginTop: 12, borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
      <strong>Evidence runs</strong>
      {rule.evidenceRuns.length === 0 ? (
        <p style={{ color: '#64748b' }}>No evidence runs recorded.</p>
      ) : (
        <ul>
          {rule.evidenceRuns.map((runId) => (
            <li key={runId}>
              <a href={`/vken/run/${encodeURIComponent(runId)}`}>{runId}</a>
            </li>
          ))}
        </ul>
      )}
      <strong>Example patches</strong>
      {!detail ? <p style={{ color: '#64748b' }}>Loading examples...</p> : null}
      {detail?.examples?.length ? (
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          {detail.examples.map((example) => (
            <details key={example.id}>
              <summary>
                {example.patch?.filePath ?? 'patch'} - delta {Number(example.score_delta ?? 0).toFixed(2)}
              </summary>
              <pre style={preStyle}>{JSON.stringify(example.patch, null, 2)}</pre>
            </details>
          ))}
        </div>
      ) : detail ? (
        <p style={{ color: '#64748b' }}>No example patches recorded for this rule yet.</p>
      ) : null}
    </div>
  );
}

const controlStyle = {
  minHeight: 36,
  borderRadius: 8,
  border: '1px solid #d0d5dd',
  background: 'white',
  padding: '0 10px',
};

const rowButtonStyle = {
  display: 'flex',
  width: '100%',
  justifyContent: 'space-between',
  gap: 12,
  border: 0,
  background: 'transparent',
  padding: 0,
  textAlign: 'left' as const,
  cursor: 'pointer',
};

const badgeStyle = {
  display: 'inline-block',
  marginLeft: 8,
  padding: '2px 8px',
  borderRadius: 999,
  background: '#eef2ff',
  color: '#3730a3',
  fontSize: 12,
};

const preStyle = {
  whiteSpace: 'pre-wrap' as const,
  background: '#0f172a',
  color: '#e2e8f0',
  padding: 12,
  borderRadius: 8,
  overflow: 'auto',
};
