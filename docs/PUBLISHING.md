# GitHub 发布指南

本指南说明本地整理完成后的上传步骤。创建远程仓库、推送和正式发布需要使用项目拥有者自己的 GitHub 账号；本地构建成功不代表已上传，也不代表 GitHub Actions 已通过。

## 1. 检查源码

在项目根目录运行：

```powershell
npm ci
npm run check
npm run test:desktop
git status --short
git diff --cached --stat
```

`check:repo` 会检查文档本地链接、锁文件元数据和常见凭据模式。它不能证明不存在所有类型的秘密；提交前仍应确认没有个人账号、聊天记录和访问凭证。

`.gitignore` 已排除依赖、构建产物、测试 profile、环境文件和常见私钥文件。展示截图保存在 `docs/screenshots/`，可正常进入仓库。

## 2. 创建首个提交并推送

本地仓库使用 `main`。若 `git config user.name` 和 `git config user.email` 没有输出，先在本仓库设置你自己的提交署名及 GitHub 邮箱（也可用 GitHub 提供的 noreply 邮箱）。

然后执行：

```powershell
git add .
git diff --cached --stat
git commit -m "Prepare v0.1.0 desktop client for release"
```

在 GitHub 创建空仓库，建议名称 `yijia-lingxi`，不要让 GitHub 预先创建另一份 README、许可证或 `.gitignore`。复制网页给出的仓库地址，按网页指引添加 `origin`，再运行：

```powershell
git push -u origin main
```

建议仓库简介：`Electron + React AI 桌面客户端：SSE 流式聊天、场景助手、本地会话和受限 IPC。`

可选 Topics：`electron`、`react`、`vite`、`ai-client`、`sse`、`desktop-app`。

`package.json` 中的 `private: true` 用于避免误发 npm，不影响公开 GitHub 仓库。

## 3. 查看远程 CI

推送后打开 Actions，查看 `Client checks`。流程会在 Windows 上安装依赖，执行仓库检查、协议测试、构建、桌面测试、目录包启动验证及 ZIP 生成。失败时查看日志和 `windows-test-evidence`。

只有实际运行成功后，才可以在材料中写 GitHub CI 通过。当前仓库配置不会自动创建 Release、打标签或推送代码。

## 4. 准备 Windows 分发

关闭正在运行的该版本目录包，避免覆盖时文件被占用，然后运行：

```powershell
npm run check
npm run test:desktop
npm run package
npm run test:package
npm run release:zip
```

生成：

- `release/yijia-lingxi-0.1.0-windows-x64.zip`
- `release/SHA256SUMS.txt`

ZIP 保留完整应用目录、Electron/Chromium 许可、应用许可、第三方说明和中文使用说明。校验文件针对实际 ZIP 计算，改动 ZIP 后必须重新计算。

在 PowerShell 核对：

```powershell
Get-FileHash release/yijia-lingxi-0.1.0-windows-x64.zip -Algorithm SHA256
```

不要把 `release/` 或 `node_modules/` 添加进 Git。GitHub 会基于版本标签提供源码 ZIP；本地额外准备的 `*-source.zip` 是源码快照，解压后按 README 安装依赖运行。

## 5. 创建正式 Release

确认要发布的提交和 CI 结果后，在 GitHub Releases 创建标签 `v0.1.0`，标题可用 `一加灵犀 v0.1.0 — Windows 桌面客户端首版`。

正文采用 [v0.1.0 发布说明](releases/v0.1.0.md)，上传 Windows ZIP 与 `SHA256SUMS.txt`。保留真实模型待联调、默认预设演示和未代码签名的说明。

## 演示与联调说明

项目功能与架构介绍见 [README](../README.md)，本地验证范围见 [本地验收记录](verification-record.md)。离线演示可展示助手、聊天、收藏和导出；真实模型展示需提前完成 [网关联调](gateway-contract.md#真实联调验收)。
