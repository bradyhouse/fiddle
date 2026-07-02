#!/usr/bin/env node
import { Command } from 'commander'
import { createInterface } from 'node:readline/promises'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
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
  writeMeta
} from './core.js'
import { claudeMd } from './defaults.js'
import { buildManifest, shellHtml } from './portfolio.js'
import { captureFiddle } from './screenshot.js'
import { serveDir } from './serve.js'
import { banner, c, nope } from './ui.js'

const isBrowser = (start: string) => !start.startsWith('node')
const friendly = (dir: string) => path.basename(dir).replace(/^fiddle-\d+-/, '')

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
        const looksLikeFiddle =
          /^fiddle-\d+-/.test(name) ||
          fs.existsSync(path.join(dir, 'package.json')) ||
          fs.existsSync(path.join(dir, 'index.html'))
        if (!looksLikeFiddle) continue
        if (fs.existsSync(path.join(dir, '.fiddle.json')) && !opts.force) {
          skipped++
          continue
        }
        const start = inferStart(dir)
        if (!opts.dryRun) {
          let createdAt: string
          try {
            createdAt = fs.statSync(dir).mtime.toISOString() // real age, not "now"
          } catch {
            createdAt = new Date().toISOString()
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
      if (!fs.existsSync(path.join(dir, 'node_modules'))) await runShell('npm install', dir)
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

/**
 * Build every showcase (browser) fiddle into `repo`, copy each dist into
 * `repo/f/<fw>/<name>/`, capture thumbnails, and (re)generate index.html +
 * manifest.json. Returns the number of fiddles assembled (0 if none).
 * Shared by `publish` (→ a git repo) and `preview` (→ a scratch dir).
 */
async function assemblePortfolio(repo: string, screenshots: boolean): Promise<number> {
  const showcase = listCollection().filter((it) => {
    try {
      return isBrowser(readMeta(it.dir).start)
    } catch {
      return false
    }
  })
  if (!showcase.length) {
    console.log(c.dim('  (no showcase-able fiddles yet — `fiddle create <framework> <name>`)\n'))
    return 0
  }
  fs.mkdirSync(repo, { recursive: true })
  const items: { framework: string; name: string; friendly: string; hasThumb: boolean }[] = []
  for (const it of showcase) {
    process.stdout.write(c.dim(`  ${it.framework}/${it.name}  build`))
    if (!fs.existsSync(path.join(it.dir, 'node_modules'))) await runShell('npm install', it.dir)
    await runShell('npm run build -- --base=./', it.dir)
    const dest = path.join(repo, 'f', it.framework, it.name)
    fs.rmSync(dest, { recursive: true, force: true })
    fs.mkdirSync(dest, { recursive: true })
    fs.cpSync(path.join(it.dir, 'dist'), dest, { recursive: true })
    let hasThumb = false
    if (screenshots) {
      process.stdout.write(c.dim(' · shot'))
      fs.mkdirSync(path.join(repo, 'thumbs'), { recursive: true })
      hasThumb = await captureFiddle(it.dir, path.join(repo, 'thumbs', `${it.framework}__${it.name}.png`))
    }
    console.log(c.dim(hasThumb ? ' ✓' : ' ✓ (no shot)'))
    items.push({ framework: it.framework, name: it.name, friendly: friendly(it.dir), hasThumb })
  }
  const manifest = buildManifest(items)
  fs.writeFileSync(path.join(repo, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  fs.writeFileSync(path.join(repo, 'index.html'), shellHtml(manifest))
  return manifest.length
}

// ── preview ──────────────────────────────────────────────────────────────────────
program
  .command('preview')
  .description('build the portfolio into a scratch dir and serve it locally — no config, no push')
  .option('-p, --port <n>', 'port to serve on', '4321')
  .option('--no-screenshots', 'skip auto-thumbnails (faster)')
  .option('--no-open', "don't open the browser")
  .action(async (opts) => {
    const dir = path.join(resolveHome(), '.preview')
    console.log(banner('preview'))
    const n = await assemblePortfolio(dir, opts.screenshots)
    if (!n) return
    const port = parseInt(opts.port, 10) || 4321
    const server = await serveDir(dir, port)
    const url = `http://localhost:${port}`
    console.log(`\n  ▸ ${c.green(String(n))} fiddles live at ${c.green(url)}`)
    console.log(c.dim('  this is a local preview — run `fiddle publish` to ship it.  Ctrl-C to stop\n'))
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
  .option('--no-push', 'assemble but do not git commit/push')
  .action(async (opts) => {
    const repo = process.env.FIDDLE_PUBLISH_REPO || loadConfig().publishRepo
    if (!repo) throw new Error('no target — run `fiddle config set publishRepo <dir>` first (or `fiddle preview` to look first)')
    console.log(banner('publish'))
    const n = await assemblePortfolio(repo, opts.screenshots)
    if (!n) return
    console.log(`\n  ✓ ${c.green(String(n))} fiddles → ${c.dim(repo)}`)

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
