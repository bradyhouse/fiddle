export type Provider = 'delegate' | 'builtin'

export interface TemplateEntry {
  provider: Provider
  /** delegate: a shell command run in the CWD; `{name}` is substituted with the fiddle name. */
  run?: string
  /** builtin: template directory name under `templates/`. */
  dir?: string
  /** the dev/run command recorded into `.fiddle.json` for `fiddle start`. */
  start: string
  label: string
}

/**
 * The provider registry — the heart of fiddle's "both" model.
 *
 * Frameworks with a canonical scaffolder DELEGATE to it (always current, zero
 * template maintenance); the rest ship a curated BUILTIN template — which is
 * exactly where the ecosystem has no `create-X` and a good starter has value.
 *
 * Adding a framework is one row: a `run` command (delegate) or a `dir` under
 * `templates/` (builtin).
 */
export const REGISTRY: Record<string, TemplateEntry> = {
  react: {
    provider: 'delegate',
    run: 'npm create vite@latest {name} -- --template react-ts',
    start: 'npm run dev',
    label: 'React + Vite (TS)'
  },
  vue: {
    provider: 'delegate',
    run: 'npm create vite@latest {name} -- --template vue-ts',
    start: 'npm run dev',
    label: 'Vue 3 + Vite (TS)'
  },
  svelte: {
    provider: 'delegate',
    run: 'npm create vite@latest {name} -- --template svelte-ts',
    start: 'npm run dev',
    label: 'Svelte + Vite (TS)'
  },
  three: {
    provider: 'builtin',
    dir: 'three',
    start: 'npm run dev',
    label: 'three.js + Vite'
  }
}
