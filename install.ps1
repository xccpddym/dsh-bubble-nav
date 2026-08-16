<#
  dsh-bubble-nav 安装脚本（v2）

  正确安装方式：把插件装进 dsh 的 web profile 依赖树（pnpm 管理），再启用
  cordis.patch.yml 里的加载条目。v1 把包复制到「全局 node_modules」是错的 ——
  dsh 的插件解析锚点是 profile 目录（Cordis Loader baseUrl），全局 node_modules
  不在解析链上，包装了却解析不到，会直接抛 "Cannot find package 'dsh-bubble-nav'"
  并让 dsh 启动崩溃（fail-loud）。

  用法：
    .\install.ps1                  # 安装到 web profile 并启用
    .\install.ps1 -Profile tui     # 指定其他 profile
    .\install.ps1 -Uninstall       # 卸载（移除依赖 + 禁用条目）

  可选参数：
    -DshHome   DSH 用户目录（默认 %USERPROFILE%\.dsh）
#>
param(
  [string]$Profile = 'web',
  [switch]$Uninstall,
  [string]$DshHome = ''
)
$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
if (-not (Test-Path (Join-Path $src 'package.json'))) {
  Write-Error '未找到 package.json，请在插件仓库根目录运行本脚本。'
  exit 1
}
if (-not $DshHome) { $DshHome = Join-Path $env:USERPROFILE '.dsh' }

# ── 定位 dsh 可执行（node + bin.js，绕过 dsh.ps1 shim） ─────────────
$dshBin = ''
try {
  $g = npm root -g 2>$null
  if ($g -and (Test-Path (Join-Path $g '@deepseek-ai\dsh\lib\bin.js'))) {
    $dshBin = Join-Path $g '@deepseek-ai\dsh\lib\bin.js'
  }
} catch {}
if (-not $dshBin) {
  Write-Error '未找到 dsh 安装（@deepseek-ai/dsh）。请先安装 dsh 后重试。'
  exit 1
}
Write-Host "[定位] dsh bin: $dshBin"

$patch = Join-Path $DshHome 'cordis.patch.yml'
$entryBlock = @"

# --- dsh-bubble-nav (对话气泡导航) ---
- insert:
    - id: bubble-nav
      name: 'dsh-bubble-nav'
"@

if ($Uninstall) {
  Write-Host '[卸载] 移除 profile 依赖 ...'
  & node $dshBin plugin --profile $Profile remove dsh-bubble-nav
  if (Test-Path $patch) {
    $content = Get-Content $patch -Raw
    if ($content -match 'dsh-bubble-nav') {
      $pattern = '(?ms)^\s*# --- dsh-bubble-nav[^\r\n]*\r?\n- insert:\r?\n\s+- id: bubble-nav\r?\n\s+name: ''dsh-bubble-nav''\r?\n?'
      $new = [regex]::Replace($content, $pattern, '')
      Set-Content $patch $new -Encoding utf8 -NoNewline
      Write-Host '[卸载] 已移除 cordis.patch.yml 中的启用条目'
    } else {
      Write-Host '[卸载] cordis.patch.yml 中无启用条目，跳过'
    }
  }
  Write-Host '卸载完成，重启 dsh 生效。'
  exit 0
}

# ── [1/3] 装进 profile 依赖树（解析链可达） ──────────────────────────
Write-Host "[1/3] 安装 dsh-bubble-nav 到 profile '$Profile' ..."
& node $dshBin plugin --profile $Profile add "dsh-bubble-nav@file:$src"
if ($LASTEXITCODE -ne 0) {
  Write-Host "`npnpm add 失败（exit $LASTEXITCODE）。请手动运行：`n  dsh plugin --profile $Profile add `"dsh-bubble-nav@file:$src`"" -ForegroundColor Yellow
  exit $LASTEXITCODE
}
Write-Host '[1/3] 依赖安装完成'

# ── [2/3] 追加/恢复 cordis.patch.yml 启用条目 ────────────────────────
Write-Host '[2/3] 检查启用条目 ...'
if (Test-Path $patch) {
  $content = Get-Content $patch -Raw
  if ($content -notmatch 'dsh-bubble-nav') {
    Add-Content $patch $entryBlock -Encoding utf8
    Write-Host "[2/3] 已在 $patch 追加启用条目"
  } else {
    Write-Host '[2/3] 已包含启用条目，跳过'
  }
} else {
  Set-Content $patch $entryBlock -Encoding utf8
  Write-Host "[2/3] 未找到 $patch，已创建"
}

# ── [3/3] 验证配置合成 ───────────────────────────────────────────────
Write-Host '[3/3] 验证配置合成（dump-config）...'
& node $dshBin --profile $Profile --dump-config *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Host '[3/3] dump-config 通过（exit 0），插件可正常解析'
} else {
  Write-Host "[3/3] 警告：dump-config 退出码 $LASTEXITCODE，请检查上方输出" -ForegroundColor Yellow
}

Write-Host ''
Write-Host '✅ 安装完成！请重启 dsh（完全退出后重新启动）使插件生效。' -ForegroundColor Green
