import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { REGISTRY, type TemplateEntry } from './registry.js'
import { resolveHome } from './config.js'
import { PLAYWRIGHT_CONFIG, SMOKE_SPEC, claudeMd } from './defaults.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const TEMPLATES_DIR = path.resolve(HERE, '../templates')

export interface FiddleMeta {
  framework: string
  name: string
  start: string
  createdAt: string
}

/** Run a shell command string in `cwd`, inheriting stdio. Rejects on non-zero exit. */
export function runShell(cmd: string, cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, { cwd, stdio: 'inherit', shell: true })
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`\`${cmd}\` exited with code ${code}`))
    )
  })
}

export function getEntry(framework: string): TemplateEntry {
  const entry = REGISTRY[framework]
  if (!entry) {
    throw new Error(`unknown framework "${framework}". Known: ${Object.keys(REGISTRY).join(', ')}.`)
  }
  return entry
}

/** `<home>/<framework>/`, created if missing. */
export function frameworkDir(framework: string): string {
  const dir = path.join(resolveHome(), framework)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** Next `fiddle-NNNN-` number in a framework dir (legacy auto-numbering). */
export function nextNumber(fwDir: string): string {
  let max = 0
  try {
    for (const d of fs.readdirSync(fwDir)) {
      const m = d.match(/^fiddle-(\d+)-/)
      if (m) max = Math.max(max, parseInt(m[1], 10))
    }
  } catch {
    /* dir may be empty */
  }
  return String(max + 1).padStart(4, '0')
}

/** Resolve a fiddle dir by exact name or by the friendly suffix (`Foo` → `fiddle-0003-Foo`). */
export function resolveFiddle(framework: string, name: string): string {
  const fwDir = frameworkDir(framework)
  const exact = path.join(fwDir, name)
  if (fs.existsSync(exact)) return exact
  const match = fs
    .readdirSync(fwDir)
    .find((d) => d === name || d.endsWith(`-${name}`) || d.replace(/^fiddle-\d+-/, '') === name)
  if (!match) throw new Error(`no fiddle "${name}" under ${framework}. Try \`fiddle list ${framework}\`.`)
  return path.join(fwDir, match)
}

export function copyTemplate(dir: string, target: string): void {
  fs.cpSync(path.join(TEMPLATES_DIR, dir), target, { recursive: true })
}

/** Copy a fiddle dir, skipping installs/build/vcs (used by fork/refactor). */
export function copyFiddle(src: string, dest: string): void {
  fs.cpSync(src, dest, {
    recursive: true,
    filter: (s) => !/(^|\/)(node_modules|dist|\.git|screenshot\.png)(\/|$)/.test(s)
  })
}

/** Inject the per-fiddle defaults: Playwright (browser fiddles only) + CLAUDE.md (all). */
export function injectDefaults(dir: string, framework: string, name: string, browser: boolean): void {
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), claudeMd(framework, name))
  if (!browser) return
  fs.writeFileSync(path.join(dir, 'playwright.config.ts'), PLAYWRIGHT_CONFIG)
  fs.mkdirSync(path.join(dir, 'tests'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'tests', 'smoke.spec.ts'), SMOKE_SPEC)
  // wire @playwright/test + a `test` script into the fiddle's package.json
  const pkgPath = path.join(dir, 'package.json')
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    pkg.devDependencies = { '@playwright/test': '^1.45.0', ...(pkg.devDependencies || {}) }
    pkg.scripts = { ...(pkg.scripts || {}), test: 'playwright test' }
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  } catch {
    /* delegate scaffolds always have a package.json; ignore if not */
  }
}

export function writeMeta(dir: string, meta: FiddleMeta): void {
  fs.writeFileSync(path.join(dir, '.fiddle.json'), JSON.stringify(meta, null, 2) + '\n')
}

export function readMeta(dir: string): FiddleMeta {
  const p = path.join(dir, '.fiddle.json')
  if (!fs.existsSync(p)) throw new Error(`${path.basename(dir)} is not a fiddle (no .fiddle.json)`)
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

export interface CollectionEntry {
  framework: string
  dir: string
  name: string
}

/** Walk the home for all fiddles (optionally one framework). */
export function listCollection(framework?: string): CollectionEntry[] {
  const home = resolveHome()
  const out: CollectionEntry[] = []
  const frameworks = framework ? [framework] : safeReaddir(home)
  for (const fw of frameworks) {
    const fwDir = path.join(home, fw)
    if (!fs.statSync(fwDir, { throwIfNoEntry: false })?.isDirectory()) continue
    for (const d of safeReaddir(fwDir)) {
      if (fs.existsSync(path.join(fwDir, d, '.fiddle.json')) || /^fiddle-\d+-/.test(d)) {
        out.push({ framework: fw, dir: path.join(fwDir, d), name: d })
      }
    }
  }
  return out
}

function safeReaddir(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter((d) => !d.startsWith('.'))
  } catch {
    return []
  }
}
