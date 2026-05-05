---
name: implement-feature
description: "Implement a feature using TDD/BDD from a .spec.md and .feature file. Use when: implementing a new feature, turning acceptance criteria into tests and code, following the plan→test→implement workflow, implementing a CLI command, implementing a core module, adding TUI interactions."
argument-hint: 'Path to spec and feature files (e.g. "docs/configurable-open-commands-cli.spec.md docs/configurable-open-commands-cli.feature")'
---

# Implement Feature from Spec + Gherkin

Takes a `.spec.md` and a `.feature` file as input and produces a working, tested implementation.

## Workflow Overview

```
[1] Explore codebase context + read inputs
        ↓
[2] Generate implementation plan (.plan.md)
        ↓
[3] Review plan with user
        ↓
[4] Write failing tests from Gherkin scenarios
        ↓
[5] Implement core logic (make tests pass)
        ↓
[6] Wire CLI / TUI layer
        ↓
[7] Run full test suite — verify green
        ↓
[8] Final checklist
```

---

## Phase 1 — Explore Project Context

Use a **read-only subagent** (`Explore` agent) to gather everything needed before touching any file. Provide it with the spec and feature file paths and ask it to return:

1. **Existing related code** — Which `src/core/`, `src/commands/`, or `src/tui/` files are affected? Read them in full.
2. **Current data shapes** — Read `src/types.ts` and `src/core/config.ts` for `GlobalConfig`, `OpenCommand`, `Project`, etc.
3. **Existing test patterns** — Read two representative test files (e.g. `tests/config.test.ts`, `tests/pinning.test.ts`) to understand setup helpers, `WORKONRC_PATH` override, fixture usage.
4. **Existing plan structure** — Skim one `.plan.md` file (e.g. `docs/pinned-projects.plan.md`) to calibrate the plan format.
5. **Dependency inventory** — What libraries are available? (`execa`, `fast-glob`, `fuse.js`, `ink`, `zod`, `vitest`). Are any new ones needed?

Subagent prompt hint:

> "Explore the workon project codebase. The following spec and feature files describe a new feature to implement: [spec path], [feature path]. Read those files fully, then identify: (1) which existing source files will be modified or extended, (2) the current GlobalConfig and related type shapes, (3) existing test setup patterns (WORKONRC_PATH, tmpdir, fixtures), (4) any relevant existing implementations to reuse. Return the full content of each affected source file."

---

## Phase 2 — Generate the Implementation Plan

Create `docs/<feature-slug>.plan.md` following the project's plan format (see `docs/pinned-projects.plan.md` as the canonical reference).

**Plan structure** (mandatory sections):

```markdown
# <Feature Name> — Implementation Plan

## TL;DR

One or two sentences summarising what will be built and how.

## Phases

### Phase 1 — <name> (blocks Phase 2)

Steps with: action, file path, rationale

### Phase 2 — <name> (blocks Phase 3)

...

## Relevant Files

### To Modify

- `src/core/config.ts` — add X, Y, Z functions (lines ~40–60)
- `src/commands/config.ts` — register 4 new subcommands

### To Create

- `tests/config-commands.test.ts` — unit + integration tests for new commands

## Tests to Add / Update

- Describe what each test file covers

## Verification Checklist

- [ ] `pnpm test` passes
- [ ] `pnpm build` succeeds
- [ ] Manual: `workon config list-commands` outputs table
- [ ] ...

## Decisions

- Why atomic write vs. simple writeFileSync
- Why core functions are pure (no CLI side effects)
```

**Phase structure rules** (follow these for every feature):

| Phase | Responsibility                                                                                           |
| ----- | -------------------------------------------------------------------------------------------------------- |
| 1     | Schema / type changes — extend Zod schemas, add types to `src/types.ts`                                  |
| 2     | Core logic — pure functions in `src/core/` (no CLI, no process.exit, no console.log)                     |
| 3     | Tests — write all Vitest tests (they will fail until Phase 2 is complete)                                |
| 4     | CLI wiring — register subcommands in `src/commands/`, add argument parsing, error output, `process.exit` |
| 5     | TUI (if needed) — add Ink components, keyboard handlers, state changes in `src/tui/`                     |

> **Key separation rule**: Core functions in Phase 2 must be pure — they take a config object and return a result or throw an Error. They must not call `console.log`, `process.exit`, or read/write files directly. The CLI layer in Phase 4 owns all side effects.

