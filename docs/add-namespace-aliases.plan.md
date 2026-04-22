# Plan: Add namespace aliases for imports

## TL;DR

Configure TypeScript and vitest to support `@/` namespace aliases (e.g., `@/core/search` instead of `../core/search`), then refactor 28 relative imports across 18 files (14 source + 4 test files).

## Steps

### Phase 1: Tooling Configuration

1. Update `tsconfig.json` to add path aliases:
   - Set `baseUrl: "."` and `paths: { "@/*": ["src/*"] }`
   - This enables TypeScript and editors to resolve `@/` imports correctly

2. Update `vitest.config.ts` to alias imports in tests:
   - Add `alias: { "@": path.resolve(__dirname, "./src") }` in vite config
   - Ensures tests can resolve `@/` imports to the src directory

### Phase 2: Refactor Source Files (14 files, ~17 imports)

Replace all relative import paths with `@/`:

- `src/cli.ts` — `./commands/` → `@/commands/`
- `src/commands/*.ts` (5 files) — `../core/` → `@/core/`, `../types.js` → `@/types.js`
- `src/core/*.ts` (5 files) — `../types.js` → `@/types.js`
- `src/tui/*.tsx` (3 files) — `../core/` → `@/core/`, `../types.js` → `@/types.js`, `./SearchBar.js` → `@/tui/SearchBar.js` (for absolute consistency)

### Phase 3: Refactor Test Files (4 files, ~11 imports)

Replace all test imports:

- `tests/*.test.ts` (4 files) — `../src/core/` → `@/core/`

## Relevant files

- `tsconfig.json` — Add `baseUrl` and `paths` under `compilerOptions`
- `vitest.config.ts` — Add `alias` under `test` or `resolve` config
- **Source files to refactor**: `src/cli.ts`, `src/commands/config.ts`, `src/commands/init.ts`, `src/commands/list.ts`, `src/commands/open.ts`, `src/commands/tui.ts`, `src/core/launcher.ts`, `src/core/metadata.ts`, `src/core/project.ts`, `src/core/scanner.ts`, `src/core/search.ts`, `src/tui/App.tsx`, `src/tui/IDEDialog.tsx`, `src/tui/ProjectList.tsx`
- **Test files to refactor**: `tests/config.test.ts`, `tests/metadata.test.ts`, `tests/project.test.ts`, `tests/scanner.test.ts`

## Verification

1. **TypeScript compilation**: Run `tsc --noEmit` to ensure no type errors after refactoring
2. **Test execution**: Run `pnpm test` to verify all tests pass with new import paths
3. **CLI execution**: Run `pnpm build && node dist/cli.mjs` to verify the built CLI works end-to-end
4. **Editor resolution**: Open a file and hover over an `@/` import to confirm IntelliSense resolves correctly

## Decisions

- Using **single `@/` namespace** (not granular like `@core/`, `@commands/`) for simplicity and consistency
- **Including local component imports** in tui (e.g., `./SearchBar.js` → `@/tui/SearchBar.js`) for complete consistency across the codebase
- **Vitest alias required** for test files to resolve `@/` paths at runtime (tsconfig.json alone isn't sufficient for Jest-like runners)
