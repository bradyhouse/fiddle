#!/usr/bin/env node
import { Command } from 'commander'
import { createInterface } from 'node:readline/promises'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { REGISTRY } from './registry.js'
import { CONFIG_FILE, CONFIG_KEYS, loadConfig, resolveHome, setConfigKey } from './config.js'
import {
  copyFiddle,
  copyTemplate,
  cwdFiddle,
  frameworkDir,
  getEntry,
  inferStart,
  injectDefaults,
  listCollection,
  nextNumber,
  openInEditor,
  openTerminal,
  openUrl,
  readMeta,
  resolveFiddle,
  runShell,
  tryShell,
  writeMeta
} from './core.js'
import { claudeMd } from './defaults.js'
import { buildManifest, shellHtml } from './portfolio.js'
import { captureServed } from './screenshot.js'
import { serveDir } from './serve.js'
import { banner, c, nope } from './ui.js'

const isBrowser = (start: string) => !start.startsWith('node')
const friendly = (dir: string) => path.basename(dir).replace(/^fiddle-\d+-/, '')

// Adopted fiddles carry aged transitive deps whose peer ranges no longer agree
// (npm v7+ errors where npm v4 shrugged). When running the archive — build,
// start, publish — install like the archive it is; authoring (create/fork)
// stays strict so new templates surface real peer issues.
const NPM_INSTALL = 'npm install --legacy-peer-deps'

async function prompt(q: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const a = (await rl.question(c.amber(`  ${q} `))).trim()
  rl.close()
  return a
}

