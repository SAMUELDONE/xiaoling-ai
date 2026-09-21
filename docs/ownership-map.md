# 小灵 AI 所有权图

本文把代码和职责分为三类，避免产品功能与 Kun 上游实现形成不可维护的混合层。
三类是来源和维护方式的分类，不是最终产品身份或“谁的产品”划分：仓库中的
全部代码都属于小灵 AI 的交付物，Kun-derived 只表示部分代码仍保留 Kun 来源，
需要同时维护上游溯源和许可证义务。三类也说明谁负责演进、如何保持契约以及
如何同步上游。它是当前的治理地图，不要求本阶段创建所有列出的目录。

## 来源与维护分类

| 分类 | 负责内容 | 变更要求 |
| --- | --- | --- |
| Kun-derived（来源） | `kun/` runtime、工具执行、Thread/Event 存储、现有通用桌面能力和 Extension 平台 | 可以增加通用能力；必要修改登记上游提交、原因、契约和兼容条件 |
| Shared contract（小灵 AI 契约） | `kun/src/contracts/`、`src/shared/` 以及未来的 adapter contract | 由小灵 AI 维护；改动必须有版本、兼容说明和测试 |
| Xiaoling-owned（新增或改造） | 品牌、产品策略、账号/权限、桌面/手机/微信连接器、商业与运营审计，以及对底座的产品化改造 | 纳入小灵 AI 发布流程；通用底座改造仍需登记来源和同步影响 |

## 当前代码边界

- `kun/` 是 Kun-derived runtime。可以修改 Agent Loop、模型客户端和持久化核心，
  但修改应服务于通用 runtime 能力、正确性、安全性或性能，并通过明确契约暴露；
  小灵 AI 专属的产品逻辑默认放在适配器或产品模块中。若产品形态确实要求直接
  改造核心，则必须在 ADR 中说明边界、契约、测试和同步策略。
- `src/main/runtime/`、`src/preload/`、`src/renderer/src/agent/` 当前属于
  Kun 桌面客户端的既有实现。它们可以被上游更新影响，未经契约和版本化不能
  被当成第三方插件的稳定 API。
- `packages/extension-*` 和 `docs/extensions/` 描述 Kun 扩展机制。新能力优先
  评估是否可以作为扩展或适配器，而不是修改桌面内部状态。
- `src/shared/` 和 `kun/src/contracts/` 是共享协议候选位置。跨客户端的新字段
  必须先在这里定义，再连接 runtime 和客户端。
- 小灵 AI 专属目录暂不预建。首个产品模块落地时，必须在 Pull Request 中声明
  其产品责任、依赖的公开契约和上游同步影响。

## 默认禁止的耦合

- 产品模块未经 ADR 和契约定义直接导入 Kun Agent Loop 内部实现；
- 微信或手机适配器直接读取桌面 renderer store；
- 通过 DOM、窗口截图或 Electron 私有 IPC 复刻对话协议；
- 为一个渠道复制另一套 Thread、Event 或审批状态机；
- 用产品功能提交掩盖上游同步冲突。

如果某个内部能力确实需要成为公共能力，应先补充 port、contract、版本策略和
兼容测试，再把它作为可维护的扩展面，而不是让调用方永久依赖内部实现。

## Patch inventory

凡是必须修改 Kun-derived 区，都要在 `docs/upstream-sync.md` 的 patch inventory
中登记。没有登记的核心 patch 不应进入 `develop`。
