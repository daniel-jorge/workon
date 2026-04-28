# Implementation Plan: Configurable Open Commands

## Overview

Replace hardcoded VS Code IDE options (`"code"`, `"code-insiders"`) with user-configurable `openCommands` array in `.workonrc.json`. Users can define any CLI command, select from a dynamic menu, and maintain backward compatibility via sensible defaults. Implementation organized in 5 phases with minimal dependencies between them until testing.

---

## Phase 1: Type Definitions & Schema (Start immediately)

1. **[src/types.ts](src/types.ts)** — Add `OpenCommand` interface (`name`, `command`); change `Project.ide` → `Project.openCommand`
2. **[src/core/config.ts](src/core/config.ts)** — Add Zod schema for `OpenCommand`; rename `defaultIde` → `defaultOpenCommand`; add migration layer for old configs; set defaults (code + code-insiders)
3. **[src/core/devproject.ts](src/core/devproject.ts)** — Update `DevProjectSchema` to use `openCommand`; add same migration logic
4. **[src/core/ides.ts](src/core/ides.ts)** — Remove `AVAILABLE_IDES` and `IDE` exports (no longer needed)

---

## Phase 2: Core Logic (_depends on Phase 1_)

5. **[src/core/project.ts](src/core/project.ts)** — Update `mergeProject()` to use `openCommand`; fallback: per-project → global default → first available command
6. **[src/core/launcher.ts](src/core/launcher.ts)** — Rename `overrideIde` → `overrideOpenCommand`; use same argument pattern
7. **[src/commands/](src/commands/)** — Update any IDE references to use new field/param names

---

## Phase 3: TUI Updates (_depends on Phase 1 & 2_)

8. **[src/tui/OpenMenu.tsx](src/tui/OpenMenu.tsx)** — Accept `openCommands: OpenCommand[]` prop; render dynamic menu using `name` field; numeric keys work for any count (already generic)
9. **[src/tui/App.tsx](src/tui/App.tsx)** — Extract `openCommands` from config; pass to `OpenMenu`; update callback names
10. **[src/tui/ContextMenu.tsx](src/tui/ContextMenu.tsx)** + others — Search for IDE hardcoding; update as needed

---

## Phase 4: Tests (_depends on all previous_)

11. **[tests/config.test.ts](tests/config.test.ts)** — Valid/invalid `openCommands` arrays; duplicate detection; migration from `defaultIde`; defaults applied
12. **[tests/project.test.ts](tests/project.test.ts)** — `mergeProject()` uses `openCommand`; fallback chain works
13. **[tests/launcher.test.ts](tests/launcher.test.ts)** (create if missing) — `openProject()` invokes correct command
14. **[tests/tui/OpenMenu.test.ts](tests/tui/OpenMenu.test.ts)** (create if missing) — Menu renders all commands; keybindings work; callbacks fire correctly
15. **[tests/scanner.test.ts](tests/scanner.test.ts)** — Update fixtures/assertions for new field names

---

## Phase 5: Integration (_depends on Phase 4_)

16. Run full test suite; verify no regressions
17. Validate backward compatibility (old `.workonrc.json` files still work)

---

## Relevant Files Summary

### Schema & Types

- [src/types.ts](src/types.ts)
- [src/core/config.ts](src/core/config.ts)
- [src/core/devproject.ts](src/core/devproject.ts)
- [src/core/ides.ts](src/core/ides.ts)

### Core Logic

- [src/core/project.ts](src/core/project.ts)
- [src/core/launcher.ts](src/core/launcher.ts)
- [src/commands/open.ts](src/commands/open.ts)

### UI Components

- [src/tui/OpenMenu.tsx](src/tui/OpenMenu.tsx)
- [src/tui/App.tsx](src/tui/App.tsx)
- [src/tui/ContextMenu.tsx](src/tui/ContextMenu.tsx)

### Tests

- [tests/config.test.ts](tests/config.test.ts)
- [tests/project.test.ts](tests/project.test.ts)
- [tests/launcher.test.ts](tests/launcher.test.ts)
- [tests/tui/OpenMenu.test.ts](tests/tui/OpenMenu.test.ts)
- [tests/scanner.test.ts](tests/scanner.test.ts)

---

## Verification Checklist

- [ ] Full test suite passes (`pnpm test`)
- [ ] Backward compatibility: Old `.workonrc.json` with `"ide": "code"` loads and works
- [ ] Manual TUI: Open menu displays all configured commands with names
- [ ] Number keys 1–9 open with correct command
- [ ] Edge case: 1 command configured → menu shows 1 option
- [ ] Edge case: 9 commands configured → menu shows all with keybindings
- [ ] Edge case: Invalid config rejected with clear error message

---

## Key Design Decisions

- **Max 9 commands** — UI constraint due to numeric keypad (1–9) shortcuts
- **Migration layer** — Config loader accepts both `ide` (legacy) and `openCommand` (new); normalized to new on save
- **Fallback order for open command selection:**
  1. Per-project `openCommand` (from `.workonrc.json`)
  2. Global `defaultOpenCommand`
  3. First command in `openCommands` array
- **No pre-flight validation** — Commands checked only when executed (via `execa`); "command not found" errors bubble to user
- **Default configuration** — If no `openCommands` provided, default to:
  ```json
  [
    { "name": "Visual Studio Code", "command": "code" },
    { "name": "VS Code Insiders", "command": "code-insiders" }
  ]
  ```

---

## Future Considerations (Out of Scope)

1. **Per-project CLI override** — Feature like `workon open <project> --via cursor` (future)
2. **Command validation command** — Consider `workon config validate` to check if commands exist in `$PATH` (post-MVP)
3. **Documentation examples** — Need guides for Cursor, Zed, custom scripts (separate task)
4. **Per-project command overrides via config** — Allow `.workonrc.json` files in projects to specify custom open commands (future)
5. **Custom environment variables per command** — Define custom env vars or arguments for specific open commands (future)

---

## Implementation Notes

### Type Changes Summary

- `Project.ide: "code" | "code-insiders"` → `Project.openCommand: string`
- New type: `OpenCommand { name: string; command: string }`
- Config field: `defaultIde: "code" | "code-insiders"` → `defaultOpenCommand: string`
- New config field: `openCommands: OpenCommand[]`

### Migration Strategy

During config load ([src/core/config.ts](src/core/config.ts)):

1. Check if loaded JSON has `defaultIde` but no `defaultOpenCommand`
2. If true, map `defaultIde` value to `defaultOpenCommand`
3. If neither field exists, apply defaults (code + code-insiders)
4. Normalize `.workonrc.json` files in projects using same logic

### UI Rendering Changes

- [src/tui/OpenMenu.tsx](src/tui/OpenMenu.tsx) currently hardcodes IDE display map; replace with dynamic rendering from `openCommands` prop
- Numeric key handler (`/^[1-9]$/.test(input)`) already works for any count (no changes needed)
- Show `name` field from config as menu labels

### Test Fixtures

- Add test config files in [tests/fixtures/](tests/fixtures/) or similar:
  - `multi-commands.json` — 4 commands
  - `single-command.json` — 1 command (minimum)
  - `max-commands.json` — 9 commands (maximum)
  - `invalid-duplicate-open-commands.json` — Should fail validation
- Update existing fixture `.workonrc.json` files that reference old `ide` field
