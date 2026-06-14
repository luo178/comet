import { existsSync, promises as fs, readFileSync } from 'fs';
import path from 'path';
import type { ClassicCommandHandler, ClassicCommandResult } from './classic-cli.js';
import { ensureStrictClassicRuntimeRun } from './classic-runtime-run.js';
import type { ClassicPhase } from './classic-state.js';

function result(exitCode: number, message: string): ClassicCommandResult {
  return { exitCode, stderr: message + '\n' };
}

function allowed(message: string): ClassicCommandResult {
  return result(0, `[COMET-HOOK] allowed: ${message}`);
}

function inputTarget(): string {
  if (process.env.FILE_PATH) return process.env.FILE_PATH;
  if (process.stdin.isTTY) return '';
  const input = readFileSync(0, 'utf8');
  if (!input) return '';
  try {
    const parsed = JSON.parse(input) as { tool_input?: { file_path?: unknown } };
    return typeof parsed.tool_input?.file_path === 'string' ? parsed.tool_input.file_path : '';
  } catch {
    return '';
  }
}

function normalized(value: string): string {
  return value.replaceAll('\\', '/').replace(/\/+/gu, '/');
}

async function projectRelative(target: string): Promise<string> {
  const cwd = normalized(process.cwd());
  let candidate = normalized(target);
  if (path.isAbsolute(target) || /^[A-Za-z]:\//u.test(candidate)) {
    if (candidate.startsWith(`${cwd}/`)) return candidate.slice(cwd.length + 1);
    try {
      const parent = await fs.realpath(path.dirname(target));
      candidate = normalized(path.join(parent, path.basename(target)));
      const physicalCwd = normalized(await fs.realpath(process.cwd()));
      if (candidate.startsWith(`${physicalCwd}/`)) {
        return candidate.slice(physicalCwd.length + 1);
      }
    } catch {
      return candidate;
    }
  }
  return candidate.replace(/^\.\//u, '');
}

async function activeChange(): Promise<string | null> {
  const changesDir = path.join('openspec', 'changes');
  if (!existsSync(changesDir)) return null;
  for (const entry of (await fs.readdir(changesDir, { withFileTypes: true })).sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (!entry.isDirectory() || entry.name === 'archive') continue;
    const changeDir = path.join(changesDir, entry.name);
    if (existsSync(path.join(changeDir, '.comet.yaml'))) return changeDir;
  }
  return null;
}

function isRootMarkdown(relativePath: string): boolean {
  return !relativePath.includes('/') && relativePath.endsWith('.md');
}

function isCometConfig(relativePath: string): boolean {
  return (
    relativePath === '.comet.yaml' ||
    relativePath === 'comet.yaml' ||
    relativePath === '.comet.yml' ||
    relativePath === 'comet.yml' ||
    relativePath.startsWith('.comet/') ||
    relativePath.includes('/.comet/')
  );
}

function openSpecAllowed(relativePath: string, phase: ClassicPhase): string | null {
  if (!relativePath.startsWith('openspec/')) return null;
  const stateFile =
    relativePath.endsWith('/.comet.yaml') || relativePath.endsWith('/.openspec.yaml');
  const proposal =
    relativePath.endsWith('/proposal.md') ||
    relativePath.endsWith('/design.md') ||
    relativePath.endsWith('/tasks.md');
  const handoff = relativePath.includes('/.comet/');
  const specs = relativePath.includes('/specs/');

  if (phase === 'open' && (proposal || stateFile || handoff || specs)) {
    return `${relativePath} (phase: open, openspec artifacts)`;
  }
  if (phase === 'design' && (proposal || stateFile || handoff || specs)) {
    return `${relativePath} (phase: design, handoff/spec)`;
  }
  if (phase === 'build' && (relativePath.endsWith('/tasks.md') || stateFile || specs)) {
    return `${relativePath} (phase: build, spec/tasks)`;
  }
  if (phase === 'verify' && (relativePath.endsWith('/tasks.md') || stateFile)) {
    return `${relativePath} (phase: verify, tasks/state)`;
  }
  if (phase === 'archive' && stateFile) {
    return `${relativePath} (phase: archive, state)`;
  }
  return null;
}

function blocked(relativePath: string, phase: ClassicPhase): ClassicCommandResult {
  const guidance =
    phase === 'open'
      ? [
          '  ❌ open 阶段不允许写源代码',
          '  ✅ 允许: 创建 proposal/design/tasks, 运行 guard',
          '  💡 完成需求澄清和 artifact 创建后运行 guard --apply',
        ]
      : phase === 'design'
        ? [
            '  ❌ design 阶段不允许写源代码',
            '  ✅ 允许: brainstorming, 创建 Design Doc, 运行 guard',
            '  💡 完成 Design Doc 后运行 comet-guard design --apply 进入 build',
          ]
        : ['  ❌ archive 阶段不允许写源代码', '  ✅ 允许: 确认归档, 运行归档脚本'];
  return result(
    2,
    [
      '',
      '╔══════════════════════════════════════════╗',
      '║     COMET PHASE GUARD — WRITE BLOCKED    ║',
      '╚══════════════════════════════════════════╝',
      '',
      `  当前阶段: ${phase}`,
      `  目标文件: ${relativePath}`,
      '',
      ...guidance,
      '',
    ].join('\n'),
  );
}

export const classicHookGuardCommand: ClassicCommandHandler = async () => {
  const target = inputTarget();
  if (!target) return allowed('no file path in tool input');
  const relativePath = await projectRelative(target);
  const changeDir = await activeChange();
  if (!changeDir) return allowed('no active comet change');

  if (isCometConfig(relativePath)) {
    return allowed(`${relativePath} (whitelist: comet config)`);
  }
  if (relativePath.startsWith('.claude/')) {
    return allowed(`${relativePath} (whitelist: claude config)`);
  }
  if (
    relativePath === 'CLAUDE.md' ||
    relativePath === 'CHANGELOG.md' ||
    relativePath === 'README.md' ||
    isRootMarkdown(relativePath)
  ) {
    return allowed(`${relativePath} (whitelist: root markdown)`);
  }

  let phase: ClassicPhase;
  try {
    phase = (await ensureStrictClassicRuntimeRun(changeDir)).classic.phase;
  } catch (error) {
    return result(
      2,
      `[COMET-HOOK] blocked: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const openSpec = openSpecAllowed(relativePath, phase);
  if (openSpec) return allowed(openSpec);
  if (
    relativePath.startsWith('docs/superpowers/') &&
    (phase === 'design' || phase === 'build' || phase === 'verify')
  ) {
    return allowed(`${relativePath} (phase: ${phase}, superpowers)`);
  }
  if (phase === 'build' || phase === 'verify') {
    return allowed(`${relativePath} (phase: ${phase})`);
  }
  return blocked(relativePath, phase);
};
