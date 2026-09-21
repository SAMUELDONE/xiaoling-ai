# ADR 0001：以 Kun 作为小灵 AI 的可替换底座

- 状态：已接受为实验产品基线
- 日期：2026-09-21
- 影响范围：仓库边界、上游同步、扩展和适配器

## 背景

小灵 AI 需要一个能够执行代码和工作任务的 Agent runtime，同时希望持续吸收
Kun 的上游能力。若直接把产品逻辑写进 Kun Agent Loop、桌面内部状态或持久化
实现，小灵 AI 会形成高冲突 fork，后续同步成本会快速上升。

当前仓库与 Kun 上游 `master` 在 `e67f656b` 一致，适合先建立边界而不是先制造
产品差异。

## 决策

1. 以 Kun 当前快照作为实验产品底座，并保留上游 Git 历史。
2. 通过 Kun HTTP/SSE runtime、Extension API、MCP 和 Skills 等公开接入面扩展。
3. 将小灵 AI 产品能力放在独立的 adapter、extension 或产品模块中。
4. 将 Thread、Event、Approval、UserInput、Artifact、Attachment、Auth 和
   Capability 视为共享契约；契约改动必须版本化并测试。
5. 使用独立的上游同步分支，批量同步 Kun release，避免产品分支混入上游冲突。
6. 不在本 ADR 中决定手机、微信、Office、计费或具体 UI 的实现方式。

## 结果

### 好处

- Kun 上游更新可以集中在同步分支审查和验证；
- 手机、桌面和微信可以共享 Thread/Event 协议，而不复制 runtime；
- 产品差异可以独立测试、启停和替换；
- 将来替换底座时，主要影响 runtime adapter，而不是全部产品层。

### 代价

- 需要维护 adapter contract、版本兼容和事件映射；
- 某些 Kun 内部能力不能直接复用，必须通过公开扩展面表达；
- 上游同步需要独立的验证和 patch inventory；
- 公开扩展面不足时，必须先补充 ADR 再决定是否修改 Kun-derived 区。

## 未决问题

以下问题留到具体产品需求确认后处理：

- 移动端和微信的身份、网关与部署形态；
- 远程任务的计费、多租户和审计策略；
- Office、浏览器和 Computer Use 的产品优先级；
- 是否需要把某些共享契约提交回 Kun 上游。