**After creating the plan**, present a summary to the user:

- How many phases, what each phase covers
- List of files to create and modify
- Ask: "Does this plan look correct? Shall I proceed to writing the tests?"

Do not proceed to Phase 3 until the user approves.

---

## Phase 3 — Write Failing Tests

Before writing any implementation code, write all tests. Tests must fail at this point (TDD Red phase).

**Map each Gherkin scenario group to a `describe` block:**

```ts
// tests/config-commands.test.ts

describe("add-command", () => {
  // Happy Path scenarios → it("adds a new open command successfully", ...)
  // Edge Case scenarios  → it("rejects duplicate display name", ...)
  // Error scenarios      → it("rejects duplicate executable", ...)
});

describe("remove-command", () => { ... });
describe("list-commands", () => { ... });
describe("set-default-command", () => { ... });
```

**Test file setup template** (follow the existing `tests/config.test.ts` pattern):

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { beforeEach, afterEach, describe, it, expect } from "vitest";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "workon-test-"));
  process.env["WORKONRC_PATH"] = join(tmpDir, ".workonrc.json");
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true });
  delete process.env["WORKONRC_PATH"];
});
```

**Mapping rules from Gherkin to tests:**

| Gherkin element                                     | Vitest equivalent                                            |
| --------------------------------------------------- | ------------------------------------------------------------ |
| `Given a workonrc.json with open commands: [table]` | Write a config to `WORKONRC_PATH` with those commands        |
| `When the user runs: workon config add-command ...` | Call the core function directly (not via CLI spawn)          |
| `Then the system displays: "..."`                   | In Phase 3, test the return value / thrown error, not stdout |
| `And the CLI should exit with code 0/1`             | Verify success return vs. thrown error                       |
| `And the ~/.workonrc.json file contains ...`        | Read `WORKONRC_PATH` and assert its content                  |
| `Scenario Outline + Examples`                       | `it.each([...])`                                             |

> **Do not spawn child processes** in unit tests. Test the core functions directly. CLI output and exit codes are covered by the integration test layer (a separate `tests/config-commands.integration.test.ts` file, which can use `execa` to spawn the built CLI).

**Coverage target**: Every Acceptance Criterion (AC1–ACn) in the spec must have at least one test case.

Run `pnpm test` after writing tests — confirm they fail for the right reasons (import errors or missing functions), not for syntax errors.

---

## Phase 4 — Implement Core Logic

Implement the pure functions in `src/core/` identified in the plan. Make the Phase 3 tests go green.

**Core function signature conventions:**

```ts
// Returns void on success, throws Error with user-facing message on failure
export function addOpenCommand(
  config: GlobalConfig,
  name: string,
  command: string
): void { ... }

export function removeOpenCommand(
  config: GlobalConfig,
  name: string
): { promoted: string | null; wasLast: boolean } { ... }

