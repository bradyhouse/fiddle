#!/usr/bin/env node
import { Command } from 'commander'
import { createInterface } from 'node:readline/promises'
import fs from 'node:fs'
import path from 'node:path'
import { REGISTRY } from './registry.js'
import { CONFIG_FILE, loadConfig, setConfigKey } from './config.js'
import {
  copyFiddle,
  copyTemplate,
  frameworkDir,
  getEntry,
  injectDefaults,
  listCollection,
  nextNumber,
  openInEditor,
  openTerminal,
  readMeta,
  resolveFiddle,
  runShell,
  writeMeta
} from './core.js'
import { claudeMd } from './defaults.js'
import { buildManifest, shellHtml } from './portfolio.js'
import { captureFiddle } from './screenshot.js'
import { banner, c, nope } from './ui.js'

const isBrowser = (start: string) => !start.startsWith('node')
const friendly = (dir: string) => path.basename(dir).replace(/^fiddle-\d+-/, '')

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
  .description('show all config values')
  .action(() => {
    const cfg = loadConfig()
    console.log(banner('config'))
    console.log('  file: ' + c.dim(CONFIG_FILE) + '\n')
    for (const [k, v] of Object.entries(cfg)) console.log('  ' + c.green(k.padEnd(14)) + (v ?? c.dim('(unset)')))
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
  .description('build a fiddle for showcase (npm run build)')
  .argument('[framework]')
  .argument('[name]')
  .action(async (framework, name, opts, cmd) => {
    if (!framework || !name) return void (console.log(banner('build')), cmd.outputHelp())
    const dir = resolveFiddle(framework, name)
    if (!isBrowser(readMeta(dir).start)) throw new Error(`${friendly(dir)} is a node fiddle — nothing to showcase`)
    console.log(banner(`build · ${friendly(dir)}`))
    if (!fs.existsSync(path.join(dir, 'node_modules'))) await runShell('npm install', dir)
    await runShell('npm run build -- --base=./', dir) // relative base → works under /f/<fw>/<name>/
    console.log(`\n  ✓ built → ${c.green('dist/')}\n`)
  })

// ── publish ────────────────────────────────────────────────────────────────────
program
  .command('publish')
  .description('build every fiddle, regenerate the portfolio shell, and push')
  .option('--no-screenshots', 'skip auto-thumbnails')
  .option('--no-push', 'assemble but do not git commit/push')
  .action(async (opts) => {
    const repo = process.env.FIDDLE_PUBLISH_REPO || loadConfig().publishRepo
    if (!repo) throw new Error('no target — run `fiddle config set publishRepo <dir>` first')
    console.log(banner('publish'))
    const showcase = listCollection().filter((it) => {
      try {
        return isBrowser(readMeta(it.dir).start)
      } catch {
        return false
      }
    })
    if (!showcase.length) return void console.log(c.dim('  (no showcase-able fiddles yet)\n'))

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
      if (opts.screenshots) {
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
    console.log(`\n  ✓ ${c.green(String(manifest.length))} fiddles → ${c.dim(repo)}`)

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
