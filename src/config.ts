import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CONFIG_DIR = path.join(os.homedir(), '.fiddle')
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

export interface FiddleConfig {
  /** where all fiddles collect, organized by framework */
  home: string
  /** the portfolio publish target (a git / gh-pages working dir) */
  publishRepo?: string
  /** the fiddle shown on the portfolio landing page, as `<framework>/<name>` */
  favorite?: string
  /** URL for a "← home" link in the gallery header (e.g. `../` when nested under a parent site); unset = no link */
  homeUrl?: string
  /** URL path where the published gallery is MOUNTED (e.g. `/fiddles/` when nested under a site) — baked into rebased built fiddles' absolute paths; default `/` */
  publishBase?: string
  [key: string]: string | undefined
}

const DEFAULTS: FiddleConfig = {
  home: path.join(os.homedir(), 'fiddles')
}

/** Every setting the CLI reads — so `config list` can show unset ones too. */
export interface ConfigKeyInfo {
  key: string
  desc: string
  default?: string
}
export const CONFIG_KEYS: ConfigKeyInfo[] = [
  { key: 'home', desc: 'where all fiddles collect, organized by framework', default: DEFAULTS.home },
  { key: 'publishRepo', desc: 'portfolio publish target — a git working dir' },
  { key: 'favorite', desc: 'fiddle featured on the portfolio landing page, as <framework>/<name>' },
  { key: 'homeUrl', desc: 'URL for a "← home" link in the gallery header (e.g. ../ when nested under a site)' },
  { key: 'publishBase', desc: 'URL path the published gallery is mounted at (e.g. /fiddles/ when nested under a site)', default: '/' },
  { key: 'editor', desc: 'editor command opened by `fiddle edit`', default: 'code' },
  { key: 'terminal', desc: 'terminal app spawned by `fiddle edit` (macOS)', default: 'Terminal' }
]

/** The persisted config (file + defaults). */
export function loadConfig(): FiddleConfig {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveConfig(cfg: FiddleConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + '\n')
}

export function setConfigKey(key: string, value: string): FiddleConfig {
  const cfg = loadConfig()
  cfg[key] = value
  saveConfig(cfg)
  return cfg
}

/** The fiddle home (env override wins), created if missing. */
export function resolveHome(): string {
  const home = process.env.FIDDLE_HOME || loadConfig().home
  fs.mkdirSync(home, { recursive: true })
  return home
}
