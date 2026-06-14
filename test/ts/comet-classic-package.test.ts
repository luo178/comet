import { describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { loadSkillPackage } from '../../src/skill/load.js';
import { validateSkillPackage } from '../../src/skill/validate.js';

const packageRoot = path.resolve('assets', 'skills-zh', 'comet-classic');
const stableSteps = [
  'full.open',
  'full.design.handoff',
  'full.design.document',
  'full.build.plan',
  'full.build.plan-ready',
  'full.build.configure',
  'full.build.execute',
  'full.build.complete',
  'full.build.fix',
  'full.verify.run',
  'full.verify.branch',
  'full.archive.confirm',
  'full.archive.execute',
  'hotfix.open',
  'hotfix.build.execute',
  'hotfix.build.complete',
  'hotfix.verify.run',
  'hotfix.verify.branch',
  'hotfix.archive.confirm',
  'hotfix.archive.execute',
  'tweak.open',
  'tweak.build.execute',
  'tweak.build.complete',
  'tweak.verify.run',
  'tweak.verify.branch',
  'tweak.archive.confirm',
  'tweak.archive.execute',
  'completed',
];

describe('Chinese comet-classic package', () => {
  it('loads as one deterministic internal Skill with every stable step', async () => {
    const pkg = await loadSkillPackage(packageRoot);

    expect(pkg.definition.metadata).toMatchObject({
      name: 'comet-classic',
      version: '1',
    });
    expect(pkg.definition.orchestration.mode).toBe('deterministic');
    expect(pkg.definition.orchestration.entry).toBe('full.open');
    expect(pkg.definition.orchestration.steps?.map((step) => step.id)).toEqual(stableSteps);
    expect(validateSkillPackage(pkg)).toEqual([]);
  });

  it('declares every invoked public Skill and never invokes itself', async () => {
    const pkg = await loadSkillPackage(packageRoot);
    const declared = new Set(pkg.definition.skills.map((skill) => skill.id));
    const invoked = (pkg.definition.orchestration.steps ?? [])
      .filter((step) => step.action.type === 'invoke_skill')
      .map((step) => step.action.ref);

    expect(declared).toEqual(
      new Set([
        'comet-open',
        'comet-design',
        'comet-build',
        'comet-verify',
        'comet-archive',
        'comet-hotfix',
        'comet-tweak',
      ]),
    );
    expect(invoked.every((ref) => ref && declared.has(ref))).toBe(true);
    expect(invoked).not.toContain('comet-classic');
  });

  it('defines a completion eval for completed Run state', async () => {
    const pkg = await loadSkillPackage(packageRoot);

    expect(pkg.evals).toContainEqual({
      id: 'classic-completed',
      scope: 'completion',
      type: 'state_equals',
      field: 'status',
      equals: 'completed',
    });
    expect(
      pkg.definition.orchestration.steps?.find((step) => step.id === 'completed')?.completionEvals,
    ).toEqual(['classic-completed']);
  });

  it('documents its internal-only and fail-closed contract in Chinese', async () => {
    const source = await fs.readFile(path.join(packageRoot, 'SKILL.md'), 'utf8');

    expect(source).toContain('name: comet-classic');
    expect(source).toContain('Use when');
    expect(source).toContain('内部兼容 Skill');
    expect(source).toContain('不得作为用户命令直接调用');
    expect(source).toContain('失败关闭');
    expect(source).toContain('禁止手工修改 Run 字段');
  });
});
