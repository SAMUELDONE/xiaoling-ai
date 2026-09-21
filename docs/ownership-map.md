# 小灵 AI 所有权图

本文把代码和职责分为三类，避免产品功能与 Kun 上游实现形成不可维护的混合层。
它是当前的治理地图，不要求本阶段创建所有列出的目录。

## 所有权分类

| 区域 | 负责内容 | 变更要求 |
| --- | --- | --- |
| Kun-derived | `kun/` runtime、工具执行、Thread/Event 存储、现有通用桌面能力和 Extension 平台 | 尽量保持接近上游；必要修改登记上游提交、原因和兼容条件 |
| Shared contract | `kun/src/contracts/`、`src/shared/` 以及未来的 adapter contract | 只放跨层协议；改动必须有版本、兼容说明和测试 |
| Xiaoling-owned | 品牌、产品策略、账号/权限、桌面/手机/微信连接器、商业与运营审计 | 放在适配器、扩展或产品模块中，不写入 Kun Agent Loop |

## 当前代码边界

- `kun/` 是 Kun-derived runtime。除非先证明公开扩展面无法满足需求，否则不在
  Agent Loop、模型客户端和持久化核心中加入小灵 AI 产品逻辑。
- `src/main/runtime/`、`src/preload/`、`src/renderer/src/agent/` 当前属于
  Kun 桌面客户端的既有实现。它们可以被上游更新影响，不能被当成第三方插件的
  稳定 API。
- `packages/extension-*` 和 `docs/extensions/` 描述 Kun 扩展机制。新能力优先
  评估是否可以作为扩展或适配器，而不是修改桌面内部状态。
- `src/shared/` 和 `kun/src/contracts/` 是共享协议候选位置。跨客户端的新字段
  必须先在这里定义，再连接 runtime 和客户端。
- 小灵 AI 自有目录暂不预建。首个产品模块落地时，必须在 Pull Request 中声明
  其所有权、依赖的公开契约和上游同步影响。

## 禁止的耦合

- 产品模块直接导入 Kun Agent Loop 内部实现；
- 微信或手机适配器直接读取桌面 renderer store；
- 通过 DOM、窗口截图或 Electron 私有 IPC 复刻对话协议；
- 为一个渠道复制另一套 Thread、Event 或审批状态机；
- 用产品功能提交掩盖上游同步冲突。

## Patch inventory

凡是必须修改 Kun-derived 区，都要在 `docs/upstream-sync.md` 的 patch inventory
中登记。没有登记的核心 patch 不应进入 `develop`。
