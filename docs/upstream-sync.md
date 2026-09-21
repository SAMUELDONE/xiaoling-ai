# Kun 上游同步规则

## 远程与基线

```text
origin   git@github.com:SAMUELDONE/xiaoling-ai.git
upstream https://github.com/KunAgent/Kun.git
```

当前基线：`xiaoling-base-kun-v0.3.10`，对应提交 `e67f656b`。

`upstream` 只用于获取 Kun 上游提交。小灵 AI 的产品提交只进入 `origin` 的
`develop`、功能分支和发布分支。

## 同步流程

1. 从最新 `develop` 创建 `codex/sync-kun-vX.Y.Z`。
2. 获取并核对 `upstream/master` 的目标版本和变更范围。
3. 在同步分支合并上游版本，解决冲突并保留小灵 AI patch 的原因。
4. 更新 Kun 基线标签或待发布基线记录，不修改产品版本标签。
5. 执行与影响范围相符的 typecheck、build、test 和 runtime smoke。
6. 检查共享契约、Extension API 和适配器兼容性。
7. 通过验证后，将同步分支合入 `develop`；未解决的冲突不得进入 `main`。

同步不是把上游零散提交随时 cherry-pick 到产品功能分支。除非是紧急安全修复，
否则按上游 release 批量同步，便于审查差异和回滚。

## 版本记录

至少同时记录三类版本：

| 版本项 | 示例 | 作用 |
| --- | --- | --- |
| Kun baseline | `xiaoling-base-kun-v0.3.10` | 标记可回放的上游底座 |
| Extension API | `v1` | 标记扩展宿主能力范围 |
| Xiaoling adapter contract | `v0` | 标记小灵 AI 适配器与客户端协议 |

小灵 AI 产品发布使用 `xiaoling-vX.Y.Z`，不得用产品标签替代 Kun baseline 标签。

## Patch inventory

必要的 Kun-derived 修改要登记在 Pull Request 或后续专门清单中：

| Patch ID | 上游提交 | 文件/模块 | 原因 | 兼容条件 | 回放验证 |
| --- | --- | --- | --- | --- | --- |
| （暂无） | - | - | - | - | - |

如果一个 patch 只服务于小灵 AI 产品策略，应优先移到 adapter 或 extension，而
不是登记为 Kun 核心长期差异。

## 冲突处理原则

- 先判断冲突是上游内部重构，还是小灵 AI 不该进入底座的产品逻辑。
- 产品逻辑优先外移到适配器或扩展层。
- 共享契约冲突必须保留兼容迁移或明确的版本升级说明。
- 无法证明行为等价时，保留同步分支和证据，不强行合入 `develop`。
- 任何同步都不能覆盖工作区中未提交的用户修改。
