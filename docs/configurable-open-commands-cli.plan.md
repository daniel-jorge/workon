# Implementation Plan: F10 — Configurable Open Commands CLI Management

## Overview

Add four `workon config` subcommands (`add-command`, `remove-command`, `list-commands`, `set-default-command`) that let users manage the `openCommands` array in `~/.workonrc.json` without editing the file directly. The foundation (schema, `openCommands` field, `loadConfig`/`saveConfig`) is already in place. This plan covers the CLI layer, business-logic helpers, atomic writes, PATH validation, and tests.

---

## Phase 1: Atomic Config Writes & Core Logic (No Dependencies)

These changes are self-contained and must land before the CLI commands so they can be tested in isolation.

### Step 1 — Make `saveConfig()` atomic in [src/core/config.ts](src/core/config.ts)

Replace the plain `writeFileSync` call with a write-to-temp + atomic-rename pattern:

1. Write validated JSON to a sibling temp file (`<configPath>.tmp`)
2. `renameSync(tmpPath, configPath)` — atomic on POSIX; near-atomic on Windows
3. Wrap in try/catch; on failure, unlink the temp file and rethrow with the message `"Failed to save config: <reason>. Your config has NOT been changed."`

This satisfies **NFR3** and **EC6** across all config write operations, not just the new ones.

### Step 2 — Add open-command CRUD helpers to [src/core/config.ts](src/core/config.ts)

Export four pure functions that operate on a `GlobalConfig` value and return either an updated `GlobalConfig` or throw a typed error. Keeping them in `config.ts` avoids a new file for thin helpers.

```ts
addOpenCommand(cfg, name, command): GlobalConfig
// throws if duplicate name or duplicate command (EC1, EC2)

removeOpenCommand(cfg, name): { config: GlobalConfig; promotedTo: string | null; wasLast: boolean }
// throws if name not found (EC3)
// auto-promotes default if removed command was default (EC5 / EC5b)

setDefaultOpenCommand(cfg, executable): GlobalConfig
// throws if executable not in openCommands (EC4)

listOpenCommands(cfg): Array<{ name: string; command: string; isDefault: boolean }>
// pure read — no throws
```

Error messages must match exactly what is specified in EC1–EC4 of the spec, since they will be printed verbatim by the CLI layer.

### Step 3 — Add PATH lookup helper in [src/core/config.ts](src/core/config.ts) (or inline in the command)

```ts
async function isExecutableInPath(executable: string): Promise<boolean>;
```

Use `execa("which", [executable])` (already a project dependency). Return `false` on non-zero exit or any error. This satisfies **FR5 / EC7**.

---

## Phase 2: CLI Subcommands in [src/commands/config.ts](src/commands/config.ts)

_Depends on Phase 1._

Each subcommand follows the same pattern:

1. `loadConfig()` — re-reads from disk to catch concurrent changes (**NFR3**)
2. Call the relevant Phase 1 helper
3. On error: `console.error(err.message)` → `process.exit(1)`
4. On success: `saveConfig(updatedConfig)` → print success message → `process.exit(0)`

### Step 4 — `workon config add-command`

```
config add-command --name <display-name> --command <executable>
```

- Both `--name` and `--command` are required; Commander's `.requiredOption()` handles the missing-argument case with the usage error from **AC14**
- Add `.addHelpText("after", ...)` with example: `workon config add-command --name "Cursor" --command "cursor"` (**AC15**)
- After duplicate check passes, call `isExecutableInPath(executable)`:
  - Not found → `console.warn("Warning: executable '...' not found in $PATH (but will be added anyway)")`
  - Found → no output
- On success: `"Added open command: <name> (<command>)"`

### Step 5 — `workon config remove-command`

```
config remove-command --name <display-name>
```

- `--name` is required via `.requiredOption()` (**AC14**)
- Add `.addHelpText("after", ...)` with example (**AC15**)
- On success: `"Removed open command: <name>"`
- If `promotedTo` is non-null: additionally print `"Default promoted to: <promotedTo>"`
- If `wasLast` is true: additionally print `"Warning: No commands remain in config"`

### Step 6 — `workon config list-commands`

```
config list-commands
```

- No arguments; no required options
- Add `.addHelpText("after", ...)` with example (**AC15**)
- Print a plain-text table using padded columns: `Display Name | Executable | Default`
- Use `"Y"` / `"N"` in the Default column; compare each command's `command` field against `cfg.defaultOpenCommand` (**AC5**)
- Column widths derived from max string length in each column for alignment

### Step 7 — `workon config set-default-command`

```
config set-default-command <executable>
```

