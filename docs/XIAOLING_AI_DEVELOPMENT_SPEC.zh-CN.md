# 小灵 AI 软件开发说明书

版本：`v0.1.0`<br>
状态：当前实现基线<br>
日期：2026-09-24<br>
适用仓库：`SAMUELDONE/xiaoling-ai`<br>
当前基线分支：`codex/xiaoling-runtime-contract`<br>
代码包版本：`0.3.9`（`package.json`）

## 1. 文档定位

这不是宣传稿，也不是只记录愿望的产品路线图。本文是小灵 AI 当前代码、架构边界、
开发流程和验收门禁的共同参照。代码是行为的最终事实；文档用来解释代码的边界、
状态、兼容要求和后续变更方式。

### 1.1 真实性规则

- **已实现**：当前分支存在代码，并通过了与该能力相称的自动化或手工验证。
- **部分实现**：代码路径已经存在，但仍有平台、账号、部署、异常或生产验证缺口。
- **规划中**：产品方向已确认，但当前仓库不能作为该能力已交付的证据。
- **不在范围**：当前版本明确不承诺，不得在界面、发布说明或销售材料中暗示已支持。
- 任何能力状态都必须注明日期；上游、模型供应商和第三方平台变化后要重新验证。
- “有配置入口”不等于“第三方登录成功”，“有协议”不等于“已完成商业化部署”。
- 本文不得写入 API key、OAuth token、cookie、私钥、聊天导出中的敏感内容或真实用户数据。

### 1.2 更新规则

影响用户行为、公共协议、配置、数据迁移、权限、第三方渠道或发布流程的代码变更，
必须在同一 Pull Request 更新本文或其明确链接的专门文档。每次更新至少写明：

| 字段 | 要求 |
| --- | --- |
| 变更内容 | 用用户可理解的语言说明行为变化 |
| 实现范围 | 列出模块、端点、配置和迁移 |
| 状态 | 已实现、部分实现、规划中或不在范围 |
| 验证 | 测试命令、手工步骤、平台和结果 |
| 兼容性 | 旧配置、旧客户端、上游同步和回滚影响 |
| 版本 | 产品版本、契约版本或迁移版本 |

### 1.3 完整性的边界

本文是产品级开发说明书，不是逐个复制所有内部函数和所有端点字段的源码索引。它冻结
产品边界、用户可见能力、共享契约、配置和验收规则；字段级 schema、节点清单、平台差异
和专项故障排查由关联专门文档维护。本文与代码行为冲突时，应把它视为文档漂移，在同一
变更中修正文档，而不是把冲突解释成“规划能力”。

## 2. 产品定义

小灵 AI 是一个本地优先的桌面 Agent 工作台。它把模型供应商、代码与工作区操作、
设计任务、扩展、MCP、Skills、定时任务和 IM 入口统一到一个可审计的 Thread/Event
运行时中。桌面端是当前主要交付形态；其他客户端通过同一运行时协议接入，而不是各自
复制一套 Agent Loop。

### 2.1 最终产品身份

- 产品名、用户界面、发布物、版本号和维护责任主体是 **小灵 AI**。
- Kun 是当前可演进、可替换的 Agent 底座和上游来源，不是第二个并列产品。
- Kun-derived 代码可以修复、重构或替换，但必须保留来源、许可证、同步理由和验证证据。
- 产品差异化能力优先放在小灵 AI 的产品模块、adapter 或 extension 中。

### 2.2 目标用户和工作任务

- 需要在本机代码仓库中完成阅读、修改、测试和审查的开发者；
- 需要在工作区中编辑文档、写作、检索资料或生成设计稿的知识工作者；
- 需要从受控 IM 渠道提交任务、接收进度、处理审批和取得产物的远程用户；
- 需要通过多个模型供应商、订阅通道或自定义中转选择模型的高级用户。

### 2.3 当前非目标

以下内容不能从当前代码推断为已经交付：

- 原生 iOS/Android 应用或完整手机端产品；
- 通过手机或微信直接镜像桌面画面、抓取桌面 DOM 或控制任意窗口；
- 面向公众的云端网关、账号体系、多租户、计费、配额售卖和运营后台；
- 所有供应商的订阅登录都永久有效，或不受地区、额度、风控和服务条款影响；
- 任何未经授权的第三方账号继承、凭据绕过或模型服务代理。

## 3. 当前实现状态总览

