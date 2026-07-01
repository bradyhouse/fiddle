#!/usr/bin/env node
import { Command } from 'commander'
import fs from 'node:fs'
import path from 'node:path'
import { REGISTRY } from './registry.js'
import { copyTemplate, getEntry, readMeta, runShell, writeMeta } from './core.js'

const program = new Command()

program
  .name('fiddle')
  .description('Scaffold and run throwaway framework sandboxes ("fiddles").')
  .version('0.1.0')

program
  .command('create')
  .description('scaffold a new fiddle')
  .argument('<framework>', 'framework to scaffold (see `fiddle list`)')
  .argument('[name]', 'directory name for the new fiddle')
  .action(async (framework: string, nameArg?: string) => {
    const entry = getEntry(framework)
    const name = nameArg || `${framework}-fiddle`
    const target = path.resolve(process.cwd(), name)
    if (fs.existsSync(target)) {
      console.error(`✗ "${name}" already exists here.`)
      process.exit(1)
    }

    console.log(`\n⌁ creating ${name}  —  ${entry.label}  (${entry.provider})\n`)
    if (entry.provider === 'delegate') {
      // hand off to the official scaffolder; it creates the `name` dir in the CWD
      await runShell(entry.run!.replace(/{name}/g, name), process.cwd())
    } else {
      copyTemplate(entry.dir!, target)
    }

    // both providers: install so the fiddle is ready to `start`
    console.log('\n  installing dependencies…\n')
    await runShell('npm install', target)

    writeMeta(target, { framework, start: entry.start, createdAt: new Date().toISOString() })
    console.log(`\n✓ ${name} ready.\n    cd ${name} && fiddle start\n`)
  })

program
  .command('start')
  .description("run a fiddle's recorded dev command")
  .argument('[dir]', 'fiddle directory', '.')
  .action(async (dir: string) => {
    const d = path.resolve(process.cwd(), dir)
    const meta = readMeta(d)
    console.log(`\n▶ ${path.basename(d)} — ${meta.start}   (Ctrl+C to stop)\n`)
    await runShell(meta.start, d)
  })

program
  .command('list')
  .description('list available frameworks')
  .action(() => {
    console.log('\n  framework    provider    template')
    console.log('  ─────────    ────────    ────────')
    for (const [name, entry] of Object.entries(REGISTRY)) {
      console.log(`  ${name.padEnd(12)} ${entry.provider.padEnd(11)} ${entry.label}`)
    }
    console.log('')
  })

program.parseAsync().catch((err: Error) => {
  console.error(`✗ ${err.message}`)
  process.exit(1)
})
