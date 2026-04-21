# `workon` — Technical Specification

## Stack Overview

| Concern           | Choice               | Version |
| ----------------- | -------------------- | ------- |
| Runtime           | Node.js              | ≥ 18    |
| Language          | TypeScript           | 5.x     |
| Package manager   | pnpm                 | latest  |
| CLI framework     | commander            | 12.x    |
| TUI               | Ink                  | 5.x     |
| Fuzzy search      | fuse.js              | 7.x     |
| File scanning     | fast-glob            | 3.x     |
| Config validation | Zod                  | 3.x     |
| Testing           | Vitest               | 2.x     |
| Linting           | oxlint               | latest  |
| Formatting        | oxfmt                | latest  |
| Build             | tsdown               | latest  |
| Distribution      | npm (global install) | —       |

---

## Project Structure

```
workon/
├── src/
│   ├── cli.ts               # Entry point — commander setup, subcommand registration
│   ├── commands/
│   │   ├── tui.ts           # F4 — default command, launches Ink TUI
│   │   ├── open.ts          # F5 — workon open <name>
│   │   ├── list.ts          # F6 — workon list
│   │   ├── init.ts          # F7 — workon init
│   │   └── config.ts        # F8 — workon config <subcommand>
│   ├── core/
│   │   ├── scanner.ts       # F1 — project discovery using fast-glob
│   │   ├── project.ts       # Project type, marker detection, sorting
│   │   ├── config.ts        # Load/save ~/.workonrc.json via Zod
│   │   └── devproject.ts    # Load/validate .workonrc.json via Zod
│   ├── tui/
│   │   ├── App.tsx          # Root Ink component
│   │   ├── ProjectList.tsx  # Scrollable filtered list
│   │   ├── SearchBar.tsx    # Live fuzzy search input
│   │   └── HintBar.tsx      # Keyboard shortcuts bar
│   └── types.ts             # Shared TypeScript types
├── tests/
│   ├── scanner.test.ts
│   ├── config.test.ts
│   ├── project.test.ts
│   └── tui/
│       ├── App.test.tsx
│       ├── ProjectList.test.tsx
│       └── SearchBar.test.tsx
├── tsconfig.json
├── tsdown.config.ts
├── vitest.config.ts
└── package.json
```

---

## TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react",
    "jsxImportSource": "ink",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src"]
}
```

---

## Data Schemas (Zod)

### `~/.workonrc.json` — Global config

```ts
// src/core/config.ts
import { z } from "zod";

