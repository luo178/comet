---
name: comet-any
description: "创建或优化平台无关的多 Skill Bundle。用 /comet-any 调用，读取候选 Skill，生成 Bundle 草稿，执行 Eval、人工评审、发布与可选分发。"
---

# Comet Any — 多 Skill Bundle 创作

`/comet-any` 用于把多个现有 Skill 或一个新工作流整理成平台无关的 Comet Skill Bundle。Bundle 可以包含多个 entry Skill、internal Skill、规则、Hook、脚本、引用资料、资产，以及可选 Engine 元数据；最终仍以各平台原生 Skill/规则/Hook 方式执行。

<IMPORTANT>
本 Skill 不得声称生成的 Skill 需要 Engine 执行。Engine 只作为可选元数据或未来运行时信息；用户实际分发后仍由目标平台原生执行 Skill、规则、Hook 和脚本。
</IMPORTANT>

## 参考资料

- `comet-any/reference/bundle-authoring.md`：Bundle 创作状态、候选读取、CLI 生命周期。
- `comet-any/reference/eval-provider.md`：Eval 选择、证据格式、creator/provider 回退门禁。

## 硬性门禁

- 只能修改中文 `assets/skills-zh/comet-any/`；英文版必须等用户评审确认后再创建。
- 必须使用 `comet bundle` CLI 维护确定性状态，不得手写 `.comet/bundle-*` 状态文件。
- 必须先展示 Eval 工作量和 token 消耗，再让用户选择 `skip / quick / full Eval`。
- skip 或失败 Eval 时不得进入 ready，不得发布，不得分发。
- 发布前必须人工批准；分发前必须询问用户。
- 原生 `skill-creator` 优先；回退前必须询问用户是否允许 Comet fallback。

## 步骤

### 1. 恢复现有创作状态

先运行：

```bash
comet bundle status <name> --json
```

如果用户尚未提供 `<name>`，先询问 Bundle 名称或询问是否从候选 Skill 推导。若状态存在，按状态继续；若状态不存在，进入下一步。

### 2. 选择 create/optimize 与语言

询问用户选择：

- `create`：从目标描述创建新 Bundle。
- `optimize`：把现有 Skill 或多个候选 Skill 优化成 Bundle。

同时确认默认语言和 locales。至少记录默认 locale；多语言 Bundle 需要说明哪些文件由 locale overlay 覆盖。

### 3. 读取偏好或扫描候选

先读取 `.comet/skills.txt`。如果文件存在，按其中顺序调用：

```bash
comet bundle candidates --json
```

如果偏好不存在，扫描平台 Skill，仍使用 `comet bundle candidates --json` 获取可用、缺失、歧义候选。

### 4. 解决缺失/歧义候选

列出 `missing` 和 `ambiguous` 项，暂停询问用户如何处理。不得静默忽略缺失候选，也不得在多个来源中替用户选择。

### 5. 读取候选的真实实现

读取候选 `SKILL.md`，并按需读取候选引用的 reference、rules、scripts、hooks。这里只读真实实现，绝不执行候选脚本。

### 6. 澄清 Bundle 目标

与用户确认：

- Bundle 目标和使用场景。
- 哪些 Skill 是多个 entry，哪些是 internal Skill。
- 共享资源、安全边界、Hook/脚本副作用。
- 目标平台、required/optional 能力、能力缺口策略。
- 是否需要 Engine 元数据。

### 7. 通过 CLI 初始化草稿

create 模式：

```bash
comet bundle draft create <name> --json
```

optimize 模式：

```bash
comet bundle draft optimize <bundle> --json
```

随后运行：

```bash
comet bundle status <name> --json
```

### 8. 调用原生 creator 或请求回退授权

优先使用原生 `skill-creator` 生成或优化 Bundle 内容。若原生 creator 不可用，必须先说明差异与风险，然后询问用户是否允许 Comet fallback；用户明确同意后才使用回退方式。

### 9. 将 creator 输出适配为 Bundle 源码

把 creator 输出写入草稿目录，形成 `bundle.yaml`、`skills/`、`rules/`、`hooks/`、`scripts/`、`references/`、`assets/` 等结构。多个 entry 与 internal Skill 必须在 manifest 中明确标注。

### 10. 编译并校验

至少对一个参考平台运行：

```bash
comet bundle compile <name> --platform <id> --json
```

如存在能力缺口或可执行披露，必须展示给用户。required 能力缺口会阻塞对应平台；optional 能力缺口必须由用户显式选择 skip。

### 11. 展示 Eval 工作量并询问 skip/quick/full

运行：

```bash
comet bundle eval-plan <name> --level quick --json
comet bundle eval-plan <name> --level full --json
```

向用户解释 quick/full 的 token 消耗、预计运行次数和覆盖范围，然后询问 `skip / quick / full Eval`。选择 skip 时，状态保持 draft，不得继续 ready。

### 12. 记录 Eval 证据

用户选择 quick/full 后，调用 Eval provider，生成结构化结果文件，再运行：

```bash
comet bundle eval-record <name> --result <file> --json
```

Eval 失败或哈希不匹配时停止，回到草稿修复。

### 13. 展示评审摘要并等待显式批准

总结 Bundle entries、internal Skill、能力缺口、可执行披露、Eval 结果和目标平台。必须等待用户明确批准或拒绝。

批准：

```bash
comet bundle review <name> --approve --reviewer <reviewer> --json
```

拒绝：

```bash
comet bundle review <name> --reject --reviewer <reviewer> --json
```

### 14. 发布

只有当前哈希已通过 Eval 且人工批准后，才能运行：

```bash
comet bundle publish <name> --platform <reference-platform> --json
```

### 15. 询问是否分发

发布后询问用户是否分发。不得自动分发。

如果用户同意，先展示平台能力缺口和可执行披露；存在 Hook/脚本时必须取得确认，然后运行：

```bash
comet bundle distribute <name> --platform <id> --scope project --json
```

如用户明确同意可执行披露，加入：

```bash
--confirm-executables
```

如用户明确选择跳过 optional 能力，加入：

```bash
--skip-capability <capability>
```
