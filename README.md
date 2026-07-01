<p align="center">
  <img src="https://img.shields.io/npm/v/@bradyhouse/fiddle.svg" alt="npm">
  <img src="https://img.shields.io/badge/license-MIT-brightgreen.svg" alt="MIT license">
  <img src="https://img.shields.io/badge/node-%3E%3D18-blue" alt="node >=18">
</p>

# fiddle

> Scaffold and run throwaway framework sandboxes — a _"fiddle"_ — in one command.

```bash
npm i -g @bradyhouse/fiddle

fiddle create react my-app     # scaffold a React sandbox
fiddle start my-app            # run it
```

A TypeScript reimagining of my decade-old [`fiddle.sh`](https://github.com/bradyhouse/house)
CLI: the same "build something to learn it" idea, now a standalone, cross-platform npm tool.

## The "both" model

fiddle scaffolds from **two kinds of provider**, resolved by a single registry:

- **`delegate`** — for frameworks with a canonical scaffolder (React, Vue, Svelte…), fiddle
  hands off to the official tool (`npm create vite`, `ng new`, …). Always current, zero
  template maintenance.
- **`builtin`** — for the ecosystems with _no_ `create-X` (three.js, D3, RxJS, vanilla…),
  fiddle ships a curated starter. That's exactly where a good template has value.

Either way, fiddle writes a small `.fiddle.json` so `fiddle start` runs the right dev command
uniformly. Adding a framework is **one registry row**.

## Commands

| command | what it does |
|---|---|
| `fiddle create <framework> [name]` | scaffold a new fiddle (delegate or builtin) |
| `fiddle start [dir]` | run the fiddle's recorded dev command |
| `fiddle list` | list available frameworks |

## Frameworks

`fiddle list` — currently: **react**, **vue**, **svelte** (delegate → Vite) and **three** (builtin).
More are just registry entries.

## License

[MIT](LICENSE) © Brady House