/** Is a command resolvable on PATH? */
function have(bin: string): boolean {
  try {
    execSync(process.platform === 'win32' ? `where ${bin}` : `command -v ${bin}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

async function confirm(q: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const a = (await rl.question(c.amber(`  ${q} (y/N) `))).trim().toLowerCase()
  rl.close()
  return a === 'y' || a === 'yes'
}

const program = new Command()
program
  .name('fiddle')
  .description('Scaffold, iterate on, and publish framework sandbox "fiddles".')
  .version('0.1.0')
  .showHelpAfterError()

// ── config ──────────────────────────────────────────────────────────────────
const config = program.command('config').description('view or set fiddle configuration')
config
  .command('list')
  .description('show every setting — including ones you can set but haven\'t')
  .action(() => {
    const cfg = loadConfig()
    console.log(banner('config'))
    console.log(
      '  file: ' + c.dim(CONFIG_FILE) + (fs.existsSync(CONFIG_FILE) ? '' : c.dim('  (not created yet)')) + '\n'
    )
    for (const { key, desc, default: def } of CONFIG_KEYS) {
      const v = cfg[key]
      const value =
        v !== undefined && v !== def
          ? c.green(v)
          : v !== undefined
            ? c.green(v) + c.dim('  (default)')
            : def
              ? c.dim(def + '  (default)')
              : c.dim('(unset)')
      console.log('  ' + c.bold(key.padEnd(13)) + value)
      console.log('  ' + ' '.repeat(13) + c.dim(desc))
    }
    // surface any custom keys the user set that aren't in the known registry
    const known = new Set(CONFIG_KEYS.map((k) => k.key))
    const extra = Object.entries(cfg).filter(([k]) => !known.has(k))
    if (extra.length) {
      console.log('\n  ' + c.dim('custom:'))
      for (const [k, v] of extra) console.log('  ' + c.bold(k.padEnd(13)) + c.green(String(v)))
    }
    console.log('')
  })
config
  .command('set')
  .description('set a config value (e.g. home, publishRepo)')
  .argument('<key>', 'config key')
  .argument('<value>', 'value')
  .action((key: string, value: string) => {
    setConfigKey(key, value)
    console.log('  ✓ ' + c.green(key) + ' = ' + value)
  })

// ── setup ─────────────────────────────────────────────────────────────────────
program
  .command('setup')
  .description('one-time setup — check prerequisites, initialize config, install the screenshot browser')
  .action(async () => {
    console.log(banner('setup'))

    // 1. prerequisites
    console.log('  ' + c.bold('prerequisites'))
    const nodeMajor = parseInt(process.versions.node.split('.')[0], 10)
    console.log(`    ${nodeMajor >= 18 ? c.green('✓') : c.red('✗')} node ${process.versions.node}${nodeMajor >= 18 ? '' : c.red('  (need ≥18)')}`)
    console.log(`    ${have('git') ? c.green('✓') : c.amber('!')} git${have('git') ? '' : c.dim('  (needed for `fiddle publish`)')}`)
    const editor = loadConfig().editor || 'code'
    console.log(`    ${have(editor) ? c.green('✓') : c.amber('!')} editor: ${editor}${have(editor) ? '' : c.dim('  (not on PATH — `fiddle config set editor <cmd>`)')}`)

    // 2. config
    console.log('\n  ' + c.bold('config'))
    const cfg = loadConfig()
    if (process.stdin.isTTY) {
      const home = (await prompt(`home [${cfg.home}]:`)) || cfg.home
      setConfigKey('home', home)
      const repo = await prompt(`publishRepo (optional) [${cfg.publishRepo || 'unset'}]:`)
      if (repo) setConfigKey('publishRepo', repo)
    } else {
      setConfigKey('home', cfg.home) // non-interactive: persist the defaults
      console.log(c.dim('    (non-interactive — kept defaults; `fiddle config set <key> <value>` to change)'))
    }
    fs.mkdirSync(resolveHome(), { recursive: true })
    console.log(`    home → ${c.green(resolveHome())}`)
    console.log(`    file → ${c.dim(CONFIG_FILE)}`)

    // 3. screenshot browser (portfolio thumbnails)
    console.log('\n  ' + c.bold('screenshot browser') + c.dim('  — for portfolio thumbnails'))
    const wantsBrowser = process.stdin.isTTY ? await confirm('install Chromium now? (~150MB)') : false
    if (wantsBrowser) {
      try {
        await runShell('npx --yes playwright install chromium', process.cwd())
        console.log(`    ${c.green('✓')} Chromium installed`)
      } catch {
        console.log(`    ${c.amber('!')} install failed — thumbnails fall back to placeholders`)
      }
    } else {
      console.log(c.dim('    skipped — thumbnails fall back to placeholders (`npx playwright install chromium` any time)'))
    }

    console.log(`\n  ${c.green('✓')} ready.   ${c.dim('fiddle create <framework> <name>')}\n`)
  })

// ── adopt ─────────────────────────────────────────────────────────────────────
program
  .command('adopt')
  .description('bring an existing collection under management — write a .fiddle.json for each fiddle')
  .argument('[framework]', 'limit to one framework')
  .option('--dry-run', 'report what would be adopted; write nothing')
  .option('--force', 're-adopt even where a .fiddle.json already exists')
  .action(async (framework, opts) => {
    const home = resolveHome()
    console.log(banner('adopt'))
    console.log(c.dim(`  ${home}\n`))
    const frameworks = (
      framework
        ? [framework]
        : fs.readdirSync(home).filter((d) => !d.startsWith('.') && fs.statSync(path.join(home, d)).isDirectory())
    ).sort()

    let adopted = 0
    let runnable = 0
    let skipped = 0
    for (const fw of frameworks) {
      const fwDir = path.join(home, fw)
      if (!fs.statSync(fwDir, { throwIfNoEntry: false })?.isDirectory()) continue
      let n = 0
      let run = 0
      for (const name of fs.readdirSync(fwDir)) {
        const dir = path.join(fwDir, name)
        if (!fs.statSync(dir).isDirectory()) continue
        // Only the fiddle-NNNN- convention — not any dir with an index.html
        // (that false-matches build output like dist/, out/, coverage/).
        if (!/^fiddle-\d+-/.test(name)) continue
        if (fs.existsSync(path.join(dir, '.fiddle.json')) && !opts.force) {
          skipped++
          continue
        }
        const start = inferStart(dir)
        if (!opts.dryRun) {
          // Preserve an existing createdAt on --force re-adopt — writing
          // .fiddle.json bumps the dir mtime, so re-deriving it would clobber
          // the real age. Only derive from mtime on a first, fresh adopt.
          let createdAt: string | undefined
          try {
            createdAt = readMeta(dir).createdAt
          } catch {
            /* not yet adopted */
          }
          if (!createdAt) {
            try {
              createdAt = fs.statSync(dir).mtime.toISOString()
            } catch {
              createdAt = new Date().toISOString()
            }
          }
          writeMeta(dir, { framework: fw, name, start, createdAt })
        }
        n++
        if (start) run++
      }
      if (n) {
        console.log(`    ${fw.padEnd(14)} ${String(n).padStart(3)} ${run < n ? c.dim(`(${run} runnable)`) : c.green(`(${run} runnable)`)}`)
        adopted += n
        runnable += run
      }
    }
    const verb = opts.dryRun ? c.amber('would adopt') : c.green('✓ adopted')
    console.log(
      `\n  ${verb} ${adopted} · ${runnable} runnable · ${adopted - runnable} no-entry${skipped ? c.dim(` · ${skipped} already managed`) : ''}\n`
    )
  })

// ── create ──────────────────────────────────────────────────────────────────
program
  .command('create')
  .description('scaffold a new fiddle into your collection')
  .argument('[framework]', 'framework — see `fiddle list`')
  .argument('[name]', 'friendly name')
  .option('--no-install', 'skip npm install')
  .action(async (framework, nameArg, opts, cmd) => {
    if (!framework) return void (console.log(banner('create')), cmd.outputHelp())
    const entry = getEntry(framework)
    const fwDir = frameworkDir(framework)
    const dirName = `fiddle-${nextNumber(fwDir)}-${nameArg || framework}`
    const target = path.join(fwDir, dirName)
    if (fs.existsSync(target)) throw new Error(`${dirName} already exists`)

    console.log(banner(`create · ${framework}`))
    console.log(c.dim(`  → ${target}\n`))
    if (entry.provider === 'delegate') {
      await runShell(entry.run!.replace(/{name}/g, dirName), fwDir)
    } else {
      copyTemplate(entry.dir!, target)
    }
    injectDefaults(target, framework, dirName, isBrowser(entry.start))
    writeMeta(target, { framework, name: dirName, start: entry.start, createdAt: new Date().toISOString() })
    if (opts.install) {
      console.log(c.dim('\n  installing…\n'))
      await runShell('npm install', target)
    }
    console.log(`\n  ✓ ${c.green(dirName)} ready.   ${c.dim(`fiddle start ${framework} ${friendly(target)}`)}\n`)
  })

// ── fork ────────────────────────────────────────────────────────────────────
program
  .command('fork')
  .description('copy an existing fiddle to iterate from it')
  .argument('[framework]')
  .argument('[source]', 'the fiddle to fork (friendly name or dir)')
  .argument('[name]', 'name for the fork')
  .option('--no-install', 'skip npm install')
  .action(async (framework, source, nameArg, opts, cmd) => {
    if (!framework || !source) return void (console.log(banner('fork')), cmd.outputHelp())
    const srcDir = resolveFiddle(framework, source)
    const fwDir = frameworkDir(framework)
    const dirName = `fiddle-${nextNumber(fwDir)}-${nameArg || friendly(srcDir)}`
    const target = path.join(fwDir, dirName)

    console.log(banner(`fork · ${framework}`))
    console.log(c.dim(`  ${path.basename(srcDir)} → ${dirName}\n`))
    copyFiddle(srcDir, target)
    const meta = readMeta(target)
    writeMeta(target, { ...meta, name: dirName, createdAt: new Date().toISOString() })
    fs.writeFileSync(path.join(target, 'CLAUDE.md'), claudeMd(framework, dirName))
    if (opts.install) {
      console.log(c.dim('  installing…\n'))
      await runShell('npm install', target)
    }
    console.log(`\n  ✓ forked to ${c.green(dirName)}\n`)
  })

// ── refactor (rename) ─────────────────────────────────────────────────────────
program
  .command('refactor')
  .alias('rename')
  .description('rename a fiddle (keeps its number)')
  .argument('[framework]')
  .argument('[old]', 'existing fiddle')
  .argument('[new]', 'new name')
  .action((framework, oldName, newName, opts, cmd) => {
    if (!framework || !oldName || !newName) return void (console.log(banner('refactor')), cmd.outputHelp())
    const srcDir = resolveFiddle(framework, oldName)
    const num = path.basename(srcDir).match(/^fiddle-(\d+)-/)?.[1] ?? nextNumber(frameworkDir(framework))
    const dirName = `fiddle-${num}-${newName}`
    const target = path.join(frameworkDir(framework), dirName)
    fs.renameSync(srcDir, target)
    writeMeta(target, { ...readMeta(target), name: dirName })
    fs.writeFileSync(path.join(target, 'CLAUDE.md'), claudeMd(framework, dirName))
    console.log(banner('refactor'))
    console.log(`  ✓ ${path.basename(srcDir)} → ${c.green(dirName)}\n`)
  })

// ── delete ────────────────────────────────────────────────────────────────────
program
  .command('delete')
  .alias('rm')
  .description('delete a fiddle (ideas are sometimes junk)')
  .argument('[framework]')
  .argument('[name]')
  .option('-y, --yes', 'skip confirmation')
  .action(async (framework, name, opts, cmd) => {
    if (!framework || !name) return void (console.log(banner('delete')), cmd.outputHelp())
    const dir = resolveFiddle(framework, name)
    if (!opts.yes && !(await confirm(`delete ${c.red(path.basename(dir))}?`))) {
      console.log(c.dim('  cancelled.'))
      return
    }
    fs.rmSync(dir, { recursive: true, force: true })
    console.log(`  ✓ deleted ${c.red(path.basename(dir))}`)
  })

// ── start ──────────────────────────────────────────────────────────────────────
program
  .command('start')
  .description('run a fiddle (its recorded dev command)')
  .argument('[framework]')
  .argument('[name]')
  .action(async (framework, name, opts, cmd) => {
    if (!framework || !name) return void (console.log(banner('start')), cmd.outputHelp())
    const dir = resolveFiddle(framework, name)
    const meta = readMeta(dir)
    console.log(banner(`start · ${friendly(dir)}`))
    if (!fs.existsSync(path.join(dir, 'node_modules'))) {
      console.log(c.dim('  installing…\n'))
      await runShell(NPM_INSTALL, dir)
    }
    console.log(c.dim(`  ${meta.start}   (Ctrl+C to stop)\n`))
    await runShell(meta.start, dir)
  })

// ── edit ──────────────────────────────────────────────────────────────────────
program
  .command('edit')
  .description('open a fiddle in your editor + a terminal')
  .argument('[framework]')
  .argument('[name]', 'fiddle — by number (1 / 0001) or name')
  .action((framework, name, opts, cmd) => {
    if (!framework || !name) return void (console.log(banner('edit')), cmd.outputHelp())
    const dir = resolveFiddle(framework, name)
    console.log(banner(`edit · ${friendly(dir)}`))
    openInEditor(dir)
    openTerminal(dir)
    console.log(`  ✓ opened ${c.green(path.basename(dir))} in editor + terminal\n`)
  })

// ── list ──────────────────────────────────────────────────────────────────────
program
  .command('list')
  .alias('ls')
  .description('list your fiddle collection')
  .argument('[framework]', 'limit to one framework')
  .action((framework) => {
    const items = listCollection(framework)
    console.log(banner('list'))
    if (!items.length) {
      console.log(c.dim('  (empty — `fiddle create <framework>` to start)\n'))
      return
    }
    const byFw: Record<string, string[]> = {}
    for (const it of items) (byFw[it.framework] ||= []).push(it.name)
    for (const [fw, names] of Object.entries(byFw)) {
      console.log('  ' + c.green(fw) + c.dim(`  (${names.length})`))
      for (const n of names.sort()) console.log('    ' + n)
    }
    console.log('')
  })

// ── build ──────────────────────────────────────────────────────────────────────
program
  .command('build')
  .description('build fiddle(s): the one you\'re in, one by name, or the whole collection')
  .argument('[framework]')
  .argument('[name]')
  .action(async (framework, name, opts, cmd) => {
    const buildOne = async (dir: string, quiet = false) => {
      if (!isBrowser(readMeta(dir).start)) throw new Error(`${friendly(dir)} is a node fiddle — nothing to showcase`)
      if (!quiet) console.log(banner(`build · ${friendly(dir)}`))
      if (!fs.existsSync(path.join(dir, 'node_modules'))) await runShell(NPM_INSTALL, dir)
      await runShell('npm run build -- --base=./', dir) // relative base → works under /f/<fw>/<name>/
      if (!quiet) console.log(`\n  ✓ built → ${c.green('dist/')}\n`)
    }

    if (framework && name) return void (await buildOne(resolveFiddle(framework, name)))
    if (framework) return void (console.log(banner('build')), cmd.outputHelp()) // a lone arg is ambiguous

    // no args → the fiddle you're standing in, else the whole collection
    const here = cwdFiddle()
    if (here) return void (await buildOne(here))

    const all = listCollection().filter((it) => {
      try {
        return isBrowser(readMeta(it.dir).start)
      } catch {
        return false
      }
    })
    if (!all.length) {
      console.log(banner('build'))
      console.log(c.dim('  nothing to build — cd into a fiddle, or: fiddle build <framework> <name>\n'))
      return
    }
    console.log(banner(`build · ${all.length} fiddles`))
    for (const it of all) {
      console.log(c.dim(`  ${it.framework}/${friendly(it.dir)}`))
      await buildOne(it.dir, true)
    }
    console.log(`\n  ✓ built ${c.green(String(all.length))}\n`)
  })

interface AssembleResult {
  count: number
  staticCount: number
  built: number
  srcOnly: number
  skipped: number
}

/** How a fiddle gets into the portfolio: build its dist, copy it static, or skip. */
function renderMode(dir: string, start: string): 'static' | 'build' | 'skip' {
  if (!start || start.startsWith('node')) return 'skip' // not a browser fiddle (node/bash/c/…)
  if (builtDir(dir)) return 'build' // a committed dist/build → serve it even without a build script
  const pkgPath = path.join(dir, 'package.json')
  if (fs.existsSync(pkgPath)) {
    try {
      if (JSON.parse(fs.readFileSync(pkgPath, 'utf8')).scripts?.build) return 'build'
    } catch {
      /* malformed package.json — fall through to static */
    }
  }
  return fs.existsSync(path.join(dir, 'index.html')) ? 'static' : 'skip'
}

/**
 * A static fiddle only renders if the LOCAL scripts its index.html references
 * actually exist on disk. Many decade-old fiddles point at an app.js/bundle
 * that was a build artifact never committed — including those = a blank iframe.
 * Remote/CDN scripts can't be verified, so they're allowed through.
 */
function staticAssetsOk(dir: string): boolean {
  let html: string
  try {
    html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8')
  } catch {
    return false
  }
  for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    const src = m[1]
    if (/^(https?:)?\/\//.test(src) || src.startsWith('data:')) continue
    const rel = src.split(/[?#]/)[0].replace(/^\.?\//, '')
    if (rel && !fs.existsSync(path.join(dir, rel))) return false
  }
  return true
}

/**
 * A committed build output to serve as-is — `dist/` (vite) or `build/` (CRA),
 * whichever exists and is non-empty. Decade-old fiddles rarely rebuild on a
 * modern toolchain, but the bundle they shipped still renders. Prefer it.
 */
function builtDir(dir: string): string | null {
  for (const name of ['dist', 'build']) {
    const p = path.join(dir, name)
    try {
      if (fs.statSync(p).isDirectory() && fs.readdirSync(p).length) return p
    } catch {
      /* not present */
    }
  }
  return null
}

// Committed builds were compiled with an ABSOLUTE base baked to their old deploy
// path (e.g. vite `base: '/vue/<name>/'` for github.io), which 404s under the
// portfolio's `/f/<fw>/<name>/` layout → blank iframe. Rewrite that baked prefix
// to the served location across every text file in the copied build (no rebuild —
// vite/CRA configs hard-code the base and often no longer build). Absolute→absolute
// so it's depth-independent; assumes the portfolio is served at the domain root.
function rebaseBuiltDist(dest: string, framework: string, name: string): void {
  const baked = `/${framework}/${name}/`
  const served = `/f/${framework}/${name}/`
  let index: string
  try {
    index = fs.readFileSync(path.join(dest, 'index.html'), 'utf8')
  } catch {
    return
  }
  if (!index.includes(baked)) return // relative build (or a different base) — nothing to rebase
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(html?|c?js|mjs|css|json|map|svg|txt|webmanifest)$/i.test(e.name)) {
        try {
          const b = fs.readFileSync(p, 'utf8')
          if (b.includes(baked)) fs.writeFileSync(p, b.split(baked).join(served))
        } catch {
          /* skip unreadable/binary */
        }
      }
    }
  }
  walk(dest)
}

// Many old fiddles embed a "Fork me on GitHub" ribbon <img> from
// s3.amazonaws.com/github/ribbons/, which GitHub removed years ago → a broken-image
// icon in every one. Inject a style into the served index.html to hide it (covers
// static markup AND JS-rendered ribbons, since the CSS is global).
function hideDeadRibbons(dest: string): void {
  const idx = path.join(dest, 'index.html')
  let html: string
  try {
    html = fs.readFileSync(idx, 'utf8')
  } catch {
    return
  }
  const style =
    '<style>img[src*="s3.amazonaws.com/github"],img[src*="ribbons/forkme"],img[src*="ribbons%2Fforkme"]{display:none!important}</style>'
  if (html.includes(style)) return
  html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${style}</head>`) : style + html
  fs.writeFileSync(idx, html)
}

const SRC_EXT = new Set([
  // web
  '.html', '.htm', '.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx', '.vue', '.svelte', '.astro',
  '.css', '.scss', '.sass', '.less', '.json', '.svg', '.xml',
  // shell / systems
  '.sh', '.bash', '.zsh', '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.rs', '.go',
  // jvm / mobile
  '.java', '.kt', '.kts', '.gradle', '.groovy', '.properties', '.swift', '.m', '.mm',
  // scripting
  '.py', '.rb', '.php', '.pl', '.lua', '.r', '.cs',
  // data / docs / config
  '.yml', '.yaml', '.toml', '.ini', '.sql', '.graphql', '.md', '.markdown', '.adoc', '.rst', '.txt'
])

/** Text source files under `dir` (relative paths, index.html first), for the source view. */
function sourceFiles(dir: string, max = 15): string[] {
  const out: string[] = []
  const walk = (d: string, rel = ''): void => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (out.length >= max) return
      if (e.name.startsWith('.') || e.name === 'node_modules') continue
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) walk(path.join(d, e.name), r)
      else if (SRC_EXT.has(path.extname(e.name).toLowerCase())) {
        try {
          if (fs.statSync(path.join(d, e.name)).size <= 200_000) out.push(r)
        } catch {
          /* skip */
        }
      }
    }
  }
  walk(dir)
  return out.sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)))
}

