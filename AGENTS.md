# workon — Agent Guidelines

## Project Overview

`workon` is a Node.js CLI tool that discovers, remembers, and launches developer projects. It provides an interactive terminal UI (Ink/React) and per-project config via `.workonrc.json`.

## Build and Test

```bash
pnpm install        # install dependencies
pnpm build          # compile with tsdown → dist/
pnpm test           # run all tests with vitest
pnpm lint           # lint with oxlint
pnpm format         # format with oxfmt
```

## Architecture

```
src/cli.ts              # Entry point — commander setup
src/commands/           # One file per CLI subcommand
src/core/               # Business logic (scanner, config, project detection)
src/tui/                # Ink/React terminal UI components (*.tsx)
src/types.ts            # Shared TypeScript types
tests/                  # Vitest tests, mirrors src/ structure
```

Key files: [docs/workon.tech.md](docs/workon.tech.md) has the full technical spec.

## Conventions

- **Package manager**: pnpm only — never npm or yarn
- **Module system**: ESM (`"type": "module"`), `NodeNext` resolution — use `.js` extensions in imports
- **Path alias**: `@/*` maps to `src/*`
- **Formatting/linting**: oxfmt + oxlint — run `pnpm format` before committing
- **Config validation**: use Zod schemas for all config I/O (see `src/core/config.ts`, `src/core/devproject.ts`)
- **TUI components**: Ink 7 + React 19 — JSX in `.tsx` files under `src/tui/`
- **Tests**: Vitest, co-located fixtures in `tests/fixtures/`
- **Build target**: Node 18+, output to `dist/` as ESM