| 产品面 | 状态 | 当前事实和限制 |
| --- | --- | --- |
| 小灵 AI 品牌与桌面壳 | 已实现 | Electron 应用、产品名和桌面标题已切换到小灵 AI 体系 |
| GUI + TUI/CLI Runtime 协议 | 已实现 | 桌面 GUI、`kun` TUI/CLI 共享 Thread、计划、审批和后台任务；正常启动时各自拥有受监督 Runtime，当前不再单独分发新版 TUI 压缩包 |
| 首次配置供应商画廊 | 已实现（本分支） | Cover Flow、搜索、键盘/拖拽切换、自定义中转、标准 API 连接探测和模型选择已实现；专用订阅授权仍由各自流程处理 |
| 27 个首次配置入口 | 已实现（本分支） | 1 个 DeepSeek、25 个预置目录项、1 个自定义中转；入口不代表每项都已生产验收 |
| Code（含 Design 任务） | 已实现 | 使用唯一 Kun-compatible Runtime、Thread/Event 和工具权限边界 |
| Work 工作区 | 已实现 | 写作、选区助手、FIM/检索等代码路径存在；模型和编辑器集成需按平台回归 |
| Office/文档/演示工作流 | 已实现（代码级） | Markdown、PDF/Word/PowerPoint/电子表格检索与分析，以及文档/演示导出存在；Office 源文件默认只读，格式依赖本机能力 |
| Workflow、Loops、Hooks | 已实现（代码级） | 支持手动、定时、Webhook、Agent Hook 和循环节点；需遵守本地端口、secret、递归与资源上限 |
| 浏览器/Computer Use/终端/Git | 部分实现 | 工具和桌面工作台路径存在；Computer Use/Design 等 GUI 能力不能向 TUI、API、IM 无条件开放 |
| Remote SSH | 部分实现 | 可保存主机、校验 host key、建立远端终端；远程文件编辑、网络策略和生产运维仍需专项验收 |
| 数据迁移、会话导入导出 | 已实现（代码级） | `.kunpack` 工作区/会话迁移、memory 和产物相关导出存在；跨版本导入必须按迁移报告验收 |
| Connect phone / IM | 部分实现 | Feishu/Lark、WeChat bridge、Telegram 等适配路径存在；部署和外网网关不是本版本承诺 |
| Thread、Turn、SSE、审批、结构化输入 | 已实现 | Runtime HTTP/SSE 公共边界和持久化事件模型已存在 |
| Agent、Subagent、Profile 和用量 | 已实现 | 共享/按 surface 的 Agent profile、`delegate_task`、Fast Context、一次回退和 usage/trajectory 查询存在 |
| 多模态能力 | 部分实现 | 语音转文字、文字转语音、图像、视频、音乐和视觉模型有 provider 能力路径；具体供应商能力需逐项验证 |
| MCP、Skills、Extensions | 已实现 | 通过 Runtime 和 Extension API 接入；每项扩展仍受权限和能力快照约束 |
| Graph / 项目 Agent | 已实现（高级能力） | 有独立 Graph 路由和事件；产品 UI、恢复与发布验证需随改动回归 |
| 记忆、知识库、附件、产物 | 已实现（能力级） | 需遵守作用域、生命周期、路径和敏感数据边界 |
| 定时任务 | 已实现（代码级） | 本地调度和 IM 触发路径存在；云端托管和跨设备唤醒不在范围 |
| ChatGPT/Claude/Gemini/Cursor/Grok 订阅 | 部分实现 | 有相应 transport/credential 路径；登录、地区、额度和官方政策需逐项验证 |
| 自定义 API/中转 | 已实现 | Base URL、模型名、Endpoint Format 和 API key 可配置；安全与服务质量由用户承担 |
| 原生移动 App | 规划中 | 先复用 Thread/Event 协议，不在桌面 UI 上做远程抓屏 |
| 商业化账号、计费、多租户 | 不在范围 | 需要单独身份、授权、审计、计费和部署设计 |
| 设置与运维 | 已实现（代码级） | Provider、Write、媒体、Agent、Subagent、归档、Worktree、Memory、IM、快捷键、更新、Terminal 和数据迁移设置均有代码入口 |

## 4. 用户可见产品结构

### 4.1 桌面端入口

- **Code**：创建、恢复、搜索、归档、fork 和继续 Thread；流式查看回复；执行文件、
  搜索、Shell、Git、浏览器或计算机使用等受控工具；处理审批、用户输入和中断。
- **Design**：在同一 Thread/Event 边界中创建和迭代设计稿、画布、图表、SVG 或原型；
  不创建第二套运行时。
- **Work**：打开工作区，编辑文本，使用选区助手、inline completion、检索和写作工具。
- **Connect phone**：配置 IM/手机连接、通道、模型、工作区和 Agent profile；代码内部
  仍保留 `claw` 命名作为兼容标识。
- **Settings**：模型供应商、Agent 权限、MCP、Skills、Extensions、工作区、更新、主题、
  IM、定时任务和其他运行时配置。

### 4.2 终端、自动化和系统入口

- **TUI/CLI**：开发态使用 `npm run dev:tui`；安装包内使用 `kun` 命令。默认 TUI 拥有自己
  的 Runtime，`--url` 和 `--no-start` 是明确的不拥有 Runtime 的连接模式；同一
  `(dataDir, flavor)` 槽位不能被第二个正常 GUI/TUI 抢占。
- **Workflow**：在工作流画布中组合 AI、条件、分支、过滤、代码、HTTP、模板、子工作流、
  审批、图像生成、循环和输出节点；可由手动、计划、Webhook 或 Agent Hook 触发。
- **Loops/Hooks**：Loop 支持条件收敛和 foreach 批处理；Hook 可在 Agent 生命周期或工具
  阶段触发工作流，并有递归防护。Hook 命令来自可信的本地 `config.json`，不能当作远程不可信输入。
- **系统连接**：终端、Git/Worktree、浏览器使用、Computer Use、Remote SSH、通知、更新和
  数据迁移都由 Main/Preload 的受控接口提供，不应绕过 IPC 直接访问 Node 或本地凭据。

### 4.3 首次配置供应商画廊

当前画廊的 27 个入口由 `InitialSetupDialog`、`initial-setup-dialog-support`、
`initial-setup-provider-showcase` 和 `initial-setup-save` 共同实现：

| 分类 | 入口 |
| --- | --- |
| 默认入口 | DeepSeek |
| API/兼容接口 | LiteLLM、LongCat、Volcano Ark API、ZenMux API、Moonshot CN、Moonshot Global、Xiaomi、MiniMax、Aliyun、Tencent Cloud、Vercel AI Gateway |
| 免费入口 | OpenCore Free |
| 订阅/官方 SDK 或 CLI | Claude Pro/Max、Google Antigravity、Gemini CLI、Cursor、Ollama Cloud、智谱 Coding Plan、Z.ai Coding Plan、Kimi Code、Volcano Ark Agent Plan、Volcano Ark Coding Plan、OpenCode Go、ChatGPT、Grok |
| 自定义 | 自定义中转 |

注：token plan 是同一预置的另一种 profile，不应被误写成额外的独立供应商或画廊卡片。
精确目录以 `src/shared/model-provider-preset-catalog*.ts` 为准；
入口数量变化时，必须同步测试和本文。

当前交互包括：

