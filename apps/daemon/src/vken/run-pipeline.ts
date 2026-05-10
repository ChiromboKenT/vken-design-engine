import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { VkenCreateRunRequest } from './types.js';
import { captureVkenWebsite, captureVkenWorkspace } from './capture.js';
import { buildVkenWorkspaceIndex, buildVkenWorkspaceIndexFromPath } from './index-build.js';
import { resolveVkenIntake, VkenIntakeError } from './intake.js';
import { startViteDevServer } from './runner.js';
import { scoreVkenIndex } from './score.js';
import { critiqueCapture } from './critique.js';
import { proposeDirections } from './directions.js';
import { proposePatches } from './propose.js';
import { initVirtualFs } from './apply.js';
import type { VkenScorePayload } from './types.js';
import { repoHash } from './memory.js';
import { buildVkenProblemCategories, categoryTotals } from './categories.js';

export async function executeDeterministicVkenRun({
  db,
  projectRoot,
  dataDir,
  service,
  run,
  request,
}: {
  db: any;
  projectRoot: string;
  dataDir: string;
  service: any;
  run: any;
  request: VkenCreateRunRequest;
}) {
  const now = Date.now();
  try {
    run.status = 'running';
    run.startedAt = now;
    const noLlm = Boolean((request as VkenCreateRunRequest & { noLlm?: boolean }).noLlm);
    const intake = resolveVkenIntake(projectRoot, request, { dataDir, runId: run.id });
    const targetId = randomUUID();
    db.prepare(
      `INSERT INTO vken_targets
        (id, source, source_ref, framework, package_manager, tailwind_version, workspace_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      targetId,
      intake.source === 'website' ? 'url' : intake.source,
      intake.sourceRef,
      intake.framework,
      intake.packageManager,
      intake.tailwindVersion,
      intake.workspacePath,
      now,
    );
    db.prepare(
      `INSERT INTO vken_runs (id, target_id, status, started_at, repo_hash, created_at)
       VALUES (?, ?, 'running', ?, ?, ?)`,
    ).run(run.id, targetId, now, repoHash(intake.sourceRef), now);

    service.emit(run, 'vken:intake', {
      repo: {
        name: intake.repoName,
        sourceRef: intake.sourceRef,
        sample: intake.source === 'sample' ? intake.sourceRef : undefined,
      },
      framework: intake.framework,
    });

    if (intake.source === 'website') {
      const index = {
        framework: 'vite-react-tailwind' as const,
        packageManager: 'npm' as const,
        tailwindVersion: 4 as const,
        routes: [{ path: '/', componentFile: 'remote-url', auth: false as const }],
        components: [],
        tokens: { colors: {}, spacings: {}, radii: {}, coverageRatio: 0 },
        hardcodedValues: [],
        dependencies: {},
      };
      const scanCategories = buildVkenProblemCategories(index);
      run.categoryTotals = categoryTotals(scanCategories);
      run.workspacePath = intake.workspacePath;
      run.index = index;
      run.dataDir = dataDir;
      service.emit(run, 'vken:scan', {
        durationMs: 0,
        components: 0,
        routes: 1,
        hardcodedValues: 0,
        tokenCoverage: 0,
        categories: scanCategories,
        done: true,
      });

      const runDir = path.join(dataDir, 'vken', 'runs', run.id);
      run.runDir = runDir;
      fs.mkdirSync(runDir, { recursive: true });
      fs.writeFileSync(path.join(runDir, 'workspace-index.json'), JSON.stringify(index, null, 2));
      const captures = await captureVkenWebsite({
        runId: run.id,
        runDir,
        targetUrl: intake.sourceRef,
        checkpoint: 'initial',
      });
      for (const capture of captures) {
        db.prepare(
          `INSERT INTO vken_captures
            (id, run_id, checkpoint, route_path, viewport, screenshot_path, aria_yaml,
             css_vars_json, box_models_json, console_json, captured_at)
           VALUES (?, ?, 'initial', ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          capture.id,
          run.id,
          capture.routePath,
          capture.viewport,
          capture.screenshotPath,
          capture.ariaYaml,
          capture.cssVarsJson,
          capture.boxModelsJson,
          capture.consoleJson,
          capture.capturedAt,
        );
        service.emit(run, 'vken:capture', {
          checkpoint: 'initial',
          routePath: capture.routePath,
          viewport: capture.viewport,
          screenshotUrl: `/api/vken/captures/${capture.id}/screenshot.png`,
        });
      }
      service.emit(run, 'vken:capture', { checkpoint: 'initial', done: true, count: captures.length });

      const critiqueResults = [];
      if (noLlm) {
        service.emit(run, 'vken:patch', { done: true });
      } else {
        for (const capture of captures.filter((capture) => capture.viewport === 'desktop')) {
          critiqueResults.push(
            await critiqueCapture({
              captureId: capture.id,
              runId: run.id,
              db,
              opts: { byok: run.byok },
            }),
          );
        }
      }
      const designQuality =
        critiqueResults.length > 0
          ? critiqueResults.reduce((sum, item) => sum + item.designQuality, 0) / critiqueResults.length
          : undefined;
      const findings = critiqueResults.flatMap((item) => item.findings);
      const scoreCategories = buildVkenProblemCategories(index, {
        totals: run.categoryTotals,
        findings,
      });
      run.categoryTotals = categoryTotals(scoreCategories);
      const score = scoreVkenIndex(index, { designQuality, categories: scoreCategories });
      run.scoreInitial = score.value;
      service.emit(run, 'vken:score', score);
      const endedAt = Date.now();
      run.endedAt = endedAt;
      db.prepare(`UPDATE vken_runs SET status = 'succeeded', ended_at = ?, score_initial = ? WHERE id = ?`).run(
        endedAt,
        score.value,
        run.id,
      );
      service.finish(run, 'succeeded');
      return;
    }

    const scanStart = Date.now();
    const index = buildVkenWorkspaceIndex(intake);
    const scanCategories = buildVkenProblemCategories(index);
    run.categoryTotals = categoryTotals(scanCategories);
    run.workspacePath = intake.workspacePath;
    run.sampleId = intake.source === 'sample' ? intake.sourceRef : undefined;
    run.index = index;
    run.dataDir = dataDir;
    service.emit(run, 'vken:scan', {
      durationMs: Date.now() - scanStart,
      components: index.components.length,
      routes: index.routes.length,
      hardcodedValues: index.hardcodedValues.length,
      tokenCoverage: index.tokens.coverageRatio,
      categories: scanCategories,
      done: true,
    });

    const runDir = path.join(dataDir, 'vken', 'runs', run.id);
    run.runDir = runDir;
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, 'workspace-index.json'), JSON.stringify(index, null, 2));
    const devServer = await startViteDevServer({ workspacePath: intake.workspacePath });
    let captures;
    try {
      captures = await captureVkenWorkspace({
        runId: run.id,
        runDir,
        index,
        baseUrl: devServer.url,
      });
    } finally {
      await devServer.kill();
    }
    for (const capture of captures) {
      db.prepare(
        `INSERT INTO vken_captures
          (id, run_id, checkpoint, route_path, viewport, screenshot_path, aria_yaml,
           css_vars_json, box_models_json, console_json, captured_at)
         VALUES (?, ?, 'initial', ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        capture.id,
        run.id,
        capture.routePath,
        capture.viewport,
        capture.screenshotPath,
        capture.ariaYaml,
        capture.cssVarsJson,
        capture.boxModelsJson,
        capture.consoleJson,
        capture.capturedAt,
      );
      service.emit(run, 'vken:capture', {
        checkpoint: 'initial',
        routePath: capture.routePath,
        viewport: capture.viewport,
        screenshotUrl: `/api/vken/captures/${capture.id}/screenshot.png`,
      });
    }
    service.emit(run, 'vken:capture', { checkpoint: 'initial', done: true, count: captures.length });

    const desktopCaptures = captures.filter((capture) => capture.viewport === 'desktop');
    const critiqueResults = [];
    if (noLlm) {
      service.emit(run, 'vken:patch', { done: true });
    } else {
      for (const capture of desktopCaptures) {
        const critique = await critiqueCapture({
          captureId: capture.id,
          runId: run.id,
          db,
          opts: {
            sampleId: intake.source === 'sample' ? intake.sourceRef : undefined,
            byok: run.byok,
          },
        });
        critiqueResults.push(critique);
      }
    }
    const designQuality =
      critiqueResults.length > 0
        ? critiqueResults.reduce((sum, item) => sum + item.designQuality, 0) / critiqueResults.length
        : undefined;
    const findings = critiqueResults.flatMap((item) => item.findings);
    const scoreCategories = buildVkenProblemCategories(index, {
      totals: run.categoryTotals,
      findings,
    });
    run.categoryTotals = categoryTotals(scoreCategories);
    const score = scoreVkenIndex(index, { designQuality, categories: scoreCategories });
    run.scoreInitial = score.value;
    service.emit(run, 'vken:score', score);
    db.prepare(`UPDATE vken_runs SET score_initial = ? WHERE id = ?`).run(score.value, run.id);
    if (noLlm) {
      const endedAt = Date.now();
      run.endedAt = endedAt;
      db.prepare(`UPDATE vken_runs SET status = 'succeeded', ended_at = ?, score_initial = ? WHERE id = ?`).run(
        endedAt,
        score.value,
        run.id,
      );
      service.finish(run, 'succeeded');
      return;
    }

    const directions = await proposeDirections({
      runId: run.id,
      db,
      index,
      opts: {
        sampleId: intake.source === 'sample' ? intake.sourceRef : undefined,
        byok: run.byok,
      },
    });
    for (const direction of directions) {
      service.emit(run, 'vken:direction', direction);
    }
    service.emit(run, 'vken:direction', { done: true });
    const direction = directions[0];
    if (direction) {
      db.prepare(`UPDATE vken_directions SET is_chosen = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE run_id = ?`).run(
        direction.id,
        run.id,
      );
      db.prepare(`UPDATE vken_runs SET direction_id = ? WHERE id = ?`).run(direction.id, run.id);
      run.directionPicked = direction.id;
      service.emit(run, 'vken:direction', { id: direction.id, picked: true });
      run.vfs = initVirtualFs(intake.workspacePath);
      const proposed = await proposePatches({
        runId: run.id,
        db,
        workspacePath: intake.workspacePath,
        index,
        direction,
        session: run.vfs,
        opts: {
          sampleId: intake.source === 'sample' ? intake.sourceRef : undefined,
          byok: run.byok,
          steers: run.steers,
        },
      });
      run.vfs = proposed.session;
      run.patchesProposed = proposed.patches.length;
      for (const patch of proposed.patches) service.emit(run, 'vken:patch', patch);
    }
    service.emit(run, 'vken:patch', { done: true });
    db.prepare(`UPDATE vken_runs SET status = 'running', score_initial = ? WHERE id = ?`).run(score.value, run.id);
  } catch (error) {
    const endedAt = Date.now();
    run.endedAt = endedAt;
    const code = error instanceof VkenIntakeError ? error.code : 'VKEN_INTAKE_FAILED';
    const message = error instanceof Error ? error.message : String(error);
    db.prepare(`UPDATE vken_runs SET status = 'failed', ended_at = ? WHERE id = ?`).run(endedAt, run.id);
    service.fail(run, code, message);
  }
}

export async function recomputeScoreFromMaterialized(input: {
  runId: string;
  db: any;
  workspaceDir: string;
  designQualityOverride?: number;
  when?: VkenScorePayload['when'];
  categories?: VkenScorePayload['categories'];
}): Promise<VkenScorePayload> {
  const index = buildVkenWorkspaceIndexFromPath(input.workspaceDir);
  return scoreVkenIndex(index, {
    designQuality: input.designQualityOverride,
    when: input.when ?? 'final',
    categories: input.categories,
  });
}
