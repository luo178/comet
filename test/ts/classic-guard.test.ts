import { spawnSync } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

const runtime = path.resolve('assets', 'skills', 'comet', 'scripts', 'comet-runtime.mjs');
const temporary: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((dir) => fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })),
  );
});

function run(cwd: string, ...args: string[]) {
  return spawnSync(process.execPath, [runtime, ...args], { cwd, encoding: 'utf8' });
}

async function makeProject(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'classic-guard-'));
  temporary.push(dir);
  return dir;
}

describe('Classic guard command', () => {
  it('blocks the open guard when artifacts are missing and leaves state unchanged', async () => {
    const dir = await makeProject();
    expect(run(dir, 'state', 'init', 'demo', 'full').status).toBe(0);

    const result = run(dir, 'guard', 'demo', 'open');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('[FAIL] proposal.md exists and non-empty');
    expect(result.stderr).toContain('[FAIL] tasks.md has at least one task');
    expect(result.stderr).toContain('BLOCKED — fix failing checks before proceeding to next phase');

    // A blocked guard must not mutate state.
    expect(run(dir, 'state', 'get', 'demo', 'phase').stdout.trim()).toBe('open');
  });

  it('passes the open guard and applies the transition when artifacts exist', async () => {
    const dir = await makeProject();
    run(dir, 'state', 'init', 'demo', 'hotfix');
    const changeDir = path.join(dir, 'openspec', 'changes', 'demo');
    await fs.writeFile(path.join(changeDir, 'proposal.md'), 'proposal\n');
    await fs.writeFile(path.join(changeDir, 'design.md'), 'design\n');
    await fs.writeFile(path.join(changeDir, 'tasks.md'), '- [x] implement guard\n');

    const result = run(dir, 'guard', 'demo', 'open', '--apply');
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('ALL CHECKS PASSED — ready for next phase');
    expect(result.stderr).toContain('[APPLY] .comet.yaml updated: phase=build');
    expect(run(dir, 'state', 'get', 'demo', 'phase').stdout.trim()).toBe('build');
  });

  it('fails closed for an unknown phase without running checks', async () => {
    const dir = await makeProject();
    run(dir, 'state', 'init', 'demo', 'full');

    const result = run(dir, 'guard', 'demo', 'lint');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Unknown phase: lint');
    expect(result.stderr).toContain('Valid phases: open, design, build, verify, archive');
  });
});
