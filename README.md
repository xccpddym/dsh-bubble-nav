# dsh-bubble-nav

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![GitHub stars](https://img.shields.io/github/stars/xccpddym/dsh-bubble-nav)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20DSH-4d6bfe.svg)

气泡导航插件 —— 为 [DSH（DeepSeek Harness）](https://github.com/deepseek-ai/deepseek-harness) 的 Web 界面提供**对话气泡导航**：一颗可拖拽的悬浮加速球列出你问过的所有问题（带序号与时间），另有全量「对话大纲」面板，点击即可在对话中精确定位。

![bubble](docs/bubble.png)

## ✨ 特性

- **加速球**：蓝色渐变悬浮球，球心显示问题数；**点击开/关**问题列表，**拖拽移动**，拖到右缘**自动吸附半隐藏**
- **问题列表**：只显示你说过的话/提出的问题，带 **序号 + 时间**（当天 `HH:MM`，跨天 `M/D HH:MM`），纯文字、简洁
- **全对话框**：完整大纲（问题/回答/工具/命令），支持**分类筛选**、**标题栏拖拽**、**右下角缩放**
- **完整历史**：Host 直接读取会话日志，一次性展示**整个会话**，无需手动「展开更多」
- **智能定位**：点击条目自动加载更早历史并**只滚动对话区**定位（不带动整页跳动）
- 两界面**互斥分离**，不互相干扰

## 📦 安装

> 要求：Windows + DSH（`npx dsh` 方式启动），已安装 PowerShell 7+。

### 一键安装（推荐）

```powershell
# 克隆/下载本仓库后，进入仓库目录
.\install.ps1
```

脚本会自动完成三件事：
1. 定位你机器上 DSH 的安装目录（npx 缓存）
2. 把插件复制到 DSH 的 `node_modules`
3. 在 `~/.dsh/cordis.patch.yml` 追加启用行（已存在则跳过）

最后**重启 DSH** 即可生效。

### 手动安装

```powershell
# 1) 复制插件包到 DSH 的 node_modules（路径以实际 npx 缓存为准）
Copy-Item -Recurse .\dsh-bubble-nav "D:\Node.js\node_cache\_npx\<版本号>\node_modules\dsh-bubble-nav"

# 2) 在 ~/.dsh/cordis.patch.yml 末尾追加
# - insert:
#     - id: bubble-nav
#       name: 'dsh-bubble-nav'

# 3) 重启 DSH
```

## 🎮 使用

| 操作 | 效果 |
|---|---|
| 点击加速球 | 展开/收起问题列表 |
| 拖拽加速球 | 移动位置；拖到右缘松手 → 吸附半隐藏 |
| 点击问题条目 | 对话区自动加载并滚动定位到该问题 |
| 点击会话头部大纲按钮 | 打开/关闭全对话框（分类筛选 + 拖拽 + 缩放） |

## 🗑 卸载

1. 删除 `~/.dsh/cordis.patch.yml` 中的 `bubble-nav` 行
2. 删除 DSH node_modules 下的 `dsh-bubble-nav` 目录
3. 重启 DSH

## ⚠️ 升级 DSH 后

DSH 通过 npx 启动，升级/清理缓存会重建安装目录，此时需重新运行一次 `install.ps1`。

## 📄 License

[MIT](LICENSE)