/**
 * Assemble the whole collection into `repo` and (re)generate the portfolio.
 * Each fiddle is either **built** (has a build script; attempted when `doBuild`,
 * with a timeout — a decade-old install may hang), **copied static** (bare
 * index.html), or **skipped** (node/bash/C/… or a build that failed with no
 * index.html to fall back to). Resilient: one bad fiddle never aborts the run.
 * Shared by `publish` (→ a git repo) and `preview` (→ a scratch dir).
 */
async function assemblePortfolio(repo: string, screenshots: boolean, doBuild: boolean): Promise<AssembleResult> {
  const all = listCollection()
  if (!all.length) {
    console.log(c.dim('  (no fiddles yet — `fiddle create <framework> <name>` or `fiddle adopt`)\n'))
    return { count: 0, staticCount: 0, built: 0, srcOnly: 0, skipped: 0 }
  }
  fs.mkdirSync(repo, { recursive: true })
  const items: { framework: string; name: string; friendly: string; hasThumb: boolean; live: boolean; files: string[] }[] = []
  let staticCount = 0
  let built = 0
  let srcOnly = 0
  let skipped = 0

  // Many fiddles pull shared libs (jquery, three.min.js, html5shiv…) from trees ABOVE
  // their own dir: framework-level `../resources` (<home>/<fw>/resources) and site-level
  // `../../resources` (<home>/resources). github.io deploys the whole tree so these
  // resolve; a per-fiddle copy drops them → 404'd scripts + blank demos. Collect the
  // real source dirs (derived from each fiddle's path, home-agnostic) and copy once.
  const sharedFwRes = new Map<string, string>() // framework -> its resources/ source dir
  const sharedSiteRes = new Set<string>() // site-root resources/ source dir(s)

  for (const it of all) {
    let start: string
    try {
      start = readMeta(it.dir).start
    } catch {
      skipped++
      continue // not adopted / not a fiddle
    }
    const fwRoot = path.dirname(it.dir) // <home>/<fw>
    if (!sharedFwRes.has(it.framework)) {
      const r = path.join(fwRoot, 'resources')
      if (fs.existsSync(r)) sharedFwRes.set(it.framework, r)
    }
    const siteRes = path.join(path.dirname(fwRoot), 'resources') // <home>/resources
    if (fs.existsSync(siteRes)) sharedSiteRes.add(siteRes)
    const mode = renderMode(it.dir, start)
    const dest = path.join(repo, 'f', it.framework, it.name)
    let rendered = false
    let files: string[] = []

    let live = true

    if (mode === 'build') {
      // Prefer the committed build output (dist/ or build/) — a decade-old fiddle
      // rarely rebuilds on a modern toolchain, but what it shipped still renders.
      // Only rebuild when nothing is committed; never iframe raw build source.
      let out = builtDir(it.dir)
      if (!out && doBuild) {
        const installed =
          fs.existsSync(path.join(it.dir, 'node_modules')) || (await tryShell(NPM_INSTALL, it.dir, 120_000))
        if (installed) {
          await tryShell('npm run build -- --base=./', it.dir, 120_000)
          out = builtDir(it.dir)
        }
      }
      if (out) {
        fs.rmSync(dest, { recursive: true, force: true })
        fs.mkdirSync(dest, { recursive: true })
        fs.cpSync(out, dest, { recursive: true })
        rebaseBuiltDist(dest, it.framework, it.name) // fix absolute base baked to the old deploy path
        hideDeadRibbons(dest)
        rendered = true
        built++
      }
    } else if (mode === 'static' && staticAssetsOk(it.dir)) {
      // static & self-contained (its local scripts exist) — copy as-is
      fs.rmSync(dest, { recursive: true, force: true })
      fs.mkdirSync(dest, { recursive: true })
      copyFiddle(it.dir, dest) // excludes node_modules/dist/.git/screenshot.png
      files = sourceFiles(dest) // the copied source is browsable in the portfolio
      hideDeadRibbons(dest)
      rendered = true
      staticCount++
    }

    // Not a live demo (node/CLI fiddle, a build with no output, or a page whose
    // local assets are missing) → keep it as a source-only entry (browsable code,
    // no iframe) instead of dropping it. Skip only when there's no source to show.
    if (!rendered) {
      fs.rmSync(dest, { recursive: true, force: true })
      fs.mkdirSync(dest, { recursive: true })
      copyFiddle(it.dir, dest)
      files = sourceFiles(dest)
      if (!files.length) {
        skipped++
        continue
      }
      live = false
      srcOnly++
    }

    items.push({ framework: it.framework, name: it.name, friendly: friendly(it.dir), hasThumb: false, live, files })
  }

  // Shared resource trees (see above): place them where the relative refs resolve —
  // <repo>/f/resources (for ../../resources) and <repo>/f/<fw>/resources (for
  // ../resources). Must land BEFORE the screenshot pass so live demos can load them.
  const fRoot = path.join(repo, 'f')
  let sharedCopied = 0
  for (const src of sharedSiteRes) {
    fs.cpSync(src, path.join(fRoot, 'resources'), { recursive: true })
    sharedCopied++
  }
  for (const [fw, src] of sharedFwRes) {
    fs.cpSync(src, path.join(fRoot, fw, 'resources'), { recursive: true })
    sharedCopied++
  }
  if (sharedCopied) console.log(c.dim(`  📦 ${sharedCopied} shared resource tree(s) copied (jquery/three/html5shiv/…)`))

  // Thumbnails: screenshot the assembled, SERVED portfolio (correct for rebased
  // builds + static fiddles; one server for all — not a dev server per fiddle).
  // Only LIVE fiddles have a rendered page to shoot.
  if (screenshots) {
    const liveItems = items.filter((i) => i.live)
    console.log(c.dim(`  📸 thumbnailing ${liveItems.length} live fiddles…`))
    const shot = await captureServed(repo, liveItems, 4599, (d, t) => console.log(c.dim(`     ${d}/${t}`)))
    for (const i of items) if (shot.has(`${i.framework}/${i.name}`)) i.hasThumb = true
    console.log(c.dim(`  📸 ${shot.size} thumbnails captured`))
  }

  const manifest = buildManifest(items)
  fs.writeFileSync(path.join(repo, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  fs.writeFileSync(path.join(repo, 'index.html'), shellHtml(manifest))
  return { count: manifest.length, staticCount, built, srcOnly, skipped }
}

// ── preview ──────────────────────────────────────────────────────────────────────
program
  .command('preview')
  .description('build the portfolio into a scratch dir and serve it locally — no config, no push')
  .option('-p, --port <n>', 'port to serve on', '4321')
  .option('--no-screenshots', 'skip auto-thumbnails (faster)')
  .option('--no-build', 'copy static fiddles only — skip npm build (fast for a big archive)')
  .option('--no-open', "don't open the browser")
  .action(async (opts) => {
    const dir = path.join(os.tmpdir(), 'fiddle-preview') // scratch — never pollute the collection repo
    console.log(banner('preview'))
    const r = await assemblePortfolio(dir, opts.screenshots, opts.build)
    if (!r.count) return
    const port = parseInt(opts.port, 10) || 4321
    const server = await serveDir(dir, port)
    const url = `http://localhost:${port}`
    console.log(
      `\n  ▸ ${c.green(String(r.count))} fiddles ${c.dim(`(${r.staticCount} static · ${r.built} built · ${r.srcOnly} source · ${r.skipped} skipped)`)} at ${c.green(url)}`
    )
    console.log(c.dim('  local preview — run `fiddle publish` to ship it.  Ctrl-C to stop\n'))
    if (opts.open) openUrl(url)
    await new Promise<void>((resolve) => {
      process.on('SIGINT', () => {
        server.close()
        console.log(c.dim('\n  bye ʕ•ᴥ•ʔ\n'))
        resolve()
      })
    })
  })

// ── publish ────────────────────────────────────────────────────────────────────
program
  .command('publish')
  .description('build every fiddle, regenerate the portfolio shell, and push')
  .option('--no-screenshots', 'skip auto-thumbnails')
  .option('--no-build', 'copy static fiddles only — skip npm build')
  .option('--no-push', 'assemble but do not git commit/push')
  .action(async (opts) => {
    const repo = process.env.FIDDLE_PUBLISH_REPO || loadConfig().publishRepo
    if (!repo) throw new Error('no target — run `fiddle config set publishRepo <dir>` first (or `fiddle preview` to look first)')
    console.log(banner('publish'))
    const r = await assemblePortfolio(repo, opts.screenshots, opts.build)
    if (!r.count) return
    console.log(
      `\n  ✓ ${c.green(String(r.count))} fiddles ${c.dim(`(${r.staticCount} static · ${r.built} built · ${r.srcOnly} source · ${r.skipped} skipped)`)} → ${c.dim(repo)}`
    )

    if (opts.push && fs.existsSync(path.join(repo, '.git'))) {
      await runShell('git add index.html manifest.json f thumbs && git commit -m "fiddle publish" && git push', repo).catch(
        () => console.log(c.dim('  (git push skipped — commit/push manually)'))
      )
    } else if (opts.push) {
      console.log(c.dim('  (target is not a git repo — commit/push your portfolio yourself)'))
    }
    console.log('')
  })

// bare `fiddle` → banner + help
if (process.argv.slice(2).length === 0) {
  console.log(banner())
  program.outputHelp()
  process.exit(0)
}

program.parseAsync().catch((e: Error) => {
  console.error('\n' + nope(e.message) + '\n')
  process.exit(1)
})
