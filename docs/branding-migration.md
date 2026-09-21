# Xiaoling AI 品牌迁移说明

状态：第一阶段已落地

小灵 AI（Xiaoling AI）是本仓库的产品身份、用户界面和发布主体。Kun 只表示
当前部分代码的来源以及仍需兼容的本地 Agent runtime；它不是最终产品名称。

## 已切换的产品层

- 根包元数据、GitHub 仓库链接和维护者改为 `SAMUELDONE` / `xiaoling-ai`；
- Electron 应用标题、开发版标题、HTML 页面标题和托盘文案改为 Xiaoling AI；
- 安装器显示名、macOS 麦克风权限说明和 Linux maintainer 改为 Xiaoling AI；
- README、Agent 开发指南和核心 shell-workflow 本地化文案改为 Xiaoling AI；
- 产品身份集中在 `src/shared/product-identity.ts`，新增品牌入口不得硬编码 Kun。

## 暂时保留的兼容层

以下名称已经进入协议、扩展、持久化数据或升级链路，第一阶段不能直接删除或
全局重命名：

- `window.kunGui`、`kun:` IPC、`KUN_*` 环境变量和 `kun serve`；
- `kun/` runtime、`@kun/*` workspace 包、`kun-extension://` 和 `agents.kun`；
- `.kun` / `~/.kun` 数据目录以及旧版迁移路径；
- 生产环境用户数据目录继续使用旧的 `Kun` 路径，避免改名后已有桌面数据失联；
- `com.xingyuzhong.deepseekgui(.dv)` app ID、`DEEPSEEK_GUI_*` fallback 和
  `deepseek-gui` 更新前缀；
- 旧版安装器、快捷方式、日志和 `DeepSeek GUI` 导入逻辑。

生产包目前使用 Xiaoling AI 的显示名，但继续使用旧 artifact 前缀连接旧更新
feed。切换下载文件前缀必须另做迁移设计，并同时更新 updater、发布脚本、CI、
安装器和已发布 manifest。

## 来源和许可证

品牌切换不改变上游来源。根目录 `LICENSE`、`THIRD_PARTY_NOTICES.md`、上游
版权声明、CLA 和历史贡献记录必须保留。小灵 AI 的新增修改可以由
`SAMUELDONE` 维护，但不能把上游版权改写成小灵 AI 的原创版权。

商业发布前必须取得覆盖二次开发、改名、桌面/移动/微信接入、二进制分发、SaaS
和客户部署的书面授权，授权状态记录在 [`LICENSE-NOTICES.md`](../LICENSE-NOTICES.md)。

## 后续阶段

1. 为新视觉资源建立 Xiaoling AI 资产，并在迁移测试后替换旧 Kun 资源引用；
2. 为产品层增加 Xiaoling facade，逐步减少新代码直接依赖 Kun 内部名称；
3. 单独设计 app ID、用户数据目录、CLI 和下载文件前缀的迁移与回滚；
4. 在每个迁移点补充升级、扩展、旧数据和跨平台安装测试。
