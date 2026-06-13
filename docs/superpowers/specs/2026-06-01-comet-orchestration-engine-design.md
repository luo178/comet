# Comet Skill Engine - 设计文档

- 初稿日期：2026-06-01
- 重构日期：2026-06-13
- 状态：已完成设计确认，待文档审阅
- 目标版本基线：Comet 0.3.8

## 1. 背景

原设计希望把 Comet 从固定的 OpenSpec + Superpowers 五阶段流程，改造成由 YAML
状态图驱动的通用 Skill 编排引擎。

该方向抓住了“编排不应硬编码在 Skill 散文中”的问题，但在分支开发期间，master
已经补齐了大量稳定性能力：

- `comet-state.sh transition/next/check --recover`
- `auto_transition`
- plan-ready 暂停与恢复
- full/hotfix/tweak 路由与升级
- handoff context、hash 与上下文压缩
- anti-drift rule 与写入 hook
- TDD、debug、review、verification gate
- subagent durable checkpoint
- lightweight/full verification
- branch handling 与 archive confirmation
- 多平台 Skill、rule、hook 分发

因此，原计划中“另建 `.comet.flow.yaml`，再让新引擎逐步替代现有流程”的方案已经
不再成立。它会造成两套状态源、两套恢复逻辑和两套稳定性契约。

本设计重新定义目标：

> Comet 不只是一个手工 workflow 引擎，而是一个创建、执行、恢复和评估复杂 Skill
> 的通用运行时。用户既可手工编排，也可通过 `/comet-any` 让 Agent 根据目标和现有
> Skill 自主组合，但两条路径最终交付同一种可验证的 Comet Skill。

## 2. 产品概念

对外只引入一个核心概念：**Comet Skill**。

- **Manual Skill**：高级用户手工定义内部 Skill Spec。
- **Agentic Skill**：由 `/comet-any` 通过交互澄清、能力探索和 Agent 组合生成。
- **Comet Skill Engine**：执行、约束、持久化、恢复和评估 Comet Skill 的底层引擎。
- **Skill Eval**：创建期 benchmark、grader、人工评审及触发准确率评估。

不把 Orbit、ReAct、Flow 或 Loop 塑造成新的用户级产品名词。ReAct 和 Loop Engineering
仅作为内部架构思想：

```text
Observe -> Decide -> Act -> Record -> Evaluate
   ^                                  |
   +----- continue / replan / wait ---+
```

## 3. 设计目标

### 3.1 双创建路径

```text
手工编排 ------------------+
                           +-> Comet Skill -> Eval -> Ready
/comet-any Agentic 组合 ---+
```

两种方式必须：

- 生成相同结构的 Skill。
- 使用同一个运行时。
- 使用同一个状态模型。
- 经过同一套静态验证、安全检查和评估发布门。

### 3.2 长程稳定运行

Comet Skill 必须能在上下文压缩、进程中断、模型切换和能力来源变化后恢复。稳定性不能
依赖 Agent 记住之前的对话。

### 3.3 受约束的动态规划

Agentic Skill 不是固定状态图。Agent 可以根据观察结果选择能力、追加步骤、重排计划
或回退重试，但不能绕过：

- 权限和能力白名单
- 预算和重试上限
- 用户决策点
- 不可跳过的质量门
- 完成条件与 Evaluator

### 3.4 可评估和可迭代

新 Skill 不能只凭“看起来合理”发布。必须有测试提示、基线对照、可量化 assertion、
人工评审和 benchmark 结果。

## 4. 非目标

- 不要求用户手写复杂状态图。
- 不把任意内联 shell 作为扩展机制。
- 不在 v1 支持并行状态区域或通用分布式任务调度。
- 不复制或直接修改 Superpowers、OpenSpec 的原始 Skill。
- 不维护 classic 与自定义 Skill 两套运行时。
- 不让 Agent 在没有 Policy 和 Evaluator 的情况下无限自主循环。

## 5. Comet Skill 内部模型

Comet Skill 对外仍是普通 Skill 目录，对内增加由引擎消费的机器描述。

```text
<skill-name>/
  SKILL.md
  comet/
    skill.yaml
    capabilities.yaml
    policies.yaml
    evaluators.yaml
  evals/
    evals.json
  scripts/
  references/
  assets/
```

并非每个 Skill 都必须拥有所有可选目录。`/comet-any` 根据实际需求生成最小结构。

### 5.1 Goal

定义：

