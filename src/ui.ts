// Terminal "pop" — banner + colors, in the spirit of the legacy fiddle.sh.

const TTY = process.stdout.isTTY && !process.env.NO_COLOR
const wrap = (code: string) => (s: string) => (TTY ? `\x1b[${code}m${s}\x1b[0m` : s)

export const c = {
  green: wrap('92'),
  dim: wrap('2'),
  bold: wrap('1'),
  red: wrap('31'),
  amber: wrap('93')
}

// "fiddle" (Standard figlet). Single-quoted lines so backticks/backslashes stay literal.
const ART = [
  '   __ _     _     _ _',
  '  / _(_) __| | __| | | ___',
  ' | |_| |/ _` |/ _` | |/ _ \\',
  ' |  _| | (_| | (_| | |  __/',
  ' |_| |_|\\__,_|\\__,_|_|\\___|'
]

/** The banner: phosphor-green wordmark + a kaomoji + tagline. `sub` optional (e.g. a command name). */
export function banner(sub = ''): string {
  const art = ART.map((l) => c.green(l)).join('\n')
  const tag = c.dim('  scaffold') + ' · ' + c.dim('fork') + ' · ' + c.dim('iterate') + ' · ' + c.dim('publish') + '   ' + c.green('ʕ•ᴥ•ʔ')
  const subLine = sub ? '\n  ' + c.amber(sub) : ''
  return `\n${art}\n${tag}${subLine}\n`
}

/** A friendly one-liner in the legacy voice. */
export const nope = (msg: string) => c.amber('  Nope ~ ') + msg