export const GlobalConfigSchema = z.object({
  roots: z.array(z.string()).default([]),
  maxDepth: z.number().int().min(1).default(3),
  defaultIde: z.enum(["code", "code-insiders"]).default("code"),
  defaultProfile: z.string().default(""),
  ignore: z.array(z.string()).default(["node_modules", "dist", ".git"]),
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
```

### `.workonrc.json` — Per-project config

```ts
// src/core/devproject.ts
import { z } from "zod";

export const DevProjectSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  ide: z.enum(["code", "code-insiders"]).optional(),
  profile: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export type DevProject = z.infer<typeof DevProjectSchema>;
```

---

## Core Types

```ts
// src/types.ts

export type ProjectType = "nodejs" | "rust" | "go" | "python" | "java" | "dotnet" | "generic";

export interface Project {
  name: string; // folder name or .workonrc.json override
  path: string; // absolute path
  type: ProjectType;
  ide: "code" | "code-insiders";
  profile: string;
  description: string;
  tags: string[];
  hasDevProject: boolean;
}
```

---

## F1 — Project Scanner

**Library:** `fast-glob`

**Logic:**

1. For each root in `config.roots`, call `fast-glob` to find directories up to `config.maxDepth` levels deep.
2. For each directory found, check for the presence of marker files to determine project type.
3. Filter out ignored folder names.
4. Load `.workonrc.json` if present, merge with global defaults.
5. Sort results alphabetically by `name`.

**Marker file mapping:**

| File                                               | Project type |
| -------------------------------------------------- | ------------ |
| `package.json`                                     | `nodejs`     |
| `Cargo.toml`                                       | `rust`       |
| `go.mod`                                           | `go`         |
| `pyproject.toml` / `setup.py` / `requirements.txt` | `python`     |
| `pom.xml` / `build.gradle`                         | `java`       |
| `*.csproj` / `*.sln`                               | `dotnet`     |
| `.git` (fallback)                                  | `generic`    |

Priority: first marker match wins (top-to-bottom order above).

**fast-glob usage sketch:**

```ts
import fg from "fast-glob";

const dirs = await fg("*".repeat(depth).split("").join("/"), {
  cwd: root,
  onlyDirectories: true,
  deep: config.maxDepth,
  ignore: config.ignore,
  absolute: true,
});
```

---

## F4 — TUI (Ink)

**Component tree:**

```
<App>
  <SearchBar />      ← controlled text input, updates search query state
  <ProjectList />    ← receives filtered projects, handles arrow key selection
  <HintBar />        ← static bar: ↑↓ navigate · Enter open · Esc clear/exit
```

**State (in `App`):**

```ts
const [query, setQuery] = useState("");
const [selectedIndex, setSelectedIndex] = useState(0);
const filtered = useMemo(() => fuzzySearch(projects, query), [projects, query]);
```

**Keyboard handling** via `useInput` from Ink:

- Printable chars → append to `query`, reset `selectedIndex` to 0
- `↑` / `↓` → move `selectedIndex`
- `Enter` → launch IDE for `filtered[selectedIndex]`, then `process.exit(0)`
- `Escape` → if `query` non-empty: clear query; else: `process.exit(0)`

---

## F5 — Fuzzy Search (fuse.js)

```ts
import Fuse from "fuse.js";

const fuse = new Fuse(projects, {
  keys: ["name", "path", "tags"],
  threshold: 0.4,
  includeScore: true,
});

export function fuzzySearch(projects: Project[], query: string): Project[] {
  if (!query) return projects;
  return fuse.search(query).map((r) => r.item);
}
```

---

## F5 — IDE Launch

Uses Node.js built-in `child_process.spawn` — no extra dependency.

```ts
import { spawn } from "node:child_process";

export function openProject(project: Project): void {
  const args = project.profile ? ["--profile", project.profile, project.path] : [project.path];

  spawn(project.ide, args, { detached: true, stdio: "ignore" }).unref();
}
```

---

## F7 — `workon init`

1. Check if `.workonrc.json` exists in `process.cwd()` — error if so.
2. Detect project type from marker files.
3. Write a pre-filled `.workonrc.json` with defaults from `~/.workonrc.json`.

---

## F8 — `workon config` Subcommands

Implemented with commander nested subcommands:

```
workon config show
workon config add-root <path>
workon config remove-root <path>
workon config set-ide <code|code-insiders>
workon config set-profile <name>
workon config set-depth <number>
```

Each subcommand reads `~/.workonrc.json`, mutates the relevant field, validates with Zod, and writes back.

---

## Build

```ts
// tsdown.config.ts
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node18",
  bundle: true,
  minify: false,
  clean: true,
  outDir: "dist",
});
```

The `package.json` `bin` field points to `dist/cli.js`.

---

## package.json (key fields)

```json
{
  "name": "workon",
  "type": "module",
  "bin": { "workon": "./dist/cli.js" },
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch",
    "test": "vitest run",
    "lint": "oxlint .",
    "format": "oxfmt --write ."
  }
}
```

---

## Testing Strategy

- **Unit tests** (Vitest): scanner logic, Zod schema validation, fuzzy search, config read/write.
- **Fixtures**: a `tests/fixtures/` folder with fake project trees to test discovery without touching the real filesystem.
- **TUI tests** (`ink-testing-library`): Ink components are rendered in a headless terminal and their output is asserted as plain text snapshots.

**TUI test approach:**

```ts
// tests/tui/App.test.tsx
import { render } from "ink-testing-library";
import { App } from "../../src/tui/App";

const projects = [
  { name: "alpha", path: "/dev/alpha", type: "nodejs", /* ... */ },
  { name: "beta",  path: "/dev/beta",  type: "rust",   /* ... */ },
];

test("renders project list", () => {
  const { lastFrame } = render(<App projects={projects} />);
  expect(lastFrame()).toContain("alpha");
  expect(lastFrame()).toContain("beta");
});

test("filters list as query changes", async () => {
  const { lastFrame, stdin } = render(<App projects={projects} />);
  stdin.write("alp");
  await Promise.resolve(); // flush Ink re-render
  expect(lastFrame()).toContain("alpha");
  expect(lastFrame()).not.toContain("beta");
});

test("Escape clears query", async () => {
  const { lastFrame, stdin } = render(<App projects={projects} />);
  stdin.write("alp");
  await Promise.resolve();
  stdin.write("\x1B"); // ESC
  await Promise.resolve();
  expect(lastFrame()).toContain("beta"); // full list restored
});
```

---

## Linter / Formatter Configuration

oxlint requires no configuration file for recommended rules — run as `oxlint .`.

oxfmt uses an `oxfmt.toml` for style preferences:

```toml
# oxfmt.toml
indent_style = "space"
indent_width = 2
```

---

## Dependencies Summary

### Runtime

| Package     | Purpose                              |
| ----------- | ------------------------------------ |
| `commander` | CLI argument parsing and subcommands |
| `ink`       | Terminal UI rendering                |
| `react`     | Required by Ink                      |
| `fuse.js`   | Fuzzy search                         |
| `fast-glob` | File system scanning                 |
| `zod`       | Config schema validation             |

### Dev

| Package               | Purpose                                    |
| --------------------- | ------------------------------------------ |
| `typescript`          | Compiler                                   |
| `tsdown`              | Build bundler                              |
| `vitest`              | Test runner                                |
| `ink-testing-library` | Headless Ink component rendering for tests |
| `oxlint`              | Linter                                     |
| `oxfmt`               | Formatter                                  |
| `@types/react`        | React types for Ink JSX                    |
