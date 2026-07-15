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

/** Shorthand for a Vite-scaffolded framework (delegate → the official create-vite template). */
const vite = (template: string, label: string): TemplateEntry => ({
  provider: 'delegate',
  run: `npm create vite@latest {name} -- --template ${template}`,
  start: 'npm run dev',
  label
})

/** Shorthand for a fiddle-shipped (builtin) template. */
const builtin = (dir: string, label: string, start = 'npm run dev'): TemplateEntry => ({
  provider: 'builtin',
  dir,
  start,
  label
})

/**
 * The provider registry — the heart of fiddle's "both" model.
 *
 * Frameworks with a canonical scaffolder DELEGATE to it (always current, zero
 * template maintenance); the rest ship a curated BUILTIN template — exactly
 * where the ecosystem has no `create-X` and a good starter has value.
 *
 * Adding a framework is one row.
 */
export const REGISTRY: Record<string, TemplateEntry> = {
  // ── delegate → official Vite templates (always current) ──
  react: vite('react-ts', 'React + Vite (TS)'),
  // Angular's canonical scaffolder is the Angular CLI (not create-vite).
  // Pinned @19: Angular 20+ requires Node 22, ahead of this box's runtime.
  angular: {
    provider: 'delegate',
    run: 'npm create @angular@19 {name} -- --defaults --skip-git --skip-install --style=css --ssr=false',
    start: 'npm start',
    label: 'Angular 19 (CLI, standalone)'
  },
  vue: vite('vue-ts', 'Vue 3 + Vite (TS)'),
  svelte: vite('svelte-ts', 'Svelte + Vite (TS)'),
  solid: vite('solid-ts', 'Solid + Vite (TS)'),
  preact: vite('preact-ts', 'Preact + Vite (TS)'),
  lit: vite('lit-ts', 'Lit + Vite (TS)'),
  qwik: vite('qwik-ts', 'Qwik + Vite (TS)'),
  vanilla: vite('vanilla-ts', 'Vanilla + Vite (TS)'),

  // ── builtin → fiddle's own curated templates (no canonical create-X) ──
  three: builtin('three', 'three.js + Vite'),
  d3: builtin('d3', 'D3 + Vite'),
  rxjs: builtin('rxjs', 'RxJS + Vite'),
  svg: builtin('svg', 'SVG animation + Vite'),
  tween: builtin('tween', 'tween.js + Vite'),
  node: builtin('node', 'Node script', 'node index.mjs')
}