- Skill 的目标
- 输入和输出
- 成功标准
- 明确非目标
- 可观察的完成条件

Goal 是 Evaluator 判断完成的依据，不能只写成模糊自然语言愿望。

### 5.2 Strategy

Strategy 决定下一步如何产生：

- `manual`：按手工定义的步骤、分支和确认点执行。
- `adaptive`：由 Agent 根据 Goal、Memory 和 Policy 动态决定下一步。

两者使用同一个执行循环。`manual` 不是另一套状态机，只是更低自由度的 Strategy。

### 5.3 Capability

Capability 是统一能力抽象，允许以下 provider：

- Skill
- Tool
- MCP
- subagent
- repository script

每个 Capability 必须声明：

- 稳定标识
- provider 类型
- 实际来源和版本信息
- 输入与输出契约
- 权限和副作用
- 超时、重试及失败语义
- 是否需要用户确认

引擎不直接执行 Skill 的提示词内容，而是返回平台可消费的动作，由 Agent 使用真实的
Skill/Tool/MCP/subagent 能力执行。

### 5.4 Memory

Memory 包含：

- 当前 Goal 和 Strategy
- 当前步骤与迭代次数
- 已执行动作和结果
- 工件路径与 hash
- 用户决策
- 计划变更记录
- 预算消耗
- 恢复摘要
- Evaluator 历史

Memory 必须持久化，不能只存在于聊天上下文。

### 5.5 Policy

Policy 定义 Agent 不得自行改写的边界：

- 能力允许列表
- 文件和命令权限
- 用户确认点
- 最大迭代、重试、token、时间或成本预算
- TDD、debug、review、verification 等质量门
- 允许或禁止的计划变更
- 停止、降级和人工接管条件

### 5.6 Evaluator

运行时 Evaluator 判断：

- 是否取得进展
- 是否偏离 Goal
- 是否重复无效动作
- 当前输出是否满足质量门
- 是否需要重规划、重试、询问用户或停止
- 是否满足最终完成标准

Evaluator 既可使用确定性检查，也可使用 Agent 判断。主观判断必须留下证据和结论，
不能只返回无解释的布尔值。

## 6. Comet Skill Engine

### 6.1 核心循环

引擎每轮执行：

1. **Observe**：读取状态、最近动作、工件、预算和外部变化。
2. **Decide**：由 Strategy 产生候选动作。
3. **Policy Check**：校验权限、确认点、预算和不可跳过规则。
4. **Act**：输出统一 Capability 调用动作，由平台 Agent 真实执行。
5. **Record**：把动作、结果、工件和计划变化写入 Memory。
6. **Evaluate**：判断继续、重规划、等待用户、失败或完成。

### 6.2 引擎动作

动作协议保持小而稳定：

- `invoke_capability`
- `ask_user`
- `await_confirm`
- `record_result`
- `replan`
- `guard_failed`
- `done`

Capability provider 的差异由平台适配器处理，不扩散到核心状态机。

### 6.3 单一写入者

Comet Skill Engine 是 `.comet.yaml` 的唯一状态写入者。

旧 shell 命令暂时保留，但只作为兼容门面调用新引擎，不再实现独立状态转换。

## 7. 状态模型

`.comet.yaml` 继续是唯一运行状态文件，保留 0.3.8 的现有字段，并渐进增加：

```yaml
skill: comet-classic
skill_version: 1
skill_hash: <sha256>
strategy: manual
current_step: build.plan
iteration: 4
pending: null
memory_ref: .comet/memory.jsonl
```

现有字段如 `workflow`、`phase`、`build_mode`、`build_pause`、`verify_result`、
`handoff_context` 等继续存在。经典 Skill 运行时由引擎同步这些兼容投影。

### 7.1 Skill 快照

Skill 启动时将以下信息快照到 change 的 `.comet/`：

- 解析后的 Skill Spec
- Capability 来源、路径和版本
- Policy 与 Evaluator
- Skill hash

恢复时读取快照，不自动跟随后来修改的 Skill 或 `.comet/skills.txt`。升级运行中 Skill
必须走显式升级和兼容校验。

### 7.2 旧 change 自动迁移

首次由新引擎读取旧 change 时：

1. 根据 `workflow` 选择 classic full/hotfix/tweak Skill。
2. 根据 `phase`、`verify_result`、`build_pause`、任务状态等推导 `current_step`。
3. 保存 classic Skill 快照和 hash。
4. 保留 handoff、branch、review、verification、context compression 和 subagent
   checkpoint。