- 卡片 Cover Flow 视觉、当前项高亮、供应商图标、类型和模型数量提示；
- 按供应商名、描述、类别、访问方式和模型名搜索；
- 上一项/下一项、左右方向键、Home/End、拖拽和滚轮切换；
- “查看全部”列表、无结果状态、键盘焦点和选中状态；
- API key、订阅凭据、免 key 预置和自定义中转表单；
- 自定义模型名、Base URL、Endpoint Format 和 API key；
- 普通 HTTP API、免 key HTTP Provider 和标准兼容中转可在保存前测试连接，并发现、选择模型；所选模型会同步写入 Provider Profile、Runtime 和共享凭据注册表；
- 官方 ChatGPT/Codex Profile 使用现有专用模型目录探测；Claude SDK、Antigravity/Gemini CLI、Cursor SDK 等委托式传输不会误走普通 `/models`；
- `custom_endpoint` 和不提供标准模型目录的服务保留手动模型配置；探测失败不等同于阻断保存，仍由保存后的 Runtime 启动验证；
- 保存时写入共享模型连接注册表，并把选定 profile 接到 Kun runtime；
- 免 key 供应商不强制要求填写 API key，但是否能实际调用仍由供应商认证决定。

模型探测使用 Main 进程现有 `provider:probe` IPC，API key 不离开 Main 进程；探测状态按当前 Profile 配置指纹关联，修改凭据、地址、接口格式、地区或 Provider 后旧结果不再生效。当前自动化测试不代表 25 个预置 Provider 均已完成真实账号和网络验收。

## 5. 总体架构

```text
React Renderer
  Code / Design / Work / Connect phone / Settings
        |
        | window.kunGui.runtimeRequest + startSse
        v
Electron Preload IPC bridge
        v
Electron Main
  RuntimeHost / kunRuntimeAdapter / service coordination
        v
Kun-compatible HTTP/SSE Runtime
  Thread store / Agent loop / model clients / tools / approvals
        v
Service Manager + 本地持久化 + 文件/SQLite 投影
```

### 5.1 目录职责

| 目录 | 责任 |
| --- | --- |
| `src/renderer` | React UI、Zustand/store、Code/Design/Work/Connect phone 交互 |
| `src/preload` | 受控 IPC 和 `window.kunGui` 桥接，不暴露任意 Node 能力 |
| `src/main` | Electron 生命周期、RuntimeHost、IPC、更新、IM、扩展宿主和系统能力 |
| `src/shared` | 设置类型、provider catalog、迁移、共享数据模型和跨端常量 |
| `kun/src/contracts` | Thread、事件、策略、能力、模型和运行时公共契约 |
| `kun/src/server` | 本地 Runtime HTTP 路由、鉴权、SSE 和服务编排 |
| `kun/src/loop`、`services`、`ports`、`adapters` | Agent Loop、服务、端口和可替换实现 |
| `packages/*` | Extension API、provider catalog 等可独立构建的包 |
| `docs` | 架构、边界、上游同步、专项设计和本说明书 |

### 5.2 运行时生命周期

- GUI 在启用自动启动且目标 `(canonical dataDir, runtime flavor)` 槽位空闲时，
  启动并监督一个精确的 Kun Runtime 子进程。
- GUI、TUI、CLI、API、IM 和 Extension 都通过同一协议工作；不再创建第二套 Agent Loop。
- 同一 profile 槽位有活动 owner 时，其他客户端必须报告 ownership conflict，不能抢占、
  静默替换或杀掉已有 Runtime。
- 应用真正退出时先停止恢复调度，再优雅关闭其拥有的 Runtime；隐藏、最小化或 macOS
  无窗口不等于退出。
- Service Manager 负责选举、租约和持久化协调，不执行 Agent turn。
- Runtime 重启、resume、fork 和 compaction 必须保留事件顺序、权限快照和可恢复游标。

## 6. 共享协议和数据流

### 6.1 Thread/Turn/Event

1. 客户端创建或选择 Thread，并提交带 `clientSurface`、workspace、provider/model、
   能力快照和用户内容的 Turn。
2. Runtime 校验身份、工作区、能力、模型和队列状态，写入持久化事件后执行 Agent Loop。
3. 客户端订阅 `/v1/threads/:id/events`，按序列号接收增量事件，并在断线后用 `since_seq`
   或 timeline 重新获取，而不是猜测当前 UI 状态。
4. 工具调用、审批、用户输入、模型输出、产物和错误都进入同一事件时间线；完成、取消、
   中断和失败必须有明确终态。
5. 手机、微信或其他 IM 只做事件订阅和命令映射，不读取 renderer DOM、不抓取桌面窗口。

### 6.2 必须保持稳定的契约

- **Thread / Turn**：任务、来源 surface、工作区、恢复、取消、重试和 fork；
- **Event / SSE**：有序序列号、重放、断线恢复、终态和错误；
- **Approval / UserInput**：高风险工具和结构化输入的请求、决定、超时、取消；
- **Artifact / Attachment**：产物所有权、MIME、大小、可用性、来源和生命周期；
- **Auth / Capability**：身份、工作区、线程权限、工具 allowlist 和能力版本；
- **Extension / Adapter**：能力版本、兼容范围、启停、诊断和回滚。

### 6.3 主要 Runtime 路由族

当前实现的路由以 `kun/src/server/routes/register-core-routes.ts`、
`register-thread-routes.ts`、`register-resource-routes.ts`、
`register-graph-routes.ts`、Extension 路由和 `src/shared/kun-endpoints.ts` 为准，
代表性接口包括：

| 路由族 | 用途 |
| --- | --- |
| `/v1/threads` | 创建、列表、搜索、更新、删除、fork、summary、timeline、state |
| `/v1/threads/:id/turns` | 提交、读取、排队、steer、interrupt、cancel、review |
| `/v1/threads/:id/events` | SSE 事件流和断线恢复 |
| `/v1/models`、`/v1/chat/completions`、`/v1/responses` | OpenAI-compatible 模型网关 |
| `/v1/model-connections*`、`/v1/model-routes/*`、`/v1/model-gateway/*` | 模型连接、路由和凭据管理 |
| `/v1/runtime/*`、`/v1/mcp/*`、`/v1/migrations/*` | Runtime 能力、MCP 和数据迁移 |
| `/v1/approvals/:id` | 审批决定 |
| `/v1/user-inputs/:id` | 结构化用户输入决定 |
| `/v1/sessions/:id/resume-thread` | 会话恢复 |
| `/v1/usage`、`/v1/provider-quotas` | 用量和额度读取 |
| `/v1/threads/:id/model-requests`、`/v1/threads/:id/trajectory*` | 模型请求、工具/模型轨迹和摘要查询 |
| `/v1/thread-activity/events`、`/v1/session-health`、`/v1/debug/llm-rounds` | 会话可观测性和调试 |
| `/v1/workspace/status` | 工作区、权限和 Runtime 状态 |
| `/v1/attachments`、`/v1/memory` | 附件、记忆和诊断 |
| `/v1/skills/*`、`/v1/extensions/*` | Skills、扩展管理和公开宿主 API |
| `/v1/graphs/*`、`/v1/graph-projects/*`、`/v1/threads/:id/graph-references` | Graph 编排、监督、项目 Agent、引用和产物 |

