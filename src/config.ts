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
  [key: string]: string | undefined
}

const DEFAULTS: FiddleConfig = {
  home: path.join(os.homedir(), 'fiddles')
}

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