5. 写入迁移版本，确保迁移幂等。

用户无需运行单独的 migrate 命令。

## 8. 项目 Skill 偏好池

项目可创建：

```text
.comet/skills.txt
```

格式为一行一个 Skill 名：

```text
brainstorming
writing-plans
test-driven-development
requesting-code-review
```

语义：

- 表示 `/comet-any` 应优先探索和组合的 Skill。
- 不表示固定顺序。
- 不是严格白名单。
- 稳定性或目标需要时，Agent 可以建议并补充其他 Capability。

解析规则：

- 缺失 Skill：让用户选择安装、替代或忽略。
- 同名多来源：展示路径和描述，由用户消歧。
- 最终选择的来源和版本写入生成 Skill 的 Capability 快照。
- 已生成 Skill 不随偏好文件变化。

## 9. `/comet-any`

`/comet-any` 是 Agentic Skill 创建器，不是临时 workflow runner。

### 9.1 创建流程

1. 读取用户描述和 `.comet/skills.txt`。
2. 发现当前平台可用 Skill、Tool、MCP、subagent 和脚本。
3. 读取候选 Skill 实现，而不只根据名字猜测能力。
4. 交互澄清目标、输入输出、边界、风险和成功标准。
5. 选择 `manual` 或 `adaptive` Strategy。
6. 生成 Comet Skill draft。
7. 静态验证 Skill Spec、Capability、Policy 和路径安全。
8. 运行 Eval Provider。
9. 展示 benchmark 和人工评审界面。
10. 根据反馈迭代，直到通过发布门。
11. 标记 `ready` 并安装到目标平台。

### 9.2 稳定性实践注入

`/comet-any` 根据任务风险和长度选择性注入 Comet 已验证的能力：

- 状态持久化和断点恢复
- 上下文压缩与 handoff
- 用户决策阻塞点
- 防漂移规则
- TDD、systematic debugging、review 和 verification
- bounded retry
- subagent checkpoint
- 预算和停止条件
- branch 和 archive 等资源收尾

这些不是固定五阶段模板。Agent 应根据 Goal 组合适当约束，并在 eval 中验证约束确实
提高结果。

## 10. Skill Eval

### 10.1 发布状态

```text
draft -> eval -> review -> ready
```

未完成 benchmark 和人工评审的 Skill 不得标记为 `ready`。

### 10.2 Eval Provider

提供统一 Eval Provider 接口：

- 优先调用当前平台原生的高级 `skill-creator`。
- 平台缺失完整评估能力时，使用 Comet 兼容 Provider。
- Provider 输出统一格式，至少覆盖：
  - `evals/evals.json`
  - with-skill 与 baseline 结果
  - assertion grading
  - token 和耗时
  - pass rate 与方差
  - benchmark JSON/Markdown
  - 人工评审反馈

Claude 官方 `skill-creator` 的 benchmark、grader、viewer、描述触发优化和盲测能力作为
首个参考 Provider。

### 10.3 两类 Evaluator

- **创建期 Skill Eval**：判断 Skill 相比 baseline 是否有效，决定能否发布。
- **运行期 Evaluator**：判断单次长程执行是否进展、漂移、失败或完成。

两者共享 assertion 和证据理念，但生命周期不同，不能混为一个模块。

## 11. 经典 Comet Skill

现有 OpenSpec + Superpowers 流程改造成首个内置 Comet Skill。

要求：

- 首先完整兼容 0.3.8 行为。
- full、hotfix、tweak 通过同一引擎执行。
- plan-ready、verify-fail、finishing branch、archive confirm、preset upgrade 等决策点
  显式进入 Policy/Strategy。
- handoff、context recovery、hook、subagent checkpoint 等能力继续保留。
- 建立 baseline benchmark，测量当前经典流程的成功率、token、耗时、恢复能力和漂移。
- 根据评估结果改进经典 Skill，而不是假设现有流程已经完善。

经典 Skill 同时承担：

- 兼容迁移目标
- 引擎参考实现
- `/comet-any` 生成长程 Skill 时的稳定性模式样本
- Comet 自身能力的回归基准

## 12. 安全模型

- 禁止 Skill Spec 中内联任意 shell。
- 脚本 Capability 只能引用允许根目录内的仓库文件。
- 路径必须解析、规范化并进行目录边界校验。
- Capability 必须声明副作用和所需权限。
- 高风险动作必须由 Policy 转为用户确认。
- 动态重规划不得增加未授权 Capability 或放宽 Policy。
- 预算耗尽、重复无进展、Evaluator 持续失败时必须停止或请求人工介入。
- Skill 创建与运行的动作轨迹必须可审计。

