import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { REGISTRY, type TemplateEntry } from './registry.js'
import { loadConfig, resolveHome } from './config.js'
import { PLAYWRIGHT_CONFIG, SMOKE_SPEC, claudeMd, readmeMd } from './defaults.js'

/** fiddle-0011-PlanetTween → "Planet Tween" — display title for a fresh README. */
export function humanizeName(dirName: string): string {
  return dirName
    .replace(/^fiddle-\d+-/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

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

/**
 * Best-effort shell: resolves true on a clean exit, false on error / non-zero /
 * timeout. Never throws, never inherits stdio. For publishing an archive where
 * a decade-old `npm install` may fail or hang — we skip it and move on.
 */
export function tryShell(cmd: string, cwd: string, timeoutMs = 120_000): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(cmd, { cwd, stdio: 'ignore', shell: true, detached: true })
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid!, 'SIGKILL') // kill the whole process group (npm children)
      } catch {
        child.kill('SIGKILL')
      }
      resolve(false)
    }, timeoutMs)
    child.on('error', () => {
      clearTimeout(timer)
      resolve(false)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve(code === 0)
    })
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

/**
 * Resolve a fiddle dir by NUMBER (`1` / `01` / `0001` → `fiddle-0001-*`), exact dir name,
 * or friendly name (`Foo` → `fiddle-0003-Foo`). Number is the easy path — that's why they're numbered.
 */
export function resolveFiddle(framework: string, name: string): string {
  const fwDir = frameworkDir(framework)
  const dirs = fs.existsSync(fwDir) ? fs.readdirSync(fwDir) : []
  if (/^\d+$/.test(name)) {
    const n = parseInt(name, 10)
    const byNum = dirs.find((d) => {
      const m = d.match(/^fiddle-(\d+)-/)
      return m ? parseInt(m[1], 10) === n : false
    })
    if (byNum) return path.join(fwDir, byNum)
  }
  const match = dirs.find(
    (d) => d === name || d.endsWith(`-${name}`) || d.replace(/^fiddle-\d+-/, '') === name
  )
  if (!match) throw new Error(`no fiddle "${name}" under ${framework}. Try \`fiddle list ${framework}\`.`)
  return path.join(fwDir, match)
}

/** If the cwd is inside a fiddle (walking up to find a `.fiddle.json`), return its dir. */
export function cwdFiddle(): string | null {
  let dir = process.cwd()
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, '.fiddle.json'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
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
export function injectDefaults(dir: string, framework: string, name: string, browser: boolean, forkedFrom = ''): void {
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), claudeMd(framework, name))
  // The classic structured README (### Title/Description/Tags/…) — the portfolio
  // parses it for the gallery's info card. Replaces delegate-scaffolder boilerplate.
  fs.writeFileSync(path.join(dir, 'README.md'), readmeMd(name, humanizeName(name), forkedFrom))
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

/**
 * Infer how to run an existing (un-adopted) fiddle from its files, so `adopt`
 * can record a start command for a collection fiddle didn't scaffold. Empty
 * string = nothing runnable found (e.g. a bash/C/python fiddle) — still adopted
 * for listing, just not startable.
 */
export function inferStart(dir: string): string {
  const pkgPath = path.join(dir, 'package.json')
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
      if (pkg.scripts?.dev) return 'npm run dev'
      if (pkg.scripts?.start) return 'npm start'
      if (pkg.main) return `node ${pkg.main}`
    } catch {
      /* malformed package.json — fall through to a best guess */
    }
    return 'npm start'
  }
  if (fs.existsSync(path.join(dir, 'index.html'))) return 'npx --yes serve -l 5173' // static
  for (const f of ['index.mjs', 'index.js', 'main.js', 'server.js']) {
    if (fs.existsSync(path.join(dir, f))) return `node ${f}`
  }
  return '' // no runnable entry
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

