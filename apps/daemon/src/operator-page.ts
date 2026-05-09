export interface VkenOperatorPageModel {
  status: 'running';
  provider: {
    id: string;
    source: string;
    vlModel: string;
    coderModel: string;
    fallback: string;
  };
  kb: {
    seedEntries: number;
    learnedEntries: number;
    promotedEntries: number;
  };
  lastRun: {
    id: string;
    status: string;
    ageMs: number | null;
    durationMs: number | null;
  } | null;
  queuePending: number;
  pid: number;
  logsPath: string;
  dataPath: string;
  cockpitUrl: string;
}

export function renderVkenOperatorPage(model: VkenOperatorPageModel): string {
  const rows: Array<[string, string]> = [
    ['Status', model.status],
    ['Provider', `${model.provider.id} (${model.provider.source})  |  fallback: ${model.provider.fallback}`],
    ['Models', `VL  ${model.provider.vlModel}\nCoder  ${model.provider.coderModel}`],
    [
      'KB',
      `seed.jsonl  |  ${model.kb.seedEntries} seed entries  |  learned: ${model.kb.learnedEntries}  |  promoted: ${model.kb.promotedEntries}`,
    ],
    ['Last run', formatLastRun(model.lastRun)],
    ['Queue', `${model.queuePending} pending`],
    ['PID', String(model.pid)],
    ['Logs', model.logsPath],
    ['Data', model.dataPath],
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="5">
  <title>VKEN daemon operator status</title>
  <style>
    :root { color-scheme: light; font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace; }
    body { margin: 0; background: #fff; color: #111; }
    main { max-width: 960px; padding: 32px; }
    h1 { margin: 0 0 24px; font-size: 18px; font-weight: 700; }
    dl { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 10px 18px; margin: 0 0 28px; }
    dt { color: #555; }
    dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
    a { color: #0645ad; }
  </style>
</head>
<body>
  <main>
    <h1>VKEN daemon | operator status</h1>
    <dl>
${rows.map(([label, value]) => `      <dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join('\n')}
    </dl>
    <p>Use the cockpit at <a href="${escapeAttribute(model.cockpitUrl)}">${escapeHtml(model.cockpitUrl)}</a></p>
  </main>
</body>
</html>`;
}

function formatLastRun(run: VkenOperatorPageModel['lastRun']): string {
  if (!run) return 'none';
  const age = run.ageMs == null ? 'unknown age' : `${Math.max(0, Math.round(run.ageMs / 1000))}s ago`;
  const duration =
    run.durationMs == null ? 'duration pending' : `${Math.max(0, Math.round(run.durationMs / 1000))}s`;
  return `${run.id}  |  ${run.status}  |  ${age}  |  ${duration}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll('`', '&#96;');
}
