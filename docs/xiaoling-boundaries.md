# 小灵 AI 边界基线

状态：草案基线

适用分支：`codex/foundation-boundaries`

Kun 基线：`xiaoling-base-kun-v0.3.10`

## 目的

小灵 AI 以 Kun 作为可替换的 Agent 底座，但不把产品逻辑深度写入 Kun
核心。本文先冻结所有权、分支、接入面和同步规则，不定义具体功能、界面或
客户端实现。

本文是边界规则，不是完整架构设计。任何新功能都必须先说明它属于哪一层，
以及为什么不能通过现有适配器或扩展边界实现。

## 当前范围

当前阶段只交付以下边界资产：

- 产品与底座的所有权图；
- 分支和 Kun 上游同步规则；
- 可插拔接入面的约束；
- 共享协议的概念清单；
- 许可证与商业授权记录入口。

当前阶段不实现：

- 手机端或微信端功能；
- 新的桌面工作流或 UI；
- Office、浏览器自动化、计费和多租户；
- 新的 Agent Loop、模型路由或持久化系统；
- 竞品功能的直接移植。

## 分支与版本边界

```text
upstream/master
      |
      v
codex/sync-kun-vX.Y.Z  -- 只处理一次 Kun 上游同步
      |
      v
develop                -- 小灵 AI 集成分支
      |
      +--> codex/<feature>  -- 单个产品改动
      |
      v
main                   -- 可发布版本
```

- `main` 只接受可发布、已验证的小灵 AI 版本。
- `develop` 是产品集成分支，不直接承载未验证的功能改动。
- 新开发从 `develop` 创建 `codex/` 前缀分支，并通过 Pull Request 合入
  `develop`。
- `upstream` 只用于读取 Kun 上游，不在上游远程上开发小灵 AI 产品代码。
- 上游同步和产品功能使用不同分支、不同提交和不同 Pull Request。
- Kun 快照标签使用 `xiaoling-base-kun-vX.Y.Z`；小灵 AI 产品版本使用
  `xiaoling-vX.Y.Z`，两者不能混用。

本分支只记录边界规则。第一份功能实现必须从后续的 `develop` 状态重新创建
功能分支，不能把功能顺手追加到本分支。

## 三类所有权

### Kun-derived 区

Kun runtime、线程与事件实现、工具执行、通用桌面工作台和现有扩展平台属于
Kun-derived 区。这里的目标是保持与上游接近，便于按版本回放和同步。

对该区域的必要修改必须满足：

1. 修改原因不能只是在产品层绕开适配器；
2. 记录基于哪个上游提交、影响哪些文件和兼容条件；
3. 修改尽量是可独立回放的小 patch；
4. 上游同步时优先重新放到适配器或扩展层，而不是继续扩大核心差异。

### Xiaoling-owned 区

小灵 AI 自有代码负责品牌和产品策略、账号与权限、渠道连接器、运营审计、
商业策略以及未来的产品差异化能力。这些职责不能反向塞进 Kun Agent Loop、
线程存储或模型客户端。

自有代码的具体目录在首个功能确定后再按模块建立；本阶段不提前复制 Kun 目录
或创建一套平行 runtime。

### Shared contract 区

以下能力是客户端、适配器和 Kun runtime 之间的共享契约：

- Thread / Turn：任务、续跑、取消、恢复和来源 surface；
- Event / SSE：有序事件、序列号、重放和断线恢复；
- Approval / UserInput：高风险操作和结构化用户输入；
- Artifact / Attachment：文件、产物和引用的生命周期；
- Auth / Capability：身份、工作区、线程权限和可用能力；
- Extension / Adapter version：能力版本和兼容范围。

共享契约的改变必须有兼容性说明、测试和 ADR。客户端不应通过读取 Kun 内部
对象来绕过这些契约。

## 可插拔接入原则

优先使用 Kun 已有的 HTTP/SSE runtime、Extension API、MCP 和 Skills 等公开
接入面。以下内容不是小灵 AI 的稳定扩展面：

- Agent Loop 的内部函数和未声明的内部模块；
- Electron 私有 IPC、`window.kunGui` 和 renderer store；
- DOM、CSS 选择器和桌面窗口抓取；
- 未版本化的私有 RPC 或本地 bearer token。

桌面、手机、微信和其他 IM 都是同一 Thread/Event 能力的不同 `clientSurface`。
通道适配器只负责：提交任务、订阅事件、转发审批和用户输入、处理附件与产物、
取消或重试，以及身份和权限映射。

“查看桌面对话”应通过事件、线程快照和产物协议完成，而不是抓取桌面 UI。
远程通道必须经过认证 API 或网关，按用户、工作区、线程和 capability 授权，
并保留 Kun 的 approval 约束。微信或手机不能被视为可信执行环境。

## 上游同步边界

按 Kun release 或明确的上游版本批量同步，不对上游零散提交持续 cherry-pick。
每次同步都应经过独立同步分支、差异检查、兼容性检查和最小验证门禁，再合入
`develop`。详细步骤见 [`upstream-sync.md`](./upstream-sync.md)。

需要长期保留的产品差异应移动到 adapter 或 extension 层。只有无法通过公开
接入面实现、且对所有产品客户端都成立的底层修复，才考虑进入 Kun-derived 区。

## 变更门禁

提交前必须回答：

1. 这项改动属于哪一个所有权区域？
2. 是否依赖了未承诺稳定的 Kun 内部实现？
3. Kun 更新后，改动是否可以单独回放或被适配器吸收？
4. 是否扩大了某个客户端的权限或绕过了 Approval/Capability？
5. 是否需要更新共享契约版本、兼容测试或许可证记录？

如果答案不清楚，先补充 ADR 或边界说明，不直接开始功能实现。
