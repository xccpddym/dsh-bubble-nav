#!/usr/bin/env node
// dsh-bubble-nav 一键安装器（npx dsh-bubble-nav）
//
// 自动完成 dsh 插件安装的两步硬要求：
//   1) 把插件装进指定 profile 的依赖树（dsh plugin --profile <p> add，pnpm 从 npm 拉取）
//   2) 在 ~/.dsh/cordis.patch.yml 追加/恢复启用条目（幂等）
// 外加 dump-config 验证。卸载模式移除依赖与条目。
//
// 用法:
//   npx dsh-bubble-nav                安装到 web profile
//   npx dsh-bubble-nav --profile tui  指定 profile
//   npx dsh-bubble-nav --uninstall    卸载
//   npx dsh-bubble-nav --check        只检测环境，不修改任何东西
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url)) // .../bin
const PKG_ROOT = dirname(HERE) // 包根目录（install.js 在 bin/ 下）
const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8'))
const NAME = pkg.name
const VERSION = pkg.version
const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const PATCH_FILE = join(DSH_HOME, 'cordis.patch.yml')
const PATCH_BLOCK = `\n# --- ${NAME} (对话气泡导航) ---\n- insert:\n    - id: bubble-nav\n      name: '${NAME}'\n`

function parseArgs(argv) {
  const args = { profile: 'web', uninstall: false, check: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--uninstall' || a === '-u') args.uninstall = true
    else if (a === '--check' || a === '-c') args.check = true
    else if (a === '--profile' || a === '-p') args.profile = argv[++i] || 'web'
    else if (a === '--help' || a === '-h') args.help = true
  }
  return args
}

/** Run a command, streaming its output through (so users see pnpm progress). */
function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', stdio: 'inherit', ...opts })
  return { code: res.status === null ? 1 : res.status, error: res.error }
}

/** Locate the dsh launcher (bin.js). DSH_BIN wins; then npm global install. */
function locateDsh() {
  if (process.env.DSH_BIN && existsSync(process.env.DSH_BIN)) return process.env.DSH_BIN
  try {
    const root = spawnSync('npm', ['root', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    if (root.status === 0) {
      const cand = join(root.stdout.trim(), '@deepseek-ai', 'dsh', 'lib', 'bin.js')
      if (existsSync(cand)) return cand
    }
  } catch { /* fall through */ }
  return null
}

function patchEnabled() {
  try {
    return existsSync(PATCH_FILE) && readFileSync(PATCH_FILE, 'utf8').includes(NAME)
  } catch {
    return false
  }
}

function ensurePatch() {
  if (patchEnabled()) {
    console.log(`  ✓ ${PATCH_FILE} 已包含启用条目，跳过`)
    return true
  }
  try {
    if (existsSync(PATCH_FILE)) writeFileSync(PATCH_FILE, readFileSync(PATCH_FILE, 'utf8') + PATCH_BLOCK)
    else writeFileSync(PATCH_FILE, PATCH_BLOCK)
    console.log(`  ✓ 已在 ${PATCH_FILE} 追加启用条目`)
    return true
  } catch (err) {
    console.error(`  ✗ 写入 ${PATCH_FILE} 失败: ${err.message}`)
    return false
  }
}

function removePatch() {
  try {
    if (!existsSync(PATCH_FILE)) return true
    const content = readFileSync(PATCH_FILE, 'utf8')
    const pattern = new RegExp(`(^|\\n)\\s*# --- ${NAME}[^\\n]*\\n- insert:\\n\\s+- id: bubble-nav\\n\\s+name: '${NAME}'\\n?`, 'g')
    const next = content.replace(pattern, '')
    if (next !== content) writeFileSync(PATCH_FILE, next)
    return true
  } catch (err) {
    console.error(`  ✗ 移除启用条目失败: ${err.message}`)
    return false
  }
}

function printHelp() {
  console.log(`${NAME} v${VERSION} — 一键安装器

用法:
  npx ${NAME} [选项]

选项:
  --profile <name>   安装到的 dsh profile（默认 web）
  --uninstall, -u    卸载（移除 profile 依赖 + 启用条目）
  --check, -c        只检测环境（dsh 是否就位），不修改任何文件
  --help, -h         显示本帮助
`)
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  console.log(`\n== ${NAME} v${VERSION} 安装器 ==\n`)
  if (args.help) {
    printHelp()
    return
  }
  const dshBin = locateDsh()
  if (!dshBin) {
    console.error('✗ 未找到 dsh（@deepseek-ai/dsh）。请先安装 dsh（npm i -g @deepseek-ai/dsh）后重试。')
    process.exit(1)
  }
  console.log(`  dsh:     ${dshBin}`)
  console.log(`  profile: ${args.profile}`)
  if (args.check) {
    console.log('  ✓ 环境就绪（--check 模式，未做任何修改）')
    return
  }

  const node = process.execPath
  if (args.uninstall) {
    console.log('\n[卸载] 移除 profile 依赖 ...')
    run(node, [dshBin, 'plugin', '--profile', args.profile, 'remove', NAME])
    console.log('[卸载] 移除启用条目 ...')
    removePatch()
    console.log('\n✅ 卸载完成，重启 dsh 生效。')
    return
  }

  console.log('\n[1/3] 从 npm 安装到 profile 依赖树 ...')
  const add = run(node, [dshBin, 'plugin', '--profile', args.profile, 'add', `${NAME}@${VERSION}`])
  if (add.code !== 0) {
    console.error(`✗ 依赖安装失败（exit ${add.code}）。可手动运行: dsh plugin --profile ${args.profile} add "${NAME}@${VERSION}"`)
    process.exit(add.code)
  }

  console.log('\n[2/3] 启用条目 ...')
  if (!ensurePatch()) process.exit(1)

  console.log('\n[3/3] 验证配置合成 ...')
  const dump = run(node, [dshBin, '--profile', args.profile, '--dump-config'], { stdio: ['ignore', 'ignore', 'inherit'] })
  if (dump.code === 0) console.log('  ✓ dump-config 通过（exit 0）')
  else console.warn(`  ⚠ dump-config 退出码 ${dump.code}，请检查上方输出`)

  console.log('\n✅ 安装完成！请重启 dsh（完全退出后重新启动）使插件生效。')
}

main()