export function setDefaultOpenCommand(
  config: GlobalConfig,
  executable: string
): void { ... }
```

**Error messages must match the spec exactly** — copy error strings from the EC sections of the spec verbatim. Tests will assert on these strings.

**Atomic config write** (required by NFR3 if the spec includes a data integrity NFR):

```ts
import { writeFileSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";

export function saveConfigAtomic(config: GlobalConfig, configPath: string): void {
  const tmp = configPath + ".tmp";
  writeFileSync(tmp, JSON.stringify(config, null, 2), "utf-8");
  renameSync(tmp, configPath); // atomic on POSIX
}
```

Only add atomic write if the spec explicitly requires it (look for NFR with "atomic" or "data integrity"). Do not gold-plate.

After implementing each function, run `pnpm test` to verify the corresponding tests go green before moving on.

---

## Phase 5 — Wire CLI Layer

Register the new subcommands in the appropriate `src/commands/*.ts` file. This phase owns all CLI side effects: argument parsing, stdout output, `process.exit`.

**Commander subcommand template:**

```ts
config
  .command("add-command")
  .description("Add a new open command to the global config")
  .requiredOption("--name <display-name>", "Display name (e.g. 'Cursor')")
  .requiredOption("--command <executable>", "Executable name (e.g. 'cursor')")
  .addHelpText(
    "after",
    `\nExample:\n  workon config add-command --name "Cursor" --command "cursor"`,
  )
  .action(async (opts: { name: string; command: string }) => {
    const cfg = loadConfig();
    try {
      // PATH check (warn-only, non-blocking) — if spec requires FR5-style check:
      const inPath = await checkExecutableInPath(opts.command);
      if (!inPath) {
        console.warn(
          `Warning: executable '${opts.command}' not found in $PATH (but will be added anyway)`,
        );
      }
      addOpenCommand(cfg, opts.name, opts.command);
      saveConfig(cfg);
      console.log(`Added open command: ${opts.name} (${opts.command})`);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });
```

**PATH check helper** (only add if the spec requires executable validation):

```ts
import { which } from "execa"; // execa exports which

async function checkExecutableInPath(executable: string): Promise<boolean> {
  try {
    await which(executable);
    return true;
  } catch {
    return false;
  }
}
```

**Table formatting for list commands** (no external library — use `.padEnd()`):

```ts
function formatTable(commands: OpenCommand[], defaultCommand: string): string {
  const COL_NAME = 26;
  const COL_CMD = 16;
  const header = "Display Name".padEnd(COL_NAME) + "Executable".padEnd(COL_CMD) + "Default";
  const divider = "-".repeat(COL_NAME + COL_CMD + 7);
  const rows = commands.map(
    (c) =>
      c.name.padEnd(COL_NAME) +
      c.command.padEnd(COL_CMD) +
      (c.command === defaultCommand ? "Y" : "N"),
  );
  return [header, divider, ...rows].join("\n");
}
```

**Help text requirement**: Every new subcommand must have `.addHelpText("after", ...)` with at least one example (required by AC15 pattern in this project).

After wiring, run `pnpm build && pnpm test` to ensure everything compiles and tests remain green.

---

## Phase 6 — Wire TUI Layer (if applicable)

Only execute this phase if the spec includes TUI flows or the `.feature` file contains scenarios with keyboard/menu interactions.

**TUI checklist:**

- [ ] Add new props to the relevant component's interface
- [ ] Add `useInput` handler for new keyboard shortcut (follow existing `App.tsx` pattern)
- [ ] Add conditional render block for new modal/menu component (follow `showOpenMenu` / `showContextMenu` pattern)
- [ ] Render new Ink component with correct props and `onCancel` callback
- [ ] Write TUI test in `tests/tui/` using `ink-testing-library`

**TUI test template:**

```ts
import { render } from "ink-testing-library";
import React from "react";
import { App } from "@/tui/App.js";

it("shows new feature when user presses X", async () => {
  const { lastFrame, stdin } = render(<App projects={[]} config={mockConfig} />);
  stdin.write("x"); // trigger feature
  await Promise.resolve();
  expect(lastFrame()).toContain("expected output");
});
```

Skip this phase entirely if the spec marks TUI as out of scope.

---

## Phase 7 — Final Verification

Run the full verification checklist from the plan:

```bash
pnpm test          # all tests pass
pnpm build         # compiles without errors
pnpm lint          # no lint errors
```

Then perform manual smoke tests for the key happy-path flows from the spec's User Experience Flow section.

**Mark acceptance criteria**: Go through each AC in the spec and confirm each one is satisfied. If an AC is not covered, add a test or fix the implementation before finishing.

---

## Output Checklist

Before declaring the feature done:

- [ ] `docs/<slug>.plan.md` created with all sections
- [ ] All Gherkin AC scenarios have a corresponding test
- [ ] `pnpm test` passes (all tests green)
- [ ] `pnpm build` succeeds with no TypeScript errors
- [ ] `pnpm lint` passes
- [ ] Core functions are pure (no `console.log`, `process.exit` in `src/core/`)
- [ ] CLI layer owns all stdout output and exit codes
- [ ] Every new CLI subcommand has `--help` text with at least one example
- [ ] Error messages match spec EC sections verbatim
- [ ] Atomic write used if spec requires data integrity NFR
- [ ] No new external dependencies added unless explicitly required by the spec

---

## References

- `docs/pinned-projects.plan.md` — canonical plan format example
- `tests/config.test.ts` — canonical test setup pattern (`WORKONRC_PATH`, tmpdir)
- `src/core/config.ts` — `GlobalConfig` schema and `loadConfig`/`saveConfig`
- `src/commands/config.ts` — existing commander subcommand registration pattern