- Positional argument; Commander shows a usage error if omitted — add explicit check and print `"executable name is required"` with example `"workon config set-default-command cursor"` before `process.exit(1)` (**AC14**)
- Add `.addHelpText("after", ...)` with example (**AC15**)
- On success: `"Set default open command to: <executable>"`

### Step 8 — Deprecate `set-ide` subcommand

Mark the existing `set-ide` subcommand as deprecated in its `.description()`:

```ts
.description("(deprecated: use set-default-command) Set the default open command")
```

Per **NFR2**, it must keep working; no removal needed.

---

## Phase 3: Tests

_Depends on Phase 1 & 2._

### Step 9 — Unit tests: core helpers in [tests/config.test.ts](tests/config.test.ts)

Add a new `describe("open command management")` block covering:

| Scenario                                                                      | AC/EC      |
| ----------------------------------------------------------------------------- | ---------- |
| `addOpenCommand` adds to array and returns updated config                     | AC1        |
| `addOpenCommand` throws on duplicate display name                             | AC3 / EC1  |
| `addOpenCommand` throws on duplicate executable                               | AC4 / EC2  |
| `removeOpenCommand` removes correct entry                                     | AC6        |
| `removeOpenCommand` throws when name not found                                | AC8 / EC3  |
| `removeOpenCommand` auto-promotes default when removed command was default    | AC7 / EC5  |
| `removeOpenCommand` sets defaultOpenCommand to `""` when last command removed | EC5b       |
| `setDefaultOpenCommand` updates defaultOpenCommand                            | AC9        |
| `setDefaultOpenCommand` throws when executable not in openCommands            | AC10 / EC4 |
| `listOpenCommands` returns correct `isDefault` flags                          | AC5        |
| `saveConfig` (atomic) leaves original file intact when write fails            | EC6        |

### Step 10 — Integration tests: new CLI subcommands in a new file `tests/config-cli.test.ts`

Use the existing `WORKONRC_PATH` env-var pattern to isolate config file per test. Drive the CLI functions directly (import and call `registerConfigCommand` against a test Commander instance) rather than spawning a subprocess.

| Scenario                                                                   | AC               |
| -------------------------------------------------------------------------- | ---------------- |
| `add-command` happy path: file updated, success message printed            | AC1, AC13        |
| `add-command` then `list-commands`: new entry visible                      | AC2              |
| `add-command` duplicate name: exits 1, file unchanged                      | AC3              |
| `add-command` duplicate executable: exits 1, file unchanged                | AC4              |
| `add-command` with unknown executable: warning + success                   | AC11             |
| `add-command` with known executable: no warning + success                  | AC12             |
| `remove-command` happy path: entry removed                                 | AC6              |
| `remove-command` promotes default: message + config updated                | AC7              |
| `remove-command` removes last command: warning + defaultOpenCommand `""`   | EC5b             |
| `remove-command` non-existent name: exits 1, file unchanged                | AC8              |
| `list-commands` table format: columns correct, default marked Y            | AC5              |
| `set-default-command` happy path: config updated, message printed          | AC9              |
| `set-default-command` non-existent executable: exits 1 with available list | AC10             |
| `set-default-command` without argument: exits 1 with usage + example       | AC14             |
| `add-command` without `--name`: exits 1 with usage + example               | AC14             |
| Multiple adds maintain insertion order                                     | AC2, persistence |

---

## Phase 4: Integration Verification

### Step 11 — Run full test suite

```
pnpm test
```

All existing tests must remain green. No regressions expected; the schema and save function are backward-compatible.

### Step 12 — Manual smoke test (optional)

```bash
workon config add-command --name "Cursor" --command "cursor"
workon config list-commands
workon config set-default-command "cursor"
workon config list-commands
workon config remove-command --name "Visual Studio Code"
workon config list-commands
```

Verify output matches the exact strings from the spec.

---

## Relevant Files Summary

### Modified

| File                                             | Changes                                        |
| ------------------------------------------------ | ---------------------------------------------- |
| [src/core/config.ts](src/core/config.ts)         | Atomic `saveConfig`, CRUD helpers, PATH lookup |
| [src/commands/config.ts](src/commands/config.ts) | 4 new subcommands, deprecate `set-ide`         |
| [tests/config.test.ts](tests/config.test.ts)     | New `describe` block for CRUD helpers          |

### Created

| File                       | Purpose                                     |
| -------------------------- | ------------------------------------------- |
| `tests/config-cli.test.ts` | Integration tests for all 4 CLI subcommands |

---

## Dependency Graph

```
Phase 1 (Steps 1–3)
    └── Phase 2 (Steps 4–8)
            └── Phase 3 (Steps 9–10)
                    └── Phase 4 (Steps 11–12)
```

Steps 1–3 are independent of each other and can be done in any order. Steps 4–7 are independent of each other once Phase 1 is complete.
