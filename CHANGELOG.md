# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [1.0.1] - 2026-08

深度修复：消除导致 dsh 启动崩溃与功能失效的根因，并重写安装流程。

### 修复

- **Host 端服务依赖声明**：新增 `inject = ["webServer", "sessionQuery"]`，Cordis 会等服务就绪后再执行 `apply()`。此前未声明依赖，apply 在服务注册前运行，`ctx.get` 取不到服务，`/dsh-bubble-nav` 路由从未注册（插件静默失效）。
- **路由生命周期**：`webServer.register` 返回的 disposer 挂到 `ctx.effect`，插件卸载/热重载时路由正确释放，不再触发 `duplicate route` 抛错。
- **apply 防御**：服务缺失、注册冲突全部降级为警告 + 空操作，插件永不因异常导致 Cordis fiber 失败（fail-loud 崩溃）。
- **client.js `ctx` 悬空引用**：模块级函数引用了不存在的 `ctx`，首次防抖拉取即抛 `ReferenceError` 使 React 崩溃；改为在 `apply()` 中捕获 `pluginCtx`。
- **client 依赖声明**：`exports.inject` 完整声明 `['slots', 'sessions', 'timer']`。
- **安装流程 v2**：`install.ps1` 改为 `dsh plugin --profile web add "dsh-bubble-nav@file:..."` 装进 profile 依赖树。v1 把包复制到全局 `node_modules`——dsh 的插件解析锚点是 profile 目录，全局目录不在解析链上，会直接抛 `Cannot find package 'dsh-bubble-nav'` 让 dsh 启动崩溃（fail-loud）。
- **package.json**：补充 `peerDependencies: react`。

## [1.0.0] - 2026-08

首个公开发布版本。

### 新增

- **加速球**：可拖拽的蓝色渐变悬浮球，球心显示问题数；点击开/关问题列表，拖到右缘自动吸附半隐藏。
- **问题列表**：只显示用户提问，带序号与时间（当天 `HH:MM`，跨天 `M/D HH:MM`）。
- **全对话框**：完整对话大纲（问题/回答/工具/命令），分类筛选、标题栏拖拽、右下角缩放。
- **完整历史**：Host 直接读取会话日志，一次性展示整个会话，无需手动「展开更多」。
- **智能定位**：点击条目自动加载更早历史并只滚动对话区定位。
- **一键安装**：`install.ps1` 自动定位 DSH 目录并完成安装。