端点的请求 schema、认证要求和错误码以源代码与测试为准；新增端点必须补 schema、
路由测试、客户端 mapper 和兼容说明。

## 7. 模型供应商和模型接口

### 7.1 Profile 结构

供应商预置描述名称、Base URL、Endpoint Format、模型列表、能力、文档地址、凭据地址、
区域和 token plan。用户保存后形成可独立选择的 `ModelProviderProfileV1`，由 Kun runtime
根据 provider/model 路由请求。

Provider catalog 是稳定身份和能力的唯一来源：`ModelProviderPreset.id` 是不可随意改名的
`providerId`，`kind` 与 `endpointFormat` 描述传输方式，`category`/`tokenPlan` 描述 API、
免 key 或订阅入口，`modelProfiles` 及 image/speech/textToSpeech/music/video 字段描述
模型能力。凭据方式由 API key、OAuth、官方 CLI/SDK、免 key 或自定义中转决定；当前是否
真实验证通过必须在 PR/发布记录中单独标记，不能从静态 catalog 推断。完整且易变的 ID、
模型、端点、能力和验证状态以 `src/shared/model-provider-preset-catalog*.ts`、
`model-provider-preset-types.ts` 及对应测试为准，本说明书不复制第二份 27 项明细。

### 7.2 支持的接口族

- OpenAI Chat Completions 兼容接口；
- OpenAI Responses 兼容接口；
- Anthropic Messages；
- Gemini CLI/API、官方 SDK 或 CLI whole-turn 路径；
- Cursor SDK、Claude Agent SDK、ChatGPT/Codex、Grok 等订阅专用路径；
- 自定义 Endpoint Format，由用户明确填写 Base URL、模型和凭据。

每条路径都必须遵守共享的工具 schema、流式事件、重试、usage 归一化、历史修复、
图片/附件和取消语义。供应商原生 usage 字段优先用于缓存命中统计；不能用某个供应商
的字段假设所有供应商都等价。

### 7.3 凭据和订阅声明

- API key 和 OAuth/SDK 凭据只能进入受保护的设置/账户路径，日志、事件、错误和截图必须脱敏。
- ChatGPT、Claude、Gemini、Cursor、Grok 等订阅入口表示“有接入路径”，不表示小灵 AI
  继承了用户订阅、规避了供应商限制或保证长期可用。
- 订阅路径必须记录登录方式、地区、官方 SDK/CLI 版本、过期/撤销行为和失败回退方式。
- Provider 异常可以按已定义策略回退一次，但不能隐式更换用户选择的模型、账号或权限。

### 7.4 推理强度与供应商映射

小灵 AI 的持久化运行时继续使用兼容值 `auto | off | low | medium | high | max`。
模型目录和首次配置可以识别 Codex 风格的 `minimal | low | medium | high | xhigh`，
其中 `minimal` 归一到 `low`，`xhigh`/`ultra` 归一到 `max`。这保持了旧会话、扩展和
任务 schema 的兼容性，同时允许 UI 展示五档深度能力。

`max` 不是所有供应商的同义词。OpenAI Responses 的模型能力可以声明
`reasoning.responsesMaxEffort`：普通中转默认为 `high`，明确兼容 Codex Responses 的
中转可声明 `xhigh`；官方 Codex 端点由运行时固定发送 `xhigh`。因此不能仅凭
`supportedEfforts` 包含 `max` 就推断中转支持 `xhigh`。

`Ultra` 是小灵 AI 的多代理运行模式，不写入普通模型的 `reasoning.effort`。Claude、
DeepSeek、GLM、MiMo、Qwen 等模型按各自 `requestProtocol` 适配，能力不足时降级到该
协议明确支持的最高档，并在请求体测试中验证实际 wire 字段。

模型输出还必须经过统一的标签泄漏防护。兼容 Provider 可能把思考内容错误地放进普通
文本并返回 `<think>`、`<thinking>`、`<analysis>`、`<reasoning>`、`<reflection>`、
`<thought>`、`<scratchpad>`、`<chain_of_thought>`、`<cot>` 等标签。共享增量规范化器位于
Kun 的模型流边界：`MultiProviderModelClient` 统一覆盖兼容、原生、扩展和路由 Provider，
主 Collector 再做幂等防护；Cursor SDK、Antigravity CLI 等不经过主 Collector 的运行时也
必须在各自出口接入同一规则。标题、会话/压缩摘要、记忆提炼、审批审查、自动路由和子代理
等直接消费模型流的内部调用同样先规范化，不能把思考标签带入持久化标题、JSON 或提示词。
规范化支持跨 SSE/网络分片、嵌套包装、空包装和未闭合/半截标记；思考内容转成结构化
reasoning，普通答案继续作为 text，Markdown 行内代码和代码围栏中的示例标签保持原样。
Renderer 对历史消息、预览和最终答案使用同一规则；未知 XML 不自动删除，避免把正常答案
改坏。

## 8. 功能模块说明

### 8.1 Code、工具和权限

Code 通过 Kun ToolHost 使用文件读写、搜索、Shell、Git、LSP、浏览器、Computer Use、
图像/媒体、计划、子代理和扩展工具。工具执行受到 workspace scope、sandbox、approval
policy、capability snapshot 和当前 client surface 的共同约束。

权限模式至少包括询问审批、替用户批准和完整访问。UI 隐藏某个工具不等于权限拒绝；
宿主和 Runtime 必须在发现与执行两层都校验。

