<p align="center">
  <img src="https://img.shields.io/npm/v/@bradyhouse/fiddle.svg" alt="npm">
  <img src="https://img.shields.io/badge/license-MIT-brightgreen.svg" alt="MIT license">
  <img src="https://img.shields.io/badge/node-%3E%3D18-blue" alt="node >=18">
</p>

# fiddle

> A home for your framework experiments. Scaffold a sandbox, iterate, and it auto-appears in a unified portfolio — no plumbing.

```bash
npm i -g @bradyhouse/fiddle
fiddle setup                    # one-time: config + prerequisites

fiddle create three spinner     # scaffold a three.js sandbox
fiddle start three spinner      # run it (or: fiddle start three 1)
fiddle publish                  # build every fiddle → one portfolio site
```

A TypeScript reimagining of my decade-old [`fiddle.sh`](https://github.com/bradyhouse/house)
CLI. The idea is the same — *build something to learn it* — but the friction is gone: every
fiddle lands in **one configured home**, organized by framework, and `publish` turns the whole
collection into a browsable, Storybook-style portfolio you can deploy anywhere.

## The collection model

fiddle isn't a one-off scaffolder — it's a **library manager for your experiments**. You set a
home once; every fiddle lives at `<home>/<framework>/fiddle-NNNN-<name>` (the auto-numbering is
inherited from the original). Because everything is in one place, you get list/fork/delete and a
generated portfolio for free.

```
~/fiddles/
├── three/
│   ├── fiddle-0001-spinner/
│   └── fiddle-0002-orbit/
└── vue/
    └── fiddle-0001-todo/
```

Number-based resolution means you never type the full name: `fiddle start three 1`, `fiddle edit three 0002`.

## The portfolio (the point)

The hardest part of the old workflow was showcasing: you'd spend hours on a fiddle, then have to
hand-wire it into a portfolio page. Now:

```bash
fiddle preview                  # build the collection + serve it locally
fiddle publish                  # + push it to your configured repo
```

`publish` builds every browser fiddle, captures a thumbnail, and generates a **self-contained
portfolio shell** — phosphor/CRT aesthetic, sidebar grouped by framework, each fiddle live in an
iframe, deep-linkable. Add a fiddle, `publish`, and it's *in the portfolio*. Zero manual plumbing.

## The "both" provider model

fiddle scaffolds from **two kinds of provider**, resolved by a single registry:

- **`delegate`** — for frameworks with a canonical scaffolder (React, Vue, Svelte, Solid…), fiddle
  hands off to the official tool (`npm create vite@latest`, …). Always current, zero template maintenance.
- **`builtin`** — for the ecosystems with _no_ `create-X` (three.js, D3, RxJS, SVG…), fiddle ships a
  curated starter. That's exactly where a template earns its keep.

Either way, fiddle records a small `.fiddle.json` so `start`/`build` run the right command uniformly,
and injects a **Playwright smoke test + `CLAUDE.md`** into every new fiddle by default.

## Commands

| command | what it does |
|---|---|
| `fiddle setup` | one-time: prerequisites + config + screenshot browser |
| `fiddle config list` / `set <k> <v>` | view / change settings (home, publishRepo, editor, terminal) |
| `fiddle create <framework> [name]` | scaffold a new fiddle into your collection |
| `fiddle fork <framework> <src> [name]` | copy an existing fiddle to iterate from it |
| `fiddle refactor <framework> <old> <new>` | rename a fiddle (keeps its number) — alias `rename` |
| `fiddle delete <framework> <name>` | delete a fiddle — alias `rm` (ideas are junk sometimes) |
| `fiddle list [framework]` | list the collection, grouped by framework — alias `ls` |
| `fiddle start <framework> <name>` | run a fiddle's dev command (name or number) |
| `fiddle edit <framework> <name>` | open it in your editor + spawn a terminal |
| `fiddle build [framework] [name]` | build a fiddle (the one you're in, one by name, or all) |
| `fiddle preview [name]` | build the collection + serve the portfolio locally (a `name` updates just that fiddle — seconds, not minutes) |
| `fiddle publish [name]` | build all + regenerate the portfolio + push (a `name` publishes just that one incrementally) |

## Frameworks

`fiddle list` shows what's available. Currently **8 delegate** (React, Vue, Svelte, Solid, Preact,
Lit, Qwik, Vanilla — all via Vite) and **6 builtin** (three, d3, rxjs, svg, tween, node). Adding one
is a single registry row.

## Configuration

Settings live in `~/.fiddle/config.json` (env overrides: `FIDDLE_HOME`, `FIDDLE_PUBLISH_REPO`):

| key | default | purpose |
|---|---|---|
| `home` | `~/fiddles` | where the collection lives |
| `publishRepo` | _unset_ | portfolio publish target (a git working dir — use a subdir) |
| `favorite` | _unset_ | the fiddle the portfolio landing opens on, as `<framework>/<name>` |
| `homeUrl` | _unset_ | a "← home" link in the gallery header (e.g. `../` when nested under a site) |
| `editor` | `code` | opened by `fiddle edit` |
| `terminal` | `Terminal` | spawned by `fiddle edit` (macOS) |

## License

[MIT](LICENSE) © Brady House
