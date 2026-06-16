# Bundle Authoring 参考

## 创作模式

`/comet-any` 支持两种模式：

- `create`：从用户目标创建新的多 Skill Bundle。
- `optimize`：读取既有候选 Skill，把它们整理为可发布 Bundle。

两种模式都必须使用 `comet bundle` 命令维护状态，不得直接写入内部 JSON 状态。

## 候选读取

1. 优先读取项目 `.comet/skills.txt`。
2. 偏好不存在时，扫描平台 Skill。
3. 通过 `comet bundle candidates --json` 获取 `available`、`missing`、`ambiguous`。
4. 对每个可用候选读取候选 `SKILL.md`。
5. 对缺失或歧义候选暂停询问用户。

候选脚本只能读取，不能执行。

## Bundle 建模

Bundle 必须明确：

- 多个 entry Skill：用户可直接调用的入口。
- internal Skill：仅供 entry 引用或共享流程使用。
- references/rules/hooks/scripts/assets：共享资源图。
- required/optional 能力：用于平台编译和能力缺口展示。
- Engine 元数据：可选，仅描述，不作为执行前提。

不得声称生成的 Skill 需要 Engine 执行。

## CLI 生命周期

常用命令：

```bash
comet bundle candidates --json
comet bundle draft create <name> --json
comet bundle draft optimize <bundle> --json
comet bundle status <name> --json
comet bundle compile <name> --platform <id> --json
comet bundle eval-plan <name> --level quick --json
comet bundle eval-plan <name> --level full --json
comet bundle eval-record <name> --result <file> --json
comet bundle review <name> --approve --reviewer <reviewer> --json
comet bundle review <name> --reject --reviewer <reviewer> --json
comet bundle publish <name> --platform <reference-platform> --json
comet bundle distribute <name> --platform <id> --scope project --json
```

## 分发门禁

- required 能力缺口：取消该平台。
- optional 能力缺口：必须由用户显式选择 skip。
- Hook/脚本披露：必须由用户确认后才可分发。
- 分发前必须询问用户，不能自动执行。