Subagent 通过 `delegate_task` 使用受限的 profile 目录；`fast_context` 只提供有界的
只读检索。profile 按 `shared`、`code`、`write`、`design` surface 过滤，child 必须继承
父任务的能力和权限快照。供应商故障最多按既定策略回退一次，不能在失败时无限换路由、
扩大工具或绕过用户审批。

### 8.2 Design

Design 与 Code 共用 Thread、事件、模型和工具边界；画布、SVG、图表、原型和导出通过
结构化工具结果与 artifact 协议保存。不得恢复旧的独立绘画启动卡片或第二套运行时。

### 8.3 Work

Work 使用内部 `write` 兼容命名，支持工作区编辑、选区助手、inline completion、检索、
Office/文档相关流程和白板引用。动态选区、资源和画布快照通过有界 context 引用进入 turn，
不能污染稳定 system prefix。

### 8.4 Graph、计划和定时任务

Graph 是 Runtime 内的高级编排能力，拥有独立的 graph draft、run、supervision、review、
artifact 和事件路由。Direct plan/build、自动模式和定时任务都必须绑定 workspace、thread、
provider/model、请求身份和取消语义；失败时保留可恢复现场，不偷偷切换工作区。

### 8.5 Workflow、Loops 和 Hooks

Workflow 是产品层的本地自动化运行时，和 Kun Agent Loop 不是第二套 Agent runtime。当前
节点类型包括手动/计划/Webhook 触发、AI agent、图像生成、条件、switch、filter、字段设置、
代码、排序、限制、聚合、HTTP、合并、子工作流、loop、delay、template、JSON、output、
参数抽取、问题分类、人类审批和 custom module。每次运行保留 run、节点状态、输入/输出、
错误和取消状态。

Loop 必须有硬边界：条件或 foreach 的 `maxIterations` 不得超过 100，嵌套深度不超过 5，
单次运行有节点数和看门狗限制；并行 foreach 必须保持输出顺序，失败策略要显式选择
continue 或 fail-fast。Hook 运行必须有超时、递归保护、审批语义和失败事件；Hook 的非阻断
告警不能被当作 Agent 成功证据。

GUI 当前没有完整的 Hook 编辑器，低层 Hook 配置仍通过 `<dataDir>/config.json` 的顶层
`hooks` 数组维护。任何新增 Hook UI 都必须补 schema、权限预览、来源显示和回滚行为。

### 8.6 MCP、Skills、Extensions 和知识

- MCP/Skills 负责扩展工具与知识入口，必须有来源、启停、权限和版本信息；
- Extension 通过 Extension API 安装、检查、启用、停用、回滚和诊断；
- Knowledge base 只扩大受控检索范围，不自动扩大普通文件工具可写根；
- 记忆是动态、不可信的 reference 证据，不能进入不可变 system prefix 或获得指令权限；
- 附件和产物不向客户端泄露绝对路径或临时播放 URL。

### 8.7 Office、浏览器、Computer Use 和 Remote SSH

- Work/Knowledge 支持 Markdown、PDF 文本层、DOCX/DOC、PPTX/PPT、XLS/XLSX 等受控解析；
  PDF 当前不在 Kun indexer 内做 OCR，旧 Office 格式可能依赖本机 LibreOffice。原文件默认只读，
  引用必须带页码、幻灯片或工作表等可复核定位。
- Browser Use 和 Computer Use 分别处理浏览器会话与桌面控制；GUI-only Provider 只能在真实
  GUI surface 和画布状态满足时发现与执行，不能因为客户端隐藏菜单就绕过 Runtime 校验。
- Remote SSH 支持主机配置、identity file、host-key fingerprint 确认和远端终端会话；私钥、
  known-hosts 和主机配置必须进入受保护的用户数据目录，主机 key 变化时 fail closed。
- 这些能力的网络范围、文件范围、审批和取消仍由 Runtime/IPC 共同校验；手机/微信不能因为
  是远程入口而获得 Computer Use 或远端 Shell 的额外权限。

## 9. IM、微信和远程入口

当前 `Claw` 兼容设置支持的渠道类型包括 Feishu/Lark、WeChat bridge 和 Telegram。通道
可以绑定 provider/model、workspace、Thread、Agent profile、对话映射和流式策略。

### 9.1 已有能力

- IM 消息可创建或复用 Kun Thread，并把回复映射回远端会话；
- 可发送任务、接收流式或最终回复、处理部分命令、取消和相关状态；
- Feishu/Lark 有可选的 SSE 驱动流式回复；WeChat 有本地 bridge API；Telegram 支持 bot
  token、允许的 chat id 和可选代理；
- Connect phone UI 可保存设置并通过 Kun 会话执行手工任务。

### 9.2 明确限制

- 当前没有原生手机 App，也没有通用公网网关；跨网络使用需要用户自行提供安全、认证的
  可达通道，不能把本地 secret 直接暴露到公网。
- 微信/IM 不是可信执行环境，所有请求仍须经过身份、工作区、Thread 和 capability 校验。
- “看到电脑端对话”应实现为 Thread/Event/Artifact 同步；禁止通过截图、DOM 抓取或窗口
  注入实现远程查看。
- 通道的第三方审核、速率限制、掉线、过期 token、消息大小和富文本差异必须单独验收。

### 9.3 WeChat bridge 连接契约

- 内置 bridge 只监听 `127.0.0.1`，默认 RPC 地址为
  `http://127.0.0.1:18790/api/v1/admin/rpc`；端口被占用时会递增，并以 userData 下的
  `weixin-bridge/config.json` 状态为准。
- 管理 RPC 只允许 `web.login.start/wait`、`channels.start/stop`、`accounts.list`，当前只依赖
  loopback 绑定而不使用 `claw.im.secret`；本地发送接口为 `POST /api/v1/messages/send`，
  需要 `channelId`、`conversationId`、`text` 和幂等键。
