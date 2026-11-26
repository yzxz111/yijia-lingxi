# 本地验收记录

日期：2026 年 11 月 25 日（Asia/Shanghai）。

## 验证范围

在 Windows 本机运行一加灵犀 Electron 客户端，执行协议测试、界面自动化与截图检查。网络集成测试使用测试程序自己启动的本机 HTTP 受控服务，不读取或使用真实中台的账号和 API Key。

## 已通过检查

### 网关协议：13 / 13

执行 `npm test`，覆盖：

- URL 规范化，以及对明文远程地址、嵌入凭据、查询参数和错误路径的拒绝。
- 空密钥和换行密钥拒绝。
- 中文 UTF-8 与 CRLF 按单字节网络块拆分仍能正确还原。
- usage 帧与达到输出上限的终态。
- 空 `[DONE]`、缺失终态、未结束尾帧的识别。
- 流中错误、无效 JSON、超大帧。
- 401、429、503 和生成请求不自动重试。
- 用户取消传递到 Fetch 信号。
- 授权模型目录读取与 Retry-After 解析。

### Electron 桌面集成：15 / 15

执行 `npm run test:desktop`，覆盖：

1. Electron 安全隔离与首页加载。
2. 发现助手与分类切换。
3. 演示流式对话与收藏。
4. 对话重命名与搜索。
5. 回复复制写入系统剪贴板。
6. Markdown 导出的文件内容。
7. 文本附件与停止演示生成。
8. 重启后恢复历史和收藏。
9. 无效 API Key 的可见错误。
10. 真实 HTTP / IPC 传输获取模型与额度，目标为受控服务。
11. 分片 SSE 中文流与返回用量显示，目标为受控服务。
12. 流中错误保留部分内容并显示失败。
13. 用户停止确实关闭客户端到受控服务的流。
14. 输入密钥未进入 localStorage，输出渲染不含脚本节点。
15. 缩小桌面窗口后不存在文档水平溢出。

结构化结果在 `test-results/desktop-results.json`，截图在同目录的 `01-home.png` 至 `06-compact.png`。测试使用独立 profile，不向实际工作空间写入测试历史。

### 构建和打包

- Vite 生产构建通过，生成 `dist/`。
- Electron Windows x64 目录包生成于 `release/一加灵犀-win32-x64/`。
- 打包目录内包含 Electron 运行时，前端与桌面代码位于 `resources/app.asar`。
- 直接启动打包后的 `一加灵犀.exe` 验证通过：`app.isPackaged=true`，版本 `0.1.0`，首页 4 个场景卡片与 preload 桥可用，渲染进程未出现脚本异常。
- 已回读打包版窗口配置：`nodeIntegration=false`、`contextIsolation=true`、`sandbox=true`。结果在 `test-results/package-results.json`，实际打包版截图为 `test-results/07-packaged-home.png`。

## 上游接入状态与限制

检查本机 `127.0.0.1:18081`、`:8081` 时未发现监听。本次没有启动、修改或部署一加 AI 中台，没有创建账号、密钥或套餐，也没有发生真实模型调用。

本项目已实现上游最小契约，并通过受控服务验证客户端 HTTP、IPC、SSE、错误和取消路径；**尚未完成对当前真实一加中台及真实云模型的联调验收**。应用默认本地预设演示，连接真实中台需要用户提供其 API Base URL 和有效 API Key。

这里的「真实 HTTP / IPC 传输」仅表示实际网络和进程通信，不表示受控服务是真实模型供应方。界面中的实时额度只有连接后才会读取，演示不会伪造余额。

## GitHub 发布整理与复现验证

同日完成的发布整理包括：

- README 增加源码首次启动步骤、3 张演示截图、接口边界和公开项目资料入口，移除本机专用工具路径。
- 增加 MIT 许可、7 个生产依赖安装包的许可原文及分发许可说明；保留 Electron / Chromium 自带许可。
- 初始化 `main` 分支并暂存源码；排除依赖、构建目录、测试数据、环境文件和常见私钥文件。
- 增加 Windows GitHub Actions 检查、桌面测试、打包及测试产物保留流程。Action 引用固定到提交 SHA。
- 增加更新记录、可直接使用的版本说明、独立网关契约和 GitHub 发布指南。
- 增加仓库检查、版本跟随的实际目录包验证、标准 ZIP 与 SHA-256 生成脚本。

### 全新源码副本

从 Git 暂存内容导出源码 ZIP，解压到独立目录，未复制原项目的 `node_modules/`、`dist/` 或本地数据。使用 Node.js 24.22.3、npm 11.19.1 执行 `npm ci` 后：

- `npm run check` 通过：文档本地链接、锁文件元数据、常见凭据模式、13 项协议测试与生产构建。
- `npm run test:desktop` 通过：15 / 15 项，渲染错误 0；仍使用本地受控 HTTP 服务。

### 分发 ZIP

- 重新执行 `npm run package`、`npm run test:package` 和 `npm run release:zip`，全部通过。
- ZIP 包含完整应用、`APP-LICENSE.txt`、`THIRD_PARTY_NOTICES.txt`、中文使用说明与 Electron / Chromium 许可。
- 检查 76 个 ZIP 文件条目，路径使用标准正斜杠，CRC 完整性检查通过。
- 从最终 ZIP 解压后直接启动程序，确认 `app.isPackaged=true`、版本 `0.1.0`、preload 可用、渲染错误 0；安全隔离配置符合上述结果。
- 检查 `app.asar`，确认未包含 Git 元数据、截图文档、测试 profile、验证目录或发布脚本。
- 分发包未做 Windows 代码签名。

### 仓库与远程状态（公开前的整理阶段快照）

文档链接、常见凭据模式及暂存文件检查通过；该扫描不等于覆盖所有秘密类型。GitHub Actions YAML 已在本地解析并检查触发条件、只读仓库权限和 Action SHA 引用。

上述发布整理阶段未创建 GitHub 远程仓库、未推送、未打标签、未发布 Release，也未代填提交作者身份。该段保留当时的验证边界；后续公开状态见 [项目仓库](https://github.com/yzxz111/yijia-lingxi)，远程 CI 以 [Actions 实际运行](https://github.com/yzxz111/yijia-lingxi/actions)为准。真实中台与云模型联调仍未完成。

发布步骤见 [GitHub 发布指南](docs/PUBLISHING.md)，结构化摘要见 [发布整理验证摘要](docs/release-verification.json)。
