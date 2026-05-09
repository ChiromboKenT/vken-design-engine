import { createHash } from 'node:crypto';

export interface VkenMemory {
  events: Array<{ event: string; at: number; data: unknown }>;
  counters: Record<string, number>;
}

export function emptyMemory(): VkenMemory {
  return { events: [], counters: {} };
}

export function loadRunMemory(db: any, runId: string): VkenMemory {
  const row = db.prepare(`SELECT memory_json AS memoryJson FROM vken_run_memory WHERE run_id = ?`).get(runId);
  return row?.memoryJson ? JSON.parse(row.memoryJson) : emptyMemory();
}

export function saveRunMemory(db: any, runId: string, memory: VkenMemory): void {
  db.prepare(
    `INSERT INTO vken_run_memory (run_id, memory_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(run_id) DO UPDATE SET memory_json = excluded.memory_json, updated_at = excluded.updated_at`,
  ).run(runId, JSON.stringify(memory), Date.now());
}

export function repoHash(repoUrl: string): string {
  return createHash('sha256').update(repoUrl.trim().toLowerCase()).digest('hex').slice(0, 16);
}

export function loadRepoMemory(db: any, hash: string): VkenMemory {
  const row = db.prepare(`SELECT memory_json AS memoryJson FROM vken_repo_memory WHERE repo_hash = ?`).get(hash);
  if (!row?.memoryJson) return emptyMemory();
  const memory = JSON.parse(row.memoryJson) as VkenMemory;
  saveRepoMemory(db, hash, memory);
  return memory;
}

export function saveRepoMemory(db: any, hash: string, memory: VkenMemory): void {
  const now = Date.now();
  db.prepare(
    `INSERT INTO vken_repo_memory (repo_hash, memory_json, ttl_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(repo_hash) DO UPDATE SET memory_json = excluded.memory_json, ttl_at = excluded.ttl_at, updated_at = excluded.updated_at`,
  ).run(hash, JSON.stringify(memory), now + 1000 * 60 * 60 * 24 * 30, now);
}

export function recordEvent(memory: VkenMemory, event: { event: string; data: unknown }): VkenMemory {
  const next: VkenMemory = {
    events: [...memory.events, { event: event.event, data: event.data, at: Date.now() }].slice(-200),
    counters: { ...memory.counters },
  };
  next.counters[event.event] = (next.counters[event.event] ?? 0) + 1;
  return next;
}

export function promoteRunToRepo(input: { db: any; runId: string; repoUrl: string }): void {
  const runMemory = loadRunMemory(input.db, input.runId);
  const hash = repoHash(input.repoUrl);
  const repoMemory = loadRepoMemory(input.db, hash);
  saveRepoMemory(input.db, hash, {
    events: [...repoMemory.events, ...runMemory.events].slice(-500),
    counters: mergeCounters(repoMemory.counters, runMemory.counters),
  });
}

function mergeCounters(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out = { ...a };
  for (const [key, value] of Object.entries(b)) out[key] = (out[key] ?? 0) + value;
  return out;
}