- 发送认证使用 `claw.im.secret` 的 Bearer token（兼容 `x-kun-secret`），secret 为空时拒绝；
  两个接口都不是公网 API。跨网络必须由用户自行部署带 TLS、认证、allowlist、重放保护的
  安全网关或隧道，禁止直接转发本地 secret 或把 18790 暴露到公网。

## 10. 配置、存储和迁移

### 10.1 配置原则

- `AppSettingsV1` 是桌面设置的规范化入口；旧 key 只在迁移中只读兼容。
- Agent 只保留 `kun` 标识；不要重新引入 AgentSwitcher、旧 Runtime Diagnostics 或第二套运行时。
- `agents.kun` 保存 runtime provider/model、权限、sandbox 和相关实验开关；供应商注册表保存
  profile、账户和能力信息；Claw/Work/Schedule/Graph 等保持各自明确的设置域。
- 新设置必须有类型、默认值、normalizer、迁移、IPC schema、UI、测试和文档。

### 10.2 数据类别

| 数据 | 规则 |
| --- | --- |
| Thread/Event/Turn | 追加事件、游标、状态和索引；必须支持恢复与排序 |
| 模型连接 | profile、账号引用、模型、端点和受保护凭据；日志不得泄密 |
| Workspace/Artifact | 使用相对引用和所有权；不向远程渠道泄露绝对路径 |
| Memory/Knowledge | 作用域过滤、生命周期过滤、可重建索引和降级状态 |
| Claw/IM | 通道凭据、对话到本地 Thread 映射、消息游标和欢迎状态 |
| Schedule/Graph | 请求身份、计划快照、取消/重试和审计事件 |

### 10.3 迁移和回滚

- 迁移必须幂等、可检测、可测试，先备份或保留原始数据，再写规范化数据。
- 不删除用户数据来掩盖迁移失败；无法确认所有权、路径或凭据时 fail closed。
- 版本升级必须说明旧客户端能否读取新数据；共享契约不兼容时增加版本或兼容适配器。
- 回滚前确认数据库、事件、配置和扩展版本兼容；回滚不能恢复已撤销的第三方 token。
- 首次命名迁移把 `~/.deepseekgui/kun`（以及同根的 workspace、claw、write_workspace）
  安全切换到 `~/.kun/data` 等新路径；旧目录保留兼容链接或在失败时继续作为权威源。
- 旧 userData 名称 `DeepSeek GUI`/`deepseek-gui` 和 `deepseek-gui-settings.json` 只在
  启动迁移中读取，成功后写入 `kun-settings.json`；旧 key 只做一次规范化，不回写旧 schema。
- 运行时迁移通过 journal、目标备份、冲突计划、暂存区、校验报告和可恢复 rollback 完成；
  目标已存在时不得静默覆盖，无法确认所有权或迁移阶段时必须 fail closed。
- `.kunpack` 是独立的可移植导入/导出格式；导入前 preflight，导入中保留冲突和备份，
  导入后 verify，并按报告决定恢复或清理，workflow/schedule/channel 等禁用项不得悄悄启用。

### 10.4 当前数据目录参考

路径会被用户的 `agents.kun.dataDir` 和测试 flavor 覆盖，以下是默认基线，不应硬编码到
产品逻辑中：

| 数据 | 默认位置 |
| --- | --- |
| GUI settings | macOS `~/Library/Application Support/Kun/kun-settings.json`；Windows `%APPDATA%/Kun/kun-settings.json`；Linux `~/.config/Kun/kun-settings.json` |
| Kun Runtime config | `~/.kun/data/config.json`，或 `<dataDir>/config.json` |
| Thread、事件、附件、凭据和索引 | `<dataDir>/` 下由 Runtime 管理的持久化存储；不要直接编辑 JSONL/SQLite |
| Memory 标准数据 | `<dataDir>/memory/*.json`；SQLite 是可重建检索投影 |
| Remote SSH | Electron userData 下的 `remote-ssh/hosts.json` 和 `known-hosts.json`，凭据字段必须脱敏处理 |
| 迁移日志/报告 | GUI settings 目录下的 `kun-runtime-data-migration-v2*.json`；数据迁移报告位于兼容用户数据目录的 `data-migration/reports/` |

测试、截图和开发应用必须使用隔离的 user-data/dataDir；禁止用删除日常目录的方式清理测试现场。

完整路径和迁移细节以 [`KUN_CONFIG.md`](./KUN_CONFIG.md)、[`memory-foundation.md`](./memory-foundation.md)
和 [`data-migration.md`](./data-migration.md) 为准；本节只冻结产品开发需要知道的稳定入口。

## 11. 所有权、分支和上游同步

### 11.1 来源分类

- **Kun-derived**：通用 Runtime、Thread/Event、工具、存储、模型客户端和扩展宿主；可改，
  但要可解释、可测试、可回放并保持上游同步能力。
- **Xiaoling-owned**：品牌、产品策略、渠道连接器、商业策略、运营审计和产品差异化。
- **Shared contract**：Thread/Turn、Event/SSE、Approval/UserInput、Artifact/Attachment、
  Auth/Capability、Adapter/Extension version。

### 11.2 分支模型

```text
upstream/master
      |
codex/sync-kun-vX.Y.Z
      |
develop  ---- codex/<feature> ---- PR ----> develop ----> master
```

- `develop` 是产品集成分支，`master` 是当前稳定发布目标，只接受已验证的可发布版本；
  `main` 即使存在，也不是当前 release workflow 的目标分支。
- 功能、修复、文档和重构从最新 `develop` 创建短期 `codex/*` 分支。
- 上游同步必须使用独立 `codex/sync-kun-vX.Y.Z` 分支，不能混进功能分支。
- 当前 Kun 基线标签为 `xiaoling-base-kun-v0.3.10`，对应提交 `e67f656b`；产品标签使用
  `xiaoling-vX.Y.Z`，两者不可混用。
- 当前远程：`origin=https://github.com/SAMUELDONE/xiaoling-ai.git`，`upstream=https://github.com/KunAgent/Kun.git`。

### 11.3 上游同步门禁

