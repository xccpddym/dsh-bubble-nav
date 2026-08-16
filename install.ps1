<#
  dsh-bubble-nav 一键安装脚本
  用法：克隆/下载本仓库后，在仓库根目录运行  .\install.ps1
  可选参数：
    -DshNodeModules  直接指定 DSH 的 node_modules 路径（跳过自动检测）
    -DshHome         DSH 用户目录（默认 %USERPROFILE%\.dsh）
#>
param(
  [string]$DshNodeModules = '',
  [string]$DshHome = ''
)

$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
if (-not (Test-Path (Join-Path $src 'package.json'))) {
  Write-Error '未找到 package.json，请在仓库根目录运行本脚本。'
  exit 1
}
if (-not $DshHome) { $DshHome = Join-Path $env:USERPROFILE '.dsh' }

Write-Host '== dsh-bubble-nav 安装 ==' -ForegroundColor Cyan

# ── [1/3] 定位 DSH 安装目录 ──────────────────────────────
$nm = $DshNodeModules
if (-not $nm) {
  $candidates = @()
  if ($env:LOCALAPPDATA) { $candidates += (Join-Path $env:LOCALAPPDATA 'npm-cache\_npx') }
  if (Test-Path 'D:\Node.js\node_cache\_npx') { $candidates += 'D:\Node.js\node_cache\_npx' }
  try {
    $cache = npm config get cache 2>$null
    if ($cache -and (Test-Path $cache)) { $candidates += (Join-Path $cache '_npx') }
  } catch {}
  foreach ($c in $candidates) {
    if (-not (Test-Path $c)) { continue }
    $hit = Get-ChildItem $c -Directory -ErrorAction SilentlyContinue |
      Where-Object { Test-Path (Join-Path $_.FullName 'node_modules\@deepseek-ai\dsh\package.json') } |
      Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($hit) { $nm = Join-Path $hit.FullName 'node_modules'; break }
  }
  if (-not $nm) {
    Write-Error '未自动找到 DSH 安装目录。请用 -DshNodeModules 参数指定 DSH 的 node_modules 路径后重试。'
    exit 1
  }
}
Write-Host "[1/3] DSH node_modules: $nm"

# ── [2/3] 复制插件包 ─────────────────────────────────────
$dest = Join-Path $nm 'dsh-bubble-nav'
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
Copy-Item -Recurse $src $dest
Write-Host "[2/3] 插件已复制到: $dest"

# ── [3/3] cordis.patch.yml 追加启用行 ────────────────────
$patch = Join-Path $DshHome 'cordis.patch.yml'
$entry = @"

# --- dsh-bubble-nav (对话气泡导航) ---
- insert:
    - id: bubble-nav
      name: 'dsh-bubble-nav'
"@
if (Test-Path $patch) {
  $content = Get-Content $patch -Raw
  if ($content -notmatch 'dsh-bubble-nav') {
    Add-Content $patch $entry -Encoding UTF8
    Write-Host "[3/3] 已在 $patch 追加启用行"
  } else {
    Write-Host "[3/3] $patch 已包含启用行，跳过"
  }
} else {
  Write-Host "[3/3] 未找到 $patch，请手动创建并添加以下内容："
  Write-Host "  - insert:"
  Write-Host "      - id: bubble-nav"
  Write-Host "        name: 'dsh-bubble-nav'"
}

Write-Host ''
Write-Host '✅ 安装完成！请重启 DSH（完全退出后重新启动）使插件生效。' -ForegroundColor Green