/** Fire-and-forget a detached GUI/terminal launch; never blocks or throws. */
function spawnDetached(cmd: string, args: string[]): void {
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true })
    child.on('error', () => {})
    child.unref()
  } catch {
    /* ignore */
  }
}

/** Open a URL in the default browser (best-effort, detached). */
export function openUrl(url: string): void {
  if (process.platform === 'darwin') spawnDetached('open', [url])
  else if (process.platform === 'win32') spawnDetached('cmd', ['/c', 'start', '', url])
  else spawnDetached('xdg-open', [url])
}

/** Open a fiddle in the configured editor (default: VS Code `code`). */
export function openInEditor(dir: string): void {
  spawnDetached(loadConfig().editor || 'code', [dir])
}

/** Open a terminal at the fiddle dir for interacting with it. */
export function openTerminal(dir: string): void {
  if (process.platform === 'darwin') {
    spawnDetached('open', ['-a', loadConfig().terminal || 'Terminal', dir])
  } else if (process.platform === 'win32') {
    spawnDetached('cmd', ['/c', 'start', 'cmd', '/K', `cd /d "${dir}"`])
  } else {
    spawnDetached('x-terminal-emulator', ['--working-directory', dir])
  }
}

/** Normalize a gallery mount path: '', '/', undefined → '/'; 'fiddles' → '/fiddles/'. */
export function normalizeBase(base?: string): string {
  const b = (base || '').trim().replace(/^\/+|\/+$/g, '')
  return b ? `/${b}/` : '/'
}

export function rebaseBuiltDist(dest: string, framework: string, name: string, base = '/'): void {
  const baked = `/${framework}/${name}/`
  // The FULL public path of this fiddle — including the gallery's mount path
  // (`publishBase`, e.g. `/fiddles/` on a nested GitHub Pages site). Root-relative
  // rewrites that ignore the mount 404 everywhere except a root-served preview.
  const served = `${base}f/${framework}/${name}/`
  const idxPath = path.join(dest, 'index.html')
  if (!fs.existsSync(idxPath)) return
  // Rewrite two baked-in path forms across all text assets:
  //  1. Absolute-base builds (e.g. vite `base: '/vue/<name>/'`): the deploy path is baked into
  //     asset URLs AND the SPA router base → rewrite `/<fw>/<name>/` to the `/f/` served path.
  //  2. Relative-base SPA builds (vite `base: './'`): assets resolve fine via `./`, but the router
  //     base is baked as `createWebHistory("./")` which vue-router normalizes to "/." and never
  //     matches the /f/<fw>/<name>/ serve path → the app renders its 404 route. Repoint that base.
  // (Both are no-ops when absent, so this is safe to run on every built fiddle.)
  const rewriteHistory = /history:\w+\("\.\/"\)/
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(html?|c?js|mjs|css|json|map|svg|txt|webmanifest)$/i.test(e.name)) {
        try {
          const b = fs.readFileSync(p, 'utf8')
          let out = b
          if (out.includes(baked)) out = out.split(baked).join(served)
          if (rewriteHistory.test(out)) out = out.replace(/(history:\w+\(")\.\/("\))/g, `$1${served}$2`)
          if (out !== b) fs.writeFileSync(p, out)
        } catch {
          /* skip unreadable/binary */
        }
      }
    }
  }
  walk(dest)
  // AFTER the walk (so `served` isn't re-prefixed — `baked` is a substring of `served`):
  // Angular-CLI builds ship `<base href="/">` with RELATIVE asset refs, so main-*.js/
  // styles-*.css resolve against the site root and 404 under /f/<fw>/<name>/. Repoint
  // the base at the served dir so they resolve.
  try {
    const idx = fs.readFileSync(idxPath, 'utf8')
    if (/<base\s+href="\/"\s*\/?>/i.test(idx)) {
      fs.writeFileSync(idxPath, idx.replace(/(<base\s+href=")\/("\s*\/?>)/i, `$1${served}$2`))
    }
  } catch {
    /* no index / unreadable */
  }
}
