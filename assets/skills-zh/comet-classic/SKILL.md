---
name: comet-classic
description: "Use when Comet 内部需要恢复、迁移或推进 full、hotfix、tweak 经典工作流 Run；不得用于用户直接调用。"
---

# Comet Classic

`comet-classic` 是 Comet Engine 使用的内部兼容 Skill。它把既有
full、hotfix、tweak 流程映射为稳定步骤，但不替代用户面对的 `/comet*`
命令。

## 调用边界

- 不得作为用户命令直接调用。
- 用户仍调用 `/comet`、`/comet-open`、`/comet-design`、`/comet-build`、
  `/comet-verify`、`/comet-archive`、`/comet-hotfix` 或 `/comet-tweak`。
- 进入本 Skill 前必须先由 `ensureClassicRun()` 完成旧状态迁移和双投影校验。
- 当前步骤必须由 Classic Resolver 根据 `.comet.yaml` 与结构化 evidence
  计算，不得根据对话历史猜测。

## 执行规则

1. 重新读取已校验的 ClassicState、RunState 和 evidence。
2. 只执行 `current_step` 对应 action。
3. action 指向公开 Comet Skill 时，完整遵守该 Skill 的用户确认点和退出条件。
4. action 完成后，由 Classic runtime 原子更新旧字段与 Run 字段并写入
   Trajectory。
5. 重新收集 evidence，再由 Resolver 计算下一步骤。
6. 到达 `completed` 后运行 completion eval，不再调度其他 Skill。

## 稳定性约束

- 禁止手工修改 Run 字段。
- 禁止只更新旧字段或只更新 Run 字段。
- 禁止绕过 Resolver 自行选择下一步骤。
- 禁止在 evidence 缺失、状态矛盾、snapshot hash 不匹配时继续。
- 禁止重复执行存在歧义的 archive 或其他不可逆操作。
- 迁移、恢复或 transition 无法证明安全时必须失败关闭，并保留原状态。

## 恢复语义

- handoff 文本读取自 Context。
- 长程任务进度读取自 Artifact 与 checkpoint。
- 未完成或可恢复操作读取自 PendingWork。
- Trajectory 是追加式审计记录，不作为可手工编辑的状态来源。
- 重复进入同一 change 必须复用原 `run_id` 和 Skill snapshot。

本 Skill 只定义兼容执行协议。具体设计、构建、验证和归档行为仍由对应的
公开 Comet Skill 负责。
