# Comet 项目完整 Wiki

> **Comet** — OpenSpec + Superpowers 双星开发流程自动化框架
> 
> 版本: 0.3.9 | 作者: benym | 许可证: MIT

---

## 目录

1. [项目概述](#1-项目概述)
2. [架构层级](#2-架构层级)
3. [目录结构](#3-目录结构)
4. [核心模块分析](#4-核心模块分析)
5. [调用链分析](#5-调用链分析)
6. [数据流与状态机](#6-数据流与状态机)
7. [Shell 脚本模块](#7-shell-脚本模块)
8. [测试架构](#8-测试架构)
9. [平台支持](#9-平台支持)
10. [Skill 系统](#10-skill-系统)
11. [开发工作流](#11-开发工作流)

---

## 1. 项目概述

### 1.1 什么是 Comet

Comet 是一个 **AI Agent 技能编排框架**,将 OpenSpec(需求管理)和 Superpowers(技术实现)两个独立 Skill 生态系统整合为 **五阶段自动化流水线**:

```
/comet → open → design → build → verify → archive
```

### 1.2 核心价值

- **OpenSpec 管理 WHAT**: 需求探索、proposal 创建、spec 生命周期管理、归档
- **Superpowers 管理 HOW**: 技术设计、brainstorming、实现计划、TDD、代码审查
- **Comet 自动化串联**: 阶段检测、状态机、guard 验证、handoff 生成、自动化归档

### 1.3 解决的问题

1. **状态可恢复**: `.comet.yaml` 记录精确执行阶段,中断后可恢复上下文
2. **自动化文档同步**: handoff/hook/guard 脚本减少人工提醒
3. **阶段守卫机制**: 脚本验证确保阶段转换的可靠性
4. **跨平台兼容**: 支持 29 个 AI 编码平台

### 1.4 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Node.js 20+ |
| 语言 | TypeScript (ESM) |
| CLI 框架 | Commander.js |
| 交互式提示 | @inquirer/prompts |
| 构建工具 | TypeScript Compiler (tsc) |
| 测试框架 | Vitest |
| 代码质量 | ESLint + Prettier |
| Git 钩子 | Husky + lint-staged |
| Shell 脚本 | Bash (跨平台兼容) |

---

## 2. 架构层级

```
┌─────────────────────────────────────────────────────────────┐
│                    用户交互层 (CLI)                          │
│  comet init / status / doctor / update / uninstall           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   命令编排层 (Commands)                       │
│  init.ts → 检测平台 → 安装依赖 → 部署 Skills → 创建工作目录    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   核心服务层 (Core)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │ detect   │ │ platforms│ │ skills   │ │ openspec     │   │
│  │ .ts      │ │ .ts      │ │ .ts      │ │ .ts          │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │superpowers│ │codegraph │ │ uninstall│                   │
│  │ .ts      │ │ .ts      │ │ .ts      │                   │
│  └──────────┘ └──────────┘ └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  工具函数层 (Utils)                           │
│  file-system.ts (文件操作抽象)                                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Skill 资产层 (Assets)                            │
│  ┌──────────────────────────────────────────────┐           │
│  │  Skills (Comet/OpenSpec/Superpowers)         │           │
│  │  Scripts (guard/state/handoff/archive)       │           │
│  │  Rules (phase-guard)                          │           │
│  │  Reference Docs                               │           │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              状态管理层 (.comet.yaml)                         │
│  五阶段状态机 + 配置优先级 (env > project > change)          │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 目录结构

```
comet/
├── bin/                          # CLI 入口
│   └── comet.js                  # #!/usr/bin/env node → dist/cli/index.js
│
├── src/                          # TypeScript 源代码
│   ├── cli/
│   │   └── index.ts              # Commander CLI 定义 (init/status/doctor/update/uninstall)
│   ├── commands/                 # 命令实现
│   │   ├── init.ts               # 初始化命令 (平台检测 → 依赖安装 → Skill 部署)
│   │   ├── status.ts             # 显示活跃 change 状态
│   │   ├── doctor.ts             # 安装健康诊断
│   │   ├── update.ts             # 更新 Comet 包和 Skills
│   │   ├── uninstall.ts          # 安全移除 Comet
│   │   └── i18n.ts               # 国际化翻译函数
│   ├── core/                     # 核心业务逻辑
│   │   ├── detect.ts             # 平台检测逻辑 (检测路径 + Skill 存在性)
│   │   ├── platforms.ts          # 29 个平台定义 (目录/hook/rules 配置)
│   │   ├── skills.ts             # Skill 复制/Rules 格式化/Hook 安装
│   │   ├── openspec.ts           # OpenSpec CLI 安装与初始化
│   │   ├── superpowers.ts        # Superpowers Skills 安装 (npx skills add)
│   │   ├── codegraph.ts          # CodeGraph 语义索引安装
│   │   ├── uninstall.ts          # 卸载逻辑
│   │   ├── version.ts            # 版本信息
│   │   ├── types.ts              # 类型定义 (InstallScope)
│   │   └── command-error.ts      # 错误处理工具
│   └── utils/
│       └── file-system.ts        # 文件系统操作封装
│
├── assets/                       # 打包资产 (安装时复制到目标平台)
│   ├── manifest.json             # 清单文件 (Skills/Rules/Hooks 定义)
│   ├── skills/                   # 英文 Skills
│   │   ├── comet/                # Comet 主 Skill
│   │   │   ├── SKILL.md          # Skill 定义文档
│   │   │   ├── scripts/          # Shell 脚本
│   │   │   │   ├── comet-state.sh       # 状态管理核心
│   │   │   │   ├── comet-guard.sh       # 阶段守卫
│   │   │   │   ├── comet-handoff.sh     # 设计交接
│   │   │   │   ├── comet-archive.sh     # 归档自动化
│   │   │   │   ├── comet-yaml-validate.sh # YAML 校验
│   │   │   │   ├── comet-hook-guard.sh  # Hook 写保护
│   │   │   │   └── comet-env.sh         # 环境变量辅助
│   │   │   ├── reference/        # 参考文档
│   │   │   └── rules/            # 阶段感知规则
│   │   ├── comet-open/           # Phase 1: Open
│   │   ├── comet-design/         # Phase 2: Design
│   │   ├── comet-build/          # Phase 3: Build
│   │   ├── comet-verify/         # Phase 4: Verify
│   │   ├── comet-archive/        # Phase 5: Archive
│   │   ├── comet-hotfix/         # 预设: 热修复
│   │   └── comet-tweak/          # 预设: 小改动
│   └── skills-zh/                # 中文 Skills (结构同 skills/)
│
├── scripts/                      # 辅助脚本
│   ├── postinstall.js            # npm install 后执行
│   ├── prepublish-check.js       # 发布前检查
│   ├── run-bats.js               # BATS 测试运行器
│   └── benchmark-*.mjs           # 性能基准测试
│
├── test/                         # 测试
│   ├── ts/                       # TypeScript 测试 (Vitest)
│   │   └── comet-scripts.test.ts # Shell 脚本集成测试
│   └── shell/                    # Shell 测试 (BATS)
│
├── docs/                         # 文档
│   ├── AUTO-TRANSITION.md        # 自动过渡配置
│   └── CONTEXT-COMPRESSION.md    # 上下文压缩文档
│
├── build.js                      # 构建脚本 (调用 tsc)
├── vitest.config.ts              # Vitest 配置
├── tsconfig.json                 # TypeScript 配置
├── eslint.config.js              # ESLint 配置
├── .prettierrc                   # Prettier 配置
└── package.json                  # 项目元数据
```

---

## 4. 核心模块分析

### 4.1 CLI 入口模块 (`bin/comet.js` + `src/cli/index.ts`)

**职责**: 提供命令行接口,解析参数并分发到具体命令

```typescript
// bin/comet.js
#!/usr/bin/env node
import '../dist/cli/index.js';

// src/cli/index.ts
program
  .command('init [path]')    // 初始化工作流
  .command('status [path]')  // 显示活跃 change
  .command('doctor [path]')  // 诊断安装健康
  .command('update [path]')  // 更新包和 Skills
  .command('uninstall [path]') // 安全移除
```

**关键设计**:
- 使用 `commander` 定义子命令
- 统一错误处理 (捕获 `ExitPromptError` 优雅退出)
- 支持 `--json` 输出结构化数据
- 国际化支持 (i18n)

### 4.2 平台检测模块 (`src/core/detect.ts`)

**职责**: 自动检测项目中已安装的 AI 编码平台

**检测策略**:
```typescript
// 1. 显式检测路径
detectionPaths: ['.github/copilot-instructions.md', ...]

// 2. Skills 目录检测
.claude/skills/ → Claude Code
.cursor/skills/ → Cursor
.qoder/skills/ → Qoder
...

// 3. 插件缓存检测 (Claude Code/Codex/OpenCode)
~/.claude/plugins/cache/*/superpowers/*/skills/
```

**检测函数**:
- `detectPlatforms()`: 扫描所有 29 个平台
- `hasSkills()`: 检查特定组件 (openspec/superpowers/comet)
- `getBaseDir()`: 根据 scope 返回项目或家目录

### 4.3 平台定义模块 (`src/core/platforms.ts`)

**职责**: 定义 29 个平台的元数据和配置

```typescript
interface Platform {
  id: string;              // 平台 ID
  name: string;            // 显示名称
  skillsDir: string;       // 项目级 Skills 目录
  globalSkillsDir?: string;// 全局级 Skills 目录
  detectionPaths?: string[]; // 检测路径
  openspecToolId: string;  // OpenSpec 工具 ID
  rulesDir?: string;       // 规则子目录
  rulesBaseDir?: string;   // 规则基目录 (覆盖)
  rulesFormat?: 'md'|'mdc'|'copilot'; // 规则格式
  supportsHooks?: boolean; // 是否支持 Hook
  hookFormat?: string;     // Hook 配置格式
}
```

**平台分类**:

| Hook 格式 | 支持平台 |
|-----------|---------|
| `claude-code` | Claude Code, Codex, Amazon Q |
| `qoder` | Qoder, Qwen Code |
| `gemini` | Gemini CLI |
| `windsurf` | Windsurf |
| `copilot` | GitHub Copilot |
| `kiro` | Kiro |

### 4.4 Skills 部署模块 (`src/core/skills.ts`)

**职责**: 管理 Skills/Rules/Hooks 的安装

**核心功能**:

#### 4.4.1 Skill 复制
```typescript
copyCometSkillsForPlatform(baseDir, platform, overwrite, languageSkillsDir, scope)
```
- 读取 `manifest.json` 获取文件列表
- 区分脚本文件和普通 Skill (脚本始终从 `skills/` 复制)
- 支持 OpenCode 特殊处理 (生成 commands/)
- 支持 Pi 特殊处理 (生成扩展文件)

#### 4.4.2 Rules 格式化
```typescript
copyCometRulesForPlatform(baseDir, platform, overwrite, scope)
```
- `md`: 直接复制
- `mdc`: 添加 Cursor MDC frontmatter
- `copilot`: 添加 `applyTo: "**"` frontmatter

#### 4.4.3 Hook 安装
```typescript
installCometHooksForPlatform(baseDir, platform, scope)
```
支持 7 种 Hook 格式:
- **Claude Code**: `settings.local.json` → `hooks.PreToolUse[]`
- **Qoder/Qwen**: `settings.json` → `hooks.PreToolUse/hooks[]`
- **Gemini**: `settings.json` → `hooks.BeforeTool[]`
- **Windsurf**: `hooks.json` → `hooks.pre_write_code[]`
- **Copilot**: `.github/hooks/comet-guard.json`
- **Kiro**: `.kiro/hooks/*.kiro.hook`

**Hook 合并策略**:
```typescript
mergeHookGroups(existingGroups, newGroups, scriptRelPaths)
```
- 过滤已管理的 Hook (根据脚本路径识别)
- 按 matcher 分组合并
- 保留用户自定义 Hook

### 4.5 OpenSpec 集成模块 (`src/core/openspec.ts`)

**职责**: 安装和初始化 OpenSpec CLI

**关键流程**:
```
ensureOpenSpecCli() 
  → npm install -g @fission-ai/openspec@latest
  
installOpenSpec(projectPath, toolIds, scope)
  → createOpenSpecAllWorkflowsEnv()  // 临时 XDG_CONFIG_HOME
  → buildOpenSpecInitInvocation()    // openspec init <path> --tools <ids>
  → execFileSync('openspec', args)
  → migrateOpenCodeOpenSpecPaths()   // 修复 OpenCode 路径
```

**特殊处理**:
- 创建临时配置目录启用所有工作流
- 备份/恢复用户原有配置
- OpenCode 全局安装路径迁移 (`~/.opencode/` → `~/.config/opencode/`)

### 4.6 Superpowers 安装模块 (`src/core/superpowers.ts`)

**职责**: 通过 `npx skills add` 安装 Superpowers Skills

**平台映射**:
```typescript
const SKILLS_AGENT_MAP = {
  claude: 'claude-code',
  qoder: 'qoder',
  lingma: null,  // 特殊处理
  ...
};
```

**Lingma 特殊处理**:
```typescript
installSuperpowersForLingma()
  → 临时目录使用 claude-code agent 安装
  → 复制 Skills 到 .lingma/skills/
```

---

## 5. 调用链分析

### 5.1 `comet init` 完整调用链

```
comet init [path]
  ↓
initCommand(targetPath, options)
  ├─ selectLanguage(options)              // 选择语言 (en/zh)
  ├─ detectPlatforms(projectPath)         // 检测已安装平台
  ├─ selectScope(options, lang)           // 选择范围 (project/global)
  ├─ selectPlatforms(detected, options)   // 选择目标平台
  │
  ├─ 为每个平台制定计划:
  │   ├─ hasSkills(..., 'openspec')       // 检查 OpenSpec
  │   ├─ hasSkills(..., 'superpowers')    // 检查 Superpowers
  │   ├─ hasSkills(..., 'comet')          // 检查 Comet
  │   └─ resolveAction()                  // 决定 install/overwrite/skip
  │
  ├─ selectNpmDeps()                      // 选择要安装的依赖
  │
  ├─ installOpenSpec(projectPath, toolIds, scope)
  │   ├─ ensureOpenSpecCli()              // 确保 CLI 可用
  │   ├─ createOpenSpecAllWorkflowsEnv()  // 创建临时环境
  │   ├─ execFileSync('openspec', ...)    // 执行初始化
  │   └─ migrateOpenCodeOpenSpecPaths()   // 路径迁移
  │
  ├─ installSuperpowersForPlatforms()
  │   └─ execFileSync('npx', 'skills', 'add', 'obra/superpowers', ...)
  │
  ├─ 对每个平台执行:
  │   ├─ copyCometSkillsForPlatform()     // 复制 Skills
  │   ├─ copyCometRulesForPlatform()      // 复制 Rules
  │   └─ installCometHooksForPlatform()   // 安装 Hooks
  │
  ├─ installCodegraph()                   // 可选: CodeGraph 索引
  ├─ createWorkingDirs()                  // 创建工作目录
  └─ displaySummary()                     // 显示安装摘要
```

### 5.2 五阶段 Skill 调用链

```
/comet (入口)
  ↓ 自动检测 phase
  ↓
┌─────────────────────────────────────────┐
│ Phase 1: /comet-open                   │
│  ├─ comet-state.sh init <name> <wf>    │  // 初始化状态
│  ├─ 创建 proposal.md/design.md/tasks.md│
│  └─ comet-guard <name> open --apply    │  // 验证并转换
│     ↓ open-complete
│     └─ phase → design (full) 或 build (hotfix/tweak)
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Phase 2: /comet-design                │
│  ├─ comet-handoff <name> design --write│  // 生成 handoff
│  ├─ brainstorming (加载 Skill)          │
│  ├─ 创建 Design Doc                     │
│  └─ comet-guard <name> design --apply  │
│     ↓ design-complete
│     └─ phase → build
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Phase 3: /comet-build                 │
│  ├─ 选择 isolation (branch/worktree)    │
│  ├─ 选择 build_mode                     │
│  ├─ 选择 tdd_mode/review_mode           │
│  ├─ writing-plans → tasks.md            │
│  ├─ 执行实现 (逐个 task)                 │
│  ├─ task-checkoff 验证                  │
│  └─ comet-guard <name> build --apply   │
│     ↓ build-complete
│     └─ phase → verify
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Phase 4: /comet-verify                │
│  ├─ comet-state.sh scale <name>        │  // 评估验证级别
│  ├─ 运行 build/verify 命令              │
│  ├─ 生成 verification_report            │
│  ├─ 处理分支 (branch_status=handled)    │
│  └─ comet-guard <name> verify --apply  │
│     ↓ verify-pass
│     └─ phase → archive
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Phase 5: /comet-archive               │
│  ├─ comet-archive.sh <name>            │
│  │   ├─ 验证入口状态                    │
│  │   ├─ openspec archive <name>        │
│  │   ├─ 标注 Design Doc/Plan frontmatter│
│  │   └─ 移动到 archive 目录             │
│  └─ comet-state.sh transition archived │
│     └─ archived: true
└─────────────────────────────────────────┘
```

### 5.3 Hook 调用链 (`comet-hook-guard.sh`)

```
AI Agent 尝试 Write/Edit 文件
  ↓
平台触发 PreToolUse Hook
  ↓
comet-hook-guard.sh
  ├─ 检查 openspec/changes/<name>/.comet.yaml
  ├─ 读取 phase 字段
  ├─ 如果 phase = open/design/archive:
  │   └─ 拒绝写入 (输出 [HARD STOP])
  └─ 如果 phase = build/verify:
      └─ 允许写入
```

### 5.4 状态转换调用链

```
comet-guard <name> <phase> --apply
  ↓
preflight()
  └─ comet-yaml-validate.sh <name>  // 校验 YAML schema
  ↓
guard_<phase>()  // 执行阶段特定检查
  ├─ check(...)  // 各项检查
  └─ BLOCK 状态
  ↓
如果 ALL CHECKS PASSED && --apply:
  ↓
apply_state_update(phase)
  └─ comet-state.sh transition <name> <event>
      ├─ require_phase()           // 验证当前阶段
      ├─ require_*_evidence()      // 验证证据
      └─ cmd_set phase <next>      // 更新阶段
  ↓
comet-state.sh next <name>
  └─ 输出 NEXT: auto|manual|done
      └─ SKILL: <skill-name>
```

---

## 6. 数据流与状态机

### 6.1 `.comet.yaml` 状态机

```yaml
# 核心状态字段
workflow: full | hotfix | tweak          # 工作流类型
phase: open | design | build | verify | archive  # 当前阶段
archived: true | false                   # 是否已归档

# 配置字段
context_compression: off | beta          # 上下文压缩模式
auto_transition: true | false            # 自动过渡开关
review_mode: off | standard | thorough   # 代码审查级别

# Build 决策字段
build_mode: subagent-driven-development | executing-plans | direct
build_pause: null | plan-ready
isolation: branch | worktree
tdd_mode: tdd | direct
subagent_dispatch: null | confirmed
direct_override: true | false

# 产物路径字段
design_doc: docs/superpowers/specs/...
plan: docs/superpowers/plans/...
verification_report: null | path/to/report
handoff_context: .comet/handoff/design-context.json
handoff_hash: <sha256>

# 验证字段
verify_result: pending | pass | fail
verify_mode: light | full
branch_status: pending | handled
verified_at: null | YYYY-MM-DD
created_at: YYYY-MM-DD
```

### 6.2 状态转换图

```
                    open-complete
  [open] ──────────────────────────────→ [design] (full workflow)
    │                                      │
    │ open-complete                        │ design-complete
    ↓ (hotfix/tweak)                       ↓
  [build] ←──────────────────────────── [build]
    │                                      ↑
    │ build-complete                       │ verify-fail
    ↓                                      │
  [verify] ───────────────────────────────┘
    │
    │ verify-pass
    ↓
  [archive]
    │
    │ archived
    ↓
  [archived] (终态)
```

**转换事件**:
- `open-complete`: open → design (full) 或 open → build (hotfix/tweak)
- `design-complete`: design → build
- `build-complete`: build → verify
- `verify-pass`: verify → archive
- `verify-fail`: verify → build (回滚修复)
- `archive-reopen`: archive → verify (重新验证)
- `archived`: archive → 终态

### 6.3 配置优先级

```
环境变量 (最高)
  ↓
COMET_AUTO_TRANSITION
COMET_CONTEXT_COMPRESSION
COMET_REVIEW_MODE
  ↓
.comet/config.yaml (项目级)
  ↓
.comet.yaml (change 级, 最低)
```

### 6.4 数据流转

```
OpenSpec Artifacts                    Superpowers Artifacts
┌─────────────────┐                  ┌──────────────────────┐
│ proposal.md     │                  │ Design Doc           │
│ design.md       │                  │ Implementation Plan  │
│ tasks.md        │                  │ verification_report  │
│ specs/*/spec.md │                  └──────────────────────┘
└─────────────────┘                           ↓
         ↓                                    ↓
         └────→ comet-handoff.sh ←────────────┘
                    ↓
         生成 handoff_context.json
         生成 handoff_context.md
         计算 handoff_hash (SHA256)
                    ↓
         写入 .comet.yaml
                    ↓
         comet-guard.sh 验证
                    ↓
         comet-archive.sh 归档
```

---

## 7. Shell 脚本模块

### 7.1 `comet-state.sh` — 统一状态管理

**子命令**:
```bash
comet-state.sh init <name> <workflow>    # 初始化 .comet.yaml
comet-state.sh get <name> <field>        # 读取字段
comet-state.sh set <name> <field> <val>  # 更新字段 (带验证)
comet-state.sh transition <name> <event> # 状态转换 (带证据检查)
comet-state.sh check <name> <phase>      # 入口检查
comet-state.sh check <name> <phase> --recover  # 恢复上下文
comet-state.sh scale <name>              # 评估验证级别
comet-state.sh task-checkoff <file> <text> # 验证 task 勾选
comet-state.sh next <name>               # 解析下一步
```

**安全机制**:
- 禁止直接 `set phase` (必须通过 `transition`)
- 路径验证 (拒绝绝对路径和 `..`)
- Enum 验证 (所有枚举字段)
- 动态作用域标志 (`_COMET_IN_TRANSITION=1`)

### 7.2 `comet-guard.sh` — 阶段转换守卫

**检查项**:

| 阶段 | 检查项 |
|------|--------|
| open | proposal.md, design.md (full), tasks.md 存在且非空 |
| design | handoff_context, handoff_hash, design_doc, Design Doc frontmatter |
| build | isolation, build_mode, tdd_mode, review_mode, tasks 完成, build passes |
| verify | tasks 完成, verification_report, branch_status=handled |
| archive | archived=true, 产物完整性 |

**跨平台兼容**:
- 禁止 `sed -i` (使用 `awk`)
- 兼容 `sha256sum` 和 `shasum -a 256`
- `|| true` 防止 `pipefail` 误杀
- Windows Git Bash 检测 (`is_windows_bash()`)

### 7.3 `comet-handoff.sh` — 设计交接

**功能**:
```bash
comet-handoff.sh <name> design --write [--full]
comet-handoff.sh <name> --hash-only
```

**生成产物**:
1. `design-context.json` — 机器可读上下文
2. `design-context.md` — 人类可读摘要
3. `handoff_hash` — SHA256 校验和

**模式**:
- `compact` (默认): 截断长文件 (80 行)
- `full`: 完整包含所有文件
- `beta` (context_compression=beta): 仅投影 spec 文件

### 7.4 `comet-archive.sh` — 归档自动化

**流程**:
1. 验证入口状态 (phase=archive, verify_result=pass)
2. 执行 `openspec archive <name>` (delta spec 合并)
3. 标注 Design Doc 和 Plan frontmatter
4. 移动到 `openspec/changes/archive/<date>-<name>/`
5. 设置 `archived: true`

**安全机制**:
- 验证主 spec 无 delta 标记泄漏
- 支持 `--dry-run` 预览
- 归档目录冲突检测和回退

### 7.5 `comet-yaml-validate.sh` — Schema 校验

**验证项**:
- 必填字段存在性
- Enum 值合法性
- 路径字段存在性检查
- 未知字段检测
- `handoff_hash` 格式验证 (64 位 hex)

### 7.6 `comet-hook-guard.sh` — 写保护 Hook

**功能**: 在 open/design/archive 阶段阻止文件写入

**触发**: PreToolUse Hook (Write|Edit matcher)

---

## 8. 测试架构

### 8.1 TypeScript 测试 (Vitest)

```bash
npx vitest run                                    # 全量测试
npx vitest run test/ts/comet-scripts.test.ts     # 脚本测试
```

**测试配置** (`vitest.config.ts`):
```typescript
{
  include: ['test/ts/**/*.test.ts'],
  exclude: [
    'test/ts/context-compression-benchmark.test.ts',
    'test/ts/context-execution-benchmark.test.ts'
  ],
  coverage: {
    thresholds: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
}
```

### 8.2 Shell 测试 (BATS)

```bash
pnpm test:shell  # 运行 test/shell/*.bats
```

### 8.3 基准测试

```bash
pnpm benchmark:context   # 上下文压缩基准
pnpm benchmark:execution # 执行性能基准
```

---

## 9. 平台支持

### 9.1 支持的 29 个平台

| 平台 | Skills 目录 | Hook 格式 | Rules 格式 |
|------|------------|-----------|-----------|
| Claude Code | `.claude/` | claude-code | md |
| Cursor | `.cursor/` | - | mdc |
| Codex | `.codex/` | claude-code | md |
| OpenCode | `.opencode/` | - | md |
| Windsurf | `.windsurf/` | windsurf | md |
| Cline | `.cline/` | - | md (rulesBaseDir: '') |
| RooCode | `.roo/` | - | md |
| Continue | `.continue/` | - | md |
| GitHub Copilot | `.github/` | copilot | copilot |
| Gemini CLI | `.gemini/` | gemini | - |
| Amazon Q | `.amazonq/` | claude-code | md |
| Qwen Code | `.qwen/` | qwen | md |
| Kilo Code | `.kilocode/` | - | md |
| Auggie | `.augment/` | - | md |
| Kiro | `.kiro/` | kiro | md (steering/) |
| Kimi Code | `.kimi-code/` | - | - |
| Lingma | `.lingma/` | - | md |
| Junie | `.junie/` | - | - |
| CodeBuddy | `.codebuddy/` | - | - |
| CoStrict | `.cospec/` | - | - |
| Crush | `.crush/` | - | - |
| Factory Droid | `.factory/` | - | - |
| iFlow | `.iflow/` | - | - |
| Pi | `.pi/` | - | - |
| **Qoder** | `.qoder/` | **qoder** | **md** |
| Antigravity | `.agents/` | - | - |
| Bob Shell | `.bob/` | - | - |
| ForgeCode | `.forge/` | - | - |
| Trae | `.trae/` | - | md |

### 9.2 Qoder 平台配置

```typescript
{
  id: 'qoder',
  name: 'Qoder',
  skillsDir: '.qoder',
  globalSkillsDir: '.qoder',
  openspecToolId: 'qoder',
  rulesDir: 'rules',
  rulesFormat: 'md',
  supportsHooks: true,
  hookFormat: 'qoder'
}
```

**Hook 安装** (`settings.json`):
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash .qoder/skills/comet/scripts/comet-hook-guard.sh",
            "description": "Block code writes in wrong Comet phase"
          }
        ]
      }
    ]
  }
}
```

---

## 10. Skill 系统

### 10.1 Skill 分类

#### Comet Skills
| Skill | 阶段 | 描述 |
|-------|------|------|
| `/comet` | 入口 | 自动检测阶段并分发 |
| `/comet-open` | 1 | 创建 change (proposal/design/tasks) |
| `/comet-design` | 2 | 深度设计 (brainstorming, Design Doc) |
| `/comet-build` | 3 | 计划与构建 (实现, 提交) |
| `/comet-verify` | 4 | 验证与完成 (测试, 报告) |
| `/comet-archive` | 5 | 归档 (delta spec 同步) |
| `/comet-hotfix` | 预设 | 快速修复 (跳过 brainstorming) |
| `/comet-tweak` | 预设 | 小改动 (跳过 brainstorming 和完整 plan) |

#### OpenSpec Skills
- `/openspec-propose` — 创建 proposal
- `/openspec-explore` — 探索模式
- `/openspec-sync` — 同步 spec
- `/openspec-archive` — 归档 change

#### Superpowers Skills
- `/brainstorming` — 头脑风暴
- `/writing-plans` — 编写计划
- `/executing-plans` — 执行计划
- `/test-driven-development` — TDD
- `/subagent-driven-development` — 子代理驱动
- `/systematic-debugging` — 系统调试
- `/verification-before-completion` — 完成前验证

### 10.2 Skill 触发规范

**中文**:
```
**立即执行:** 使用 Skill 工具加载 <skill-name> 技能。禁止跳过此步骤。
```

**英文**:
```
**Immediately execute:** Use the Skill tool to load the <skill-name> skill. Skipping this step is prohibited.
```

### 10.3 参考文档

Skills 内的 `reference/` 目录提供:
- `auto-transition.md` — 自动过渡配置
- `comet-yaml-fields.md` — 字段完整说明
- `context-recovery.md` — 上下文恢复
- `debug-gate.md` — 异常调试协议
- `decision-point.md` — 决策点指南
- `dirty-worktree.md` — 脏工作区处理
- `file-structure.md` — 文件结构说明
- `subagent-dispatch.md` — 子代理分发

---

## 11. 开发工作流

### 11.1 本地开发

```bash
# 安装依赖
pnpm install

# 开发模式 (监听)
pnpm dev

# 构建
pnpm build

# 测试
pnpm test

# 代码质量
pnpm lint
pnpm format:check
```

### 11.2 提交前检查

仓库配置了 Git pre-commit 钩子:
```bash
# 自动运行 (husky + lint-staged)
git commit → prettier --write src/

# 手动检查
pnpm format:check   # Prettier
pnpm lint           # ESLint
pnpm build          # TypeScript
pnpm test           # Vitest
```

### 11.3 Changelog 规范

```markdown
## What's Changed [x.y.z] - YYYY-MM-DD

### Added / Changed / Fixed / Tests / Removed / Security

- **功能名**: 描述做了什么以及为什么
```

**要点**:
- 版本号与 `package.json` 一致
- 按类型分组: Added → Changed → Fixed → Tests → Removed → Security
- 侧重行为变更 (what + why),非实现细节

### 11.4 Shell 脚本规范

- **禁止** `sed -i` (使用 `awk`)
- 必须兼容 `sha256sum` 和 `shasum -a 256`
- 可选 grep 结果加 `|| true`
- 新增脚本必须加入 `manifest.json` 和测试拷贝列表

### 11.5 双语言 Skill

```
assets/skills/     # 英文版
assets/skills-zh/  # 中文版
```

**流程**: 先写中文版本 → 用户确认 → 修改英文版本

---

## 附录 A: 关键设计决策

### A.1 为什么使用 YAML 而非 JSON 存储状态

- 人类可读可编辑
- 支持注释 (JSON 不支持)
- Skill 文档中易于引用

### A.2 为什么使用 Shell 脚本而非 TypeScript

- 跨平台兼容 (macOS/Linux/Windows Git Bash)
- 无需编译,直接执行
- 与 CI/CD 工具链集成更简单
- AI Agent 可直接理解和调用

### A.3 为什么禁止直接 `set phase`

- 绕过证据检查
- 状态不一致风险
- 破坏状态机可靠性
- 必须通过 `transition` 命令

### A.4 为什么使用 `.comet.yaml` 而非 `.openspec.yaml` 存储工作流状态

- **解耦设计**: OpenSpec 管理 spec 生命周期,Comet 管理执行流程
- **职责分离**: 避免污染 OpenSpec 配置
- **独立性**: Comet 工作流状态不影响 OpenSpec 功能

---

## 附录 B: 常见错误排查

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| `phase 直接设置被拒绝` | 使用了 `set` 而非 `transition` | 使用 `comet-state.sh transition` |
| `handoff_hash 不匹配` | OpenSpec 产物修改后未重新 handoff | 运行 `comet-handoff.sh` |
| `build_mode 不允许` | full 工作流使用 direct 但未设置 override | 设置 `direct_override: true` 或选择其他模式 |
| `verification_report 缺失` | 验证未生成报告 | 运行验证命令并生成报告 |
| `branch_status 未处理` | 分支未合并/清理 | 完成分支处理并设置为 `handled` |

---

## 附录 C: 性能数据

### 上下文压缩效果

| 模式 | Token 节省 | Spec 覆盖率 | 测试通过率 |
|------|-----------|------------|-----------|
| `off` | 基线 | 100% | 100% |
| `beta` | ~25-30% | 95% | 100% |

**大规模任务**: 最多节省 15,000 tokens

---

*文档生成日期: 2026-06-18*
*基于 Comet v0.3.9 分析*
