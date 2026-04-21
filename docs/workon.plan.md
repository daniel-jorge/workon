# Plan: workon CLI — Full Implementation

## TL;DR

Build the `workon` CLI tool from scratch based on three doc files. The stack is Node.js 18+ / TypeScript 5 / pnpm, with commander (CLI), Ink 5 (TUI), fuse.js (fuzzy search), fast-glob (scanning), Zod (validation), Vitest + ink-testing-library (tests), tsdown (build). No source files exist yet — workspace contains only docs/.

---

## Phase 1 — Project Bootstrap (blocks all other phases)

1. Create `package.json` with all runtime + dev dependencies, scripts (`build`, `dev`, `test`, `lint`, `format`), `"type": "module"`, `"bin"` pointing to `dist/cli.js`, `"engines": {"node": ">=18"}`
2. Create `tsconfig.json` — target ES2022, module NodeNext, jsx react, jsxImportSource ink, strict, outDir dist, rootDir src
3. Create `tsdown.config.ts` — entry `src/cli.ts`, format ESM, target node18, bundle, clean
4. Create `vitest.config.ts` — configure for ESM + JSX (ink), include tests/ folder
5. Create `oxfmt.toml` — `indent_style = "space"`, `indent_width = 2`
6. Run `pnpm install`

---

## Phase 2 — Core Layer (parallel among files; blocks Phase 3, 4, 6)

7. `src/types.ts` — `ProjectType` union, `Project` interface (name, path, type, ide, profile, description, tags, hasDevProject)
8. `src/core/config.ts` — `GlobalConfigSchema` (Zod), `GlobalConfig` type, `loadConfig()` reads `~/.workonrc.json` (creates with defaults on first run), `saveConfig()` validates + writes
9. `src/core/devproject.ts` — `DevProjectSchema` (Zod), `DevProject` type, `loadDevProject(dir)` reads `.workonrc.json`, returns null if absent
10. `src/core/project.ts` — `detectProjectType(dir)` checks marker files in priority order, `mergeProject(dir, globalConfig, devProject?)` builds a full `Project` object
11. `src/core/scanner.ts` — `scanProjects(config)` uses fast-glob per root, calls `mergeProject` per dir, sorts alphabetically
12. `src/core/search.ts` — `fuzzySearch(projects, query)` using fuse.js (keys: name, path, tags; threshold 0.4); returns all projects if query is empty
13. `src/core/launcher.ts` — `openProject(project)` using `child_process.spawn` detached + unref

---

## Phase 3 — Commands (parallel; depends on Phase 2 + Phase 4 for tui.ts)

14. `src/commands/list.ts` — F6: load config → scan → print each project name + path to stdout
15. `src/commands/open.ts` — F5: load config → scan → fuzzySearch → open first match or print error
16. `src/commands/init.ts` — F7: check for existing `.workonrc.json`, detect type, write pre-filled file
17. `src/commands/config.ts` — F8: nested commander subcommands (`show`, `add-root`, `remove-root`, `set-ide`, `set-profile`, `set-depth`); each reads → mutates → validates → writes config
18. `src/commands/tui.ts` — F4: load config → scan → render `<App projects={...} />` via Ink's `render()`

---

## Phase 4 — TUI Layer (parallel among components; depends on Phase 2 types)

19. `src/tui/HintBar.tsx` — static `<Text>` bar: `↑↓ navigate · Enter open · Esc clear/exit`
20. `src/tui/SearchBar.tsx` — controlled text input displaying current query; receives `query` + `onChange` props
21. `src/tui/ProjectList.tsx` — receives `projects` + `selectedIndex`; renders scrollable list with name, path, type, ide, profile; highlights selected row
22. `src/tui/App.tsx` — root component: holds `query` + `selectedIndex` state; `useInput` for keyboard handling (chars → query, ↑↓ → index, Enter → openProject + exit, Esc → clear or exit); renders SearchBar + ProjectList + HintBar; shows count "N / M"

---

## Phase 5 — CLI Entry Point (depends on Phase 3)

23. `src/cli.ts` — commander `Program`, version from package.json, registers all subcommands (`open`, `list`, `init`, `config`), default action launches TUI command

---

## Phase 6 — Tests (depends on Phase 2, 4)

### Fixtures (parallel with tests)

24. `tests/fixtures/` — fake directory trees: nodejs project (package.json), rust project (Cargo.toml), python project (requirements.txt), generic project (.git only), project with .workonrc.json

### Unit tests (parallel among files)

25. `tests/config.test.ts` — loadConfig creates defaults when missing; saveConfig validates and rejects invalid data; round-trip read/write
26. `tests/project.test.ts` — detectProjectType returns correct type per marker; priority ordering (nodejs beats generic)
27. `tests/scanner.test.ts` — scanProjects with fixture root: discovers correct projects, ignores node_modules/dist, sorts alphabetically, merges .workonrc.json overrides

### TUI tests (parallel among files; needs ink-testing-library)

28. `tests/tui/SearchBar.test.tsx` — renders query string; updates on stdin character input
29. `tests/tui/ProjectList.test.tsx` — renders all project names; highlights selected index; renders type/ide/profile
30. `tests/tui/App.test.tsx` — renders full list; filters on query via stdin; Esc clears query; second Esc exits; Enter calls openProject (mock launcher)

---

## Relevant Files (all new)

- `package.json` — deps, scripts, bin
- `tsconfig.json` — TS compiler options
- `tsdown.config.ts` — bundler config
- `vitest.config.ts` — test runner config
- `oxfmt.toml` — formatter config
- `src/types.ts` — `ProjectType`, `Project`
- `src/core/config.ts` — `GlobalConfigSchema`, `loadConfig`, `saveConfig`
- `src/core/devproject.ts` — `DevProjectSchema`, `loadDevProject`
- `src/core/project.ts` — `detectProjectType`, `mergeProject`
- `src/core/scanner.ts` — `scanProjects`
- `src/core/search.ts` — `fuzzySearch`
- `src/core/launcher.ts` — `openProject`
- `src/commands/list.ts`, `open.ts`, `init.ts`, `config.ts`, `tui.ts`
- `src/tui/App.tsx`, `ProjectList.tsx`, `SearchBar.tsx`, `HintBar.tsx`
- `src/cli.ts`
- `tests/config.test.ts`, `project.test.ts`, `scanner.test.ts`
- `tests/tui/App.test.tsx`, `ProjectList.test.tsx`, `SearchBar.test.tsx`
- `tests/fixtures/` (fake project trees)

---

## Verification

1. `pnpm install` — zero errors
2. `pnpm build` — produces `dist/cli.js`
3. `pnpm test` — all tests pass (unit + TUI)
4. `pnpm lint` — zero oxlint warnings
5. Manual smoke: `node dist/cli.js config add-root ~/Developer` → then `node dist/cli.js list` → then `node dist/cli.js` (TUI opens)
6. Manual smoke: `node dist/cli.js open <partial-name>` opens VS Code

---

## Decisions

- `fuzzySearch` lives in `src/core/search.ts` (shared by TUI and `open` command) — not colocated with TUI
- `openProject` lives in `src/core/launcher.ts` (shared by TUI Enter handler and `open` command)
- `src/core/search.ts` and `src/core/launcher.ts` are additions beyond the tech spec's file list; all other files match the spec exactly
- TUI tests use `ink-testing-library` + Vitest; `openProject` is mocked (vi.mock) to prevent actual IDE launch
- No E2E tests; no TUI snapshot files committed (assertions on `lastFrame()` string content)
- Scope excludes: packaging/publishing to npm, CI/CD pipeline, Windows path support beyond Node defaults
