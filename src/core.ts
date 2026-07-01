import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { REGISTRY, type TemplateEntry } from './registry.js'

/** dist/ at runtime → templates/ is its sibling under the package root. */
const HERE = path.dirname(fileURLToPath(import.meta.url))
export const TEMPLATES_DIR = path.resolve(HERE, '../templates')

export interface FiddleMeta {
  framework: string
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

/** Look up a framework in the registry, or throw a helpful error. */
export function getEntry(framework: string): TemplateEntry {
  const entry = REGISTRY[framework]
  if (!entry) {
    throw new Error(
      `unknown framework "${framework}". Known: ${Object.keys(REGISTRY).join(', ')}. Run \`fiddle list\`.`
    )
  }
  return entry
}

/** Copy a builtin template directory into `target`. */
export function copyTemplate(dir: string, target: string): void {
  fs.cpSync(path.join(TEMPLATES_DIR, dir), target, { recursive: true })
}

export function writeMeta(dir: string, meta: FiddleMeta): void {
  fs.writeFileSync(path.join(dir, '.fiddle.json'), JSON.stringify(meta, null, 2) + '\n')
}

export function readMeta(dir: string): FiddleMeta {
  const p = path.join(dir, '.fiddle.json')
  if (!fs.existsSync(p)) {
    throw new Error(`no .fiddle.json in ${dir} — not a fiddle. (create one with \`fiddle create\`)`)
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}
