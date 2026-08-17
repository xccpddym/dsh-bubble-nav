# dsh-bubble-nav

气泡导航插件 —— 为 [DSH（DeepSeek Harness）](https://github.com/deepseek-ai/deepseek-harness) 的 Web 界面提供**对话气泡导航**：一颗可拖拽的悬浮加速球列出你问过的所有问题（带序号与时间），另有全量「对话大纲」面板，点击即可在对话中精确定位。

![bubble](docs/bubble.png)

## ✨ 特性

- **加速球**：蓝色渐变悬浮球，球心显示问题数；**点击开/关**问题列表，**拖拽移动**，拖到右缘**自动吸附半隐藏**
- **问题列表**：只显示你说过的话/提出的问题，带 **序号 + 时间**（当天 `HH:MM`，跨天 `M/D HH:MM`），纯文字、简洁
- **全对话框**：完整大纲（问题/回答/工具/命令），支持**分类筛选**、**标题栏拖拽**、**右下角缩放**
- **完整历史**：Host 直接读取会话日志（`sessionQuery.readSession`），一次性展示**整个会话**，无需手动「展开更多」
- **智能定位**：点击条目自动加载更早历史并**只滚动对话区**定位（不带动整页跳动）
- 两界面**互斥分离**，不互相干扰

## 📦 安装

> 要求：Windows + DSH（npm 全局安装 `@deepseek-ai/dsh`）+ PowerShell 7+。

### 一键安装（推荐）

```powershell
npx dsh-bubble-nav
```

npx 自动下载安装器并完成全部步骤：

1. 从 npm 把插件**装进 web profile 依赖树**（`dsh plugin --profile web add`）
2. 在 `~/.dsh/cordis.patch.yml` 追加启用条目（幂等，重复执行安全）
3. `dump-config` 验证配置能正常合成

最后**重启 DSH** 即可生效。

其他用法：

```powershell
npx dsh-bubble-nav --profile tui      # 安装到其他 profile
npx dsh-bubble-nav --uninstall        # 卸载（移除依赖 + 启用条目）
npx dsh-bubble-nav --check            # 只检测环境，不修改任何文件
```

### 源码安装（离线 / 开发者）

```powershell
# 先进入插件仓库目录（clone 或下载解压后、包含 install.ps1 的位置）
cd <你的仓库目录>
.\install.ps1
```

### 手动安装

```powershell
# 先进入插件仓库目录，再执行（file: 需要绝对路径，这里动态取当前目录）
cd <你的仓库目录>
dsh plugin --profile web add "dsh-bubble-nav@file:$((Get-Location).Path)"

# 2) 在 ~/.dsh/cordis.patch.yml 末尾追加
# - insert:
#     - id: bubble-nav
#       name: 'dsh-bubble-nav'

# 3) 验证 + 重启
dsh --profile web --dump-config
```

> ⚠️ 不要直接把插件复制到全局 `node_modules`（例如 `npm root -g` 输出的目录）。
> dsh 的插件解析锚点是 profile 目录，全局 node_modules 不在解析链上；
> 只复制包 + 加启用条目会导致 `Cannot find package 'dsh-bubble-nav'`，dsh 启动即崩（fail-loud）。

## 🎮 使用

| 操作 | 效果 |
|---|---|
| 点击加速球 | 展开/收起问题列表 |
| 拖拽加速球 | 移动位置；拖到右缘松手 → 吸附半隐藏 |
| 点击问题条目 | 对话区自动加载并滚动定位到该问题 |
| 点击会话头部大纲按钮 | 打开/关闭全对话框（分类筛选 + 拖拽 + 缩放） |

## 🗑 卸载

```powershell
cd <你的仓库目录>
.\install.ps1 -Uninstall
```

或手动：移除 `~/.dsh/cordis.patch.yml` 中的 `bubble-nav` 条目，再 `dsh plugin --profile web remove dsh-bubble-nav`，重启 DSH。

## ⚠️ 升级 DSH 后

DSH 升级会重建 profile 依赖树，此时重新运行一次 `install.ps1` 即可。

## 📄 License

[MIT](LICENSE)