1. 核对目标 Kun release、提交、许可证和影响范围；
2. 在同步分支合并上游并建立 patch inventory；
3. 解决冲突时先判断产品逻辑是否应外移到 adapter/extension；
4. 更新共享契约、迁移和兼容测试；
5. 执行与影响范围匹配的 typecheck、build、test、runtime smoke 和 UI smoke；
6. 通过后再合入 `develop`，未解决的冲突不得进入 `master`。

## 12. 可插拔和扩展性要求

- 产品模块依赖版本化契约，适配器依赖 runtime port，具体实现可以替换；
- 通道、供应商和扩展的失败、升级、停用不能破坏核心 Thread/Event/Approval 状态机；
- 对多个客户端都成立的能力可进入 Kun-derived；仅服务一个渠道或产品流程的逻辑放在
  Xiaoling-owned adapter/extension；
- 不把 Kun 内部函数、renderer store、DOM、CSS selector、私有 IPC 或未版本化 bearer RPC
  当作稳定扩展面；
- 新能力优先使用 HTTP/SSE、Extension API、MCP 和 Skills；不足时先补公共 port/contract；
- Capability 必须可选、可发现、带版本；客户端不能假设所有 Runtime 都具备同一能力。

## 13. 新功能开发流程

### 13.1 需求和边界

1. 写清用户、场景、成功标准、拒绝标准和不在范围的部分；
2. 标记 Kun-derived、Xiaoling-owned 或 shared contract；
3. 查找现有 HTTP/SSE、Extension、MCP、Skills、设置和迁移入口；
4. 需要改变共享协议、权限或数据结构时先写 ADR；
5. 选择从 `develop` 创建的 `codex/*` 分支，并说明回滚方式。

### 13.2 实现顺序

1. 先定义类型、schema、版本、错误码和能力声明；
2. 再实现 Runtime port/adapter/route；
3. 再实现 Main/Preload 映射和 renderer 状态；
4. 最后接 UI、文案、本地化、日志和诊断；
5. 所有异步流程提供取消、超时、重试、幂等和失败终态；
6. 不顺手引入第二套 Runtime、旧入口或跨层隐式依赖。

### 13.3 Provider 新增流程

- 在 framework-neutral catalog 和 GUI catalog 中保持同一 profile identity；
- 定义 endpoint、模型、上下文、reasoning、vision、audio、image、video 和 pricing 能力；
- 明确 API、订阅、OAuth、CLI、token plan 或自定义中转的认证方式；
- 写保存、选择、probe、模型刷新、流式、tool call、错误和凭据脱敏测试；
- 接入首次配置画廊前，补图标、i18n、描述、文档 URL、key URL 和免 key 规则；
- 真实供应商验证失败时只能标为部分实现，不得用静态配置冒充可用。

### 13.4 UI 改动流程

- 先验证空态、加载、错误、禁用、键盘、焦点、深色模式、窄窗口和长文本；
- 不以截图或 DOM 作为远程协议；
- 文案改动同步中英文和受影响语言，避免把内部兼容名作为产品名展示；
- UI 改动附手工 smoke 或截图证据，并补组件/行为测试；
- 源码、测试、脚本和配置等实现文本文件保持不超过仓库规定的 1200 行，并按功能边界拆分；产品文档、ADR、本地化资源、fixture 和生成文本不受该物理行数门禁限制，但文档超过约 2000 行时应评估按主题拆分。

### 13.5 Runtime/IPC/契约改动流程

- 更新 `kun/src/contracts` 或 shared types 后，先补兼容解析和版本说明；
- 更新路由后补鉴权、schema、成功、错误、取消、重试和权限测试；
- 更新 IPC 后同时改 preload、Main schema、renderer caller 和迁移；
- 验证 GUI、TUI、CLI、API、IM、Extension 的 surface 过滤一致；
- 事件必须可重放，写请求不得在未知是否落盘时盲目重放。

## 14. 测试、构建和发布门禁

### 14.1 默认提交前检查

```bash
npm run check:file-lines
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```

根据改动范围追加：

```bash
npm run smoke:dual-runtime
npm run dev
npm run test:packaging
```

### 14.2 当前基线已完成的相关验证

- `npx tsc --noEmit -p tsconfig.web.json`；
- 首次配置及本地化相关 Vitest：5 个测试文件、106 项测试通过（2026-09-25）；
- 相关 ESLint 检查；
- `npm run check:file-lines`；
- `git diff --check`；
- 开发 Electron 窗口中已验证小灵 AI 标题、简体中文供应商画廊、查看全部和配置交互。

这些结果只证明记录日期和当前工作树的范围，不能替代完整发布门禁或第三方供应商验收。

### 14.3 发布前人工清单

- 首次启动、已有配置迁移和取消保存；
- 至少一个 API provider、一个自定义中转和一个订阅/CLI 路径；
- ChatGPT、Claude、Gemini、Cursor、Grok 等订阅路径必须在对应地区、账号状态、官方 CLI/SDK 版本和额度条件下单独记录验证结果；“配置成功”不能替代真实请求验收；
- 普通回复、流式回复、tool call、审批、user input、中断、恢复和断线重放；
- 空 workspace、Git workspace、脏工作区、权限拒绝和路径越界；
- Code/Design/Work/Connect phone 的 surface 能力过滤；
- IM 的消息大小、掉线、重复投递、过期凭据、取消和最终回复；
- 打包安装、升级、回滚、数据迁移和 Runtime 生命周期；
- 日志、截图、错误、artifact 和远程回复中没有敏感凭据或绝对路径泄露。
- GUI 与 TUI 的 Runtime owner、`--url`/`--no-start`、退出清理和 ownership conflict；
- Workflow 的手动/计划/Webhook/Hook、循环上限、并行顺序、审批和取消；
- Office 解析依赖缺失、Remote SSH host-key 变化、浏览器/Computer Use 的 GUI-only 过滤；
- `.kunpack` 迁移备份、跨平台路径、禁用导入的 workflow/schedule/channel 和恢复报告。
- 稳定发布仅接受同仓库 `develop -> master` 的已合并 PR；手动 dispatch 只生成候选，不自动 promote。
- 发布矩阵必须覆盖 macOS arm64/x64（签名、公证）、Windows x64 NSIS、Linux x64/arm64 AppImage 与 deb。
- GitHub Release 先创建 draft；全部产物、`latest*.yml` 更新元数据和 R2 immutable candidate 通过验收后才 promote stable/latest。
- 安装器、更新 feed、迁移交接和平台架构检查必须以同一 commit/tag 为证据；显示名是小灵 AI，兼容 feed 的产物前缀暂保留 `Kun-*`。

