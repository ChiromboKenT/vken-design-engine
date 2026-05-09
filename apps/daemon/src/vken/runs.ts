// @ts-nocheck
import { randomUUID } from 'node:crypto';

const TERMINAL = new Set(['succeeded', 'failed', 'canceled']);

export function createVkenRunService({ createSseResponse, createSseErrorPayload, maxEvents = 1_000 }) {
  const runs = new Map();

  function create(meta = {}) {
    const now = Date.now();
    const run = {
      id: randomUUID(),
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      events: [],
      nextEventId: 1,
      clients: new Set(),
      meta,
    };
    runs.set(run.id, run);
    return run;
  }

  function get(id) {
    return runs.get(id) ?? null;
  }

  function emit(run, event, data) {
    const id = run.nextEventId++;
    const record = { id, event, data };
    run.events.push(record);
    if (run.events.length > maxEvents) run.events.splice(0, run.events.length - maxEvents);
    run.updatedAt = Date.now();
    for (const sse of run.clients) sse.send(event, data, id);
    return record;
  }

  function stream(run, req, res) {
    const sse = createSseResponse(res);
    const lastEventId = Number(req.get('Last-Event-ID') || req.query.after || 0);
    for (const record of run.events) {
      if (!Number.isFinite(lastEventId) || record.id > lastEventId) sse.send(record.event, record.data, record.id);
    }
    if (TERMINAL.has(run.status)) {
      sse.end();
      return;
    }
    run.clients.add(sse);
    res.on('close', () => {
      run.clients.delete(sse);
      sse.cleanup();
    });
  }

  function finish(run, status) {
    if (TERMINAL.has(run.status)) return;
    run.status = status;
    run.updatedAt = Date.now();
    emit(run, 'end', { status });
    for (const sse of run.clients) sse.end();
    run.clients.clear();
  }

  function fail(run, code, message) {
    emit(run, 'error', createSseErrorPayload(code, message));
    finish(run, 'failed');
  }

  return {
    create,
    get,
    emit,
    stream,
    finish,
    fail,
    statusBody(run) {
      return {
        id: run.id,
        status: run.status,
        startedAt: run.startedAt ?? null,
        endedAt: run.endedAt ?? null,
        scoreInitial: run.scoreInitial ?? null,
        scoreFinal: run.scoreFinal ?? null,
        patchesProposed: run.patchesProposed ?? 0,
        patchesApproved: run.patchesApproved ?? 0,
        prUrl: run.prUrl ?? null,
      };
    },
  };
}