## 13. 分层架构

```text
                    +----------------------+
手工 Skill Spec --->|                      |
                    |  Comet Skill Package |---> Eval Provider ---> Ready
/comet-any -------->|                      |
                    +----------+-----------+
                               |
                    +----------v-----------+
                    |  Comet Skill Engine  |
                    +----------+-----------+
                               |
        +----------------------+----------------------+
        |                      |                      |
   Capability Providers     Memory/State          Policy/Evaluator
 Skill Tool MCP Agent      .comet.yaml/logs      guards/review/done
```

主要代码边界：

- `src/skill/`：Skill Spec、加载、校验、快照和发现。
- `src/engine/`：循环、状态转换、Memory、Policy、Evaluator。
- `src/providers/`：Capability 与 Eval Provider。
- `src/compat/`：0.3.8 状态映射和 shell 兼容。
- `src/commands/skill.ts`：validate、inspect、run、resume、eval。

最终文件名在实施计划中按当前仓库模式进一步细化。

## 14. 实施顺序

### 阶段 A：Engine Foundation

- 定义 Skill Spec 和统一 Capability。
- 建立 `.comet.yaml` 增量 schema 和 Memory。
- 实现 manual/adaptive Strategy 接口。
- 实现 Policy/Evaluator 和受限动作协议。

### 阶段 B：Classic Migration

- 把 0.3.8 行为写成兼容契约测试。
- 实现旧 change 自动迁移。
- 将 shell 状态机改为兼容门面。
- 迁移 full/hotfix/tweak 到 classic Skill。
- 建立 classic baseline benchmark。

### 阶段 C：Manual Authoring

- 提供手工 Skill Spec。
- 实现 validate、inspect、run、resume、eval。
- 提供项目级 Skill 发现和安装。

### 阶段 D：`/comet-any`

- 实现 `.comet/skills.txt`。
- 能力发现、实现探索和交互消歧。
- 生成 Skill draft。
- 接入 Eval Provider、人工评审和发布门。
- 支持已有 Comet Skill 的增量优化和重新评估。

每个阶段都必须独立可测试和可回滚，不在一次发布中直接删除全部旧脚本。

## 15. 原计划调整结论

原实施计划不能直接执行，应整体重写。具体变化：

| 原计划 | 新设计 |
|---|---|
| `*.flow.yaml` 是产品核心 | Comet Skill 是产品核心，Skill Spec 是内部 IR |
| 用户主要手写 workflow | 同时支持手工定义和 `/comet-any` Agentic 创建 |
| node = one skill | Capability 统一 Skill、Tool、MCP、subagent、script |
| 固定状态图决定下一步 | manual 或受 Policy 约束的 adaptive Strategy |
| `.comet.flow.yaml` 独立状态 | 扩展现有 `.comet.yaml`，保持单一真相源 |
| shell 状态机与新引擎共存 | TS 引擎唯一写状态，shell 仅兼容转发 |
| handoff 等留到后续 | 作为 0.3.8 兼容基线，首轮必须保留 |
| classic 只是 YAML 示例 | classic 是内置 Skill、迁移目标和 benchmark 基准 |
| 测试只覆盖引擎函数 | 增加 baseline、grader、benchmark、人工评审与恢复测试 |
| Skill 生成后即可交付 | 强制 `draft -> eval -> review -> ready` |

旧计划中的纯函数引擎、图校验、状态快照和跨平台 adapter 思想仍可复用，但任务拆分、
数据结构、CLI、状态文件和 classic 迁移方案必须按本设计重新制定。

## 16. 成功标准

- 现有 0.3.8 classic change 可自动迁移并继续运行。
- classic 行为拥有兼容契约和 benchmark，不依赖人工目测。
- 用户可以手工创建并运行 Comet Skill。
- 用户可以通过 `/comet-any` 仅描述目标和候选 Skill，获得可安装的 Comet Skill。
- `/comet-any` 会读取候选 Skill 实现，而不是仅按名称排列。
- 新 Skill 未通过 eval 和人工评审时不能发布为 ready。
- 长程任务可在上下文压缩或进程中断后从持久化 Memory 恢复。
- Agent 动态重规划不能绕过 Policy、预算、确认点和 Evaluator。
- Skill、Tool、MCP、subagent 和安全脚本可通过统一 Capability 协议组合。