## 15. 安全和权限边界

- 本地 Runtime HTTP 接口必须要求正确的认证上下文；空 secret 或不明确身份时 fail closed。
- Thread 权限至少绑定用户、workspace、thread、clientSurface 和 capability snapshot。
- IM secret、bot token、app secret、session key、API key 和 OAuth token 进入受保护存储；
  不写入普通日志、事件正文、URL、错误堆栈或产品截图。
- Approval 不能被 IM、自动模式、子代理或重试绕过；远程决定必须可审计。
- Shell、文件写入、浏览器和 Computer Use 不能因为客户端是手机或微信而扩大权限。
- Extension/MCP/Skills 安装、升级、启用和网络访问应显示来源、权限、版本和回滚入口。
- 第三方供应商条款、地区限制和用户授权由接入方负责；小灵 AI 不承诺绕过限制。

## 16. 商业化前置工作

### 16.1 当前许可证基线

- 当前仓库保留上游 `PolyForm Noncommercial License 1.0.0`，具体文本见 `LICENSE`；
- `LICENSE-NOTICES.md` 记录上游来源、第三方组件和授权说明，发布前必须同步检查；
- 当前代码和文档不能据此宣称已经获得商业使用、商业分发、SaaS/托管服务、转售或商业集成授权；
- 商业化前必须取得上游作者及相关第三方的适用书面授权，并让产品、法务和发布负责人共同确认；
- 改名、重构、增加小灵 AI 自有代码或使用 AI 生成代码，不会自动替代上游许可证义务。

在公开商业化前，必须单独完成并评审：

- 身份、组织、工作区、多租户隔离和设备绑定；
- 云端网关、端到端加密、密钥托管、密钥轮换和审计保留；
- 供应商成本、额度、计费、退款、限流和滥用防护；
- IM/webhook 公网部署、重放保护、签名校验、消息幂等和数据保留；
- 备份、恢复、灾难演练、升级回滚和客户数据导出/删除；
- 许可证、Kun 上游来源、第三方 SDK、模型服务条款和品牌使用审查；
- 隐私政策、数据处理说明、客服和生产事故响应流程。

## 17. 变更记录模板

新增功能或重大修复的 PR 描述至少包含：

```markdown
## 变更目的
- 用户/场景：
- 成功标准：
- 不在范围：

## 边界归属
- [ ] Kun-derived
- [ ] Xiaoling-owned
- [ ] Shared contract
- 不能使用现有扩展面的原因：

## 行为与数据
- 新增/修改的 UI：
- 新增/修改的 API、事件或 IPC：
- 配置、迁移和回滚：
- 权限、凭据和审计影响：

## 状态
- [ ] 已实现
- [ ] 部分实现，缺口：
- [ ] 规划中

## 验证
- 自动化命令及结果：
- 手工平台/步骤：
- 失败和取消路径：
- 上游同步/兼容性：

## 文档与发布
- 本说明书章节：
- 版本/契约版本：
- 许可证或第三方声明：
```

## 18. 当前版本变更日志

`v0.1.0`（2026-09-24，当前基线）：

- 建立小灵 AI 产品身份、Kun 底座边界、分支和上游同步规则的统一说明；
- 记录桌面 Code、Design、Work、Connect phone、Runtime、Thread/Event、扩展和 IM 的真实状态；
- 记录首次配置 27 入口供应商画廊、搜索、Cover Flow、自定义中转和配置保存逻辑；
- 补齐首次配置标准 API 连接测试、模型发现/选择、保存模型覆盖和委托式订阅探测边界；
- 增加跨 Provider 的思考标签泄漏防护，覆盖流式分片、非流式响应、历史消息和代码示例；
- 规定模型供应商、共享契约、UI、Runtime/IPC、迁移、安全、测试和发布门禁；
- 明确原生手机 App、完整远程桌面镜像、云端商业化、多租户和计费仍未交付。

## 19. 关联文档

- [`xiaoling-boundaries.md`](./xiaoling-boundaries.md)：产品与 Kun 的边界基线；
- [`adr/0001-kun-as-base.md`](./adr/0001-kun-as-base.md)：以 Kun 为可替换底座的决策；
- [`upstream-sync.md`](./upstream-sync.md)：Kun 上游同步和 patch inventory；
- [`kun-architecture.md`](./kun-architecture.md)：Runtime、缓存、Graph、Work 和客户端生命周期；
- [`DEVELOPMENT.zh-CN.md`](./DEVELOPMENT.zh-CN.md)：分支、PR 和日常开发流程；
- [`CONTRIBUTING.zh-CN.md`](./CONTRIBUTING.zh-CN.md)：贡献质量、专项验证和发布协作；
- [`KUN_CONFIG.md`](./KUN_CONFIG.md)：Kun-compatible 运行时配置；
- [`model-provider-presets.md`](./model-provider-presets.md)：Provider catalog 设计参考；当前 27 卡片的权威列表以本说明书和 `src/shared/model-provider-preset-catalog*.ts` 为准；
- [`kun-tui.md`](./kun-tui.md)：TUI、CLI 和 Runtime 连接方式；
- [`workflow-loop.md`](./workflow-loop.md)：Workflow Loop 节点；
- [`kun-hooks.md`](./kun-hooks.md)：Kun runtime Hook 机制和安全边界；
- [`knowledge-bases.md`](./knowledge-bases.md)：Office/知识库格式、索引和引用；
- [`data-migration.md`](./data-migration.md)：跨平台 `.kunpack` 数据迁移；
- [`weixin-local-send-api.md`](./weixin-local-send-api.md)：本地微信 bridge 发送接口；
- [`extensions/api-reference.md`](./extensions/api-reference.md)：Extension API 和 artifact 约束。
