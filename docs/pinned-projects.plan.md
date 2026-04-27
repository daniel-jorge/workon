# Plan: Implement Pinned Projects Feature

**TL;DR:** Extend the global config schema to store pinned project paths, add sorting logic in the scanner to promote pinned projects to the top, create a new ContextMenu TUI component for toggling pins, and add three CLI subcommands (`pin list`, `pin open`, `pin toggle`). Handle edge cases like missing projects and duplicates. Total: ~10–12 implementation steps with clear dependencies, 2 new components, 4 files modified, 1 new command file.

---

## Steps

### **Phase 1: Core Data & Configuration (Steps 1–2)**

_Dependency: None — foundational_

1. **Extend GlobalConfig schema** in [src/core/config.ts](src/core/config.ts)
   - Add `pinned: z.array(z.string()).default([])` field (absolute paths to pinned project roots)
   - Export extended `GlobalConfig` type
   - Validation will auto-serialize/deserialize from `~/.workonrc.json`
   - No changes to `loadConfig()` / `saveConfig()` — Zod handles it

2. **Add pinning utility functions** in new file `src/core/pinning.ts`
   - `isPinned(projectPath: string, config: GlobalConfig): boolean` — O(1) lookup using Set
   - `togglePin(projectPath: string, config: GlobalConfig): GlobalConfig` — returns updated config
   - `deduplicatePins(paths: string[]): string[]` — for edge case handling
   - `validatePinnedPaths(paths: string[]): {valid: string[]; invalid: string[]}` — for cleanup

### **Phase 2: TUI Components (Steps 3–5)**

_Dependency: Phase 1_

3. **Create LaunchMenu component** at [src/tui/LaunchMenu.tsx](src/tui/LaunchMenu.tsx)
   - Unified menu combining IDE selection and pin toggle
   - Receives: `visible: boolean`, `projectName: string`, `currentIde: string`, `isPinned: boolean`, `onSelectIde: (ide: string) => void`, `onTogglePin: () => void`, `onCancel: () => void`, `isMissing: boolean`
   - Title bar displays project name only
   - Menu options:
     - IDE options at top (e.g., "[1] Visual Studio Code", "[2] VS Code Insiders")
     - Default IDE pre-selected and highlighted
     - Pin/Unpin option at bottom ("Pin Project" or "Unpin Project" based on state)
     - If project is missing, IDE options are disabled, only "Unpin Project" available
   - Traps keyboard input via `useInput`:
     - `↑↓` — Navigate between options
     - `1–3` — Quick-select an IDE
     - `Return` — Execute selected action (launch with IDE or toggle pin)
     - `Esc` — Cancel and return to project list
   - Renders centered with rounded border

4. **Update ProjectList rendering** in [src/tui/ProjectList.tsx](src/tui/ProjectList.tsx)
   - Import pinning utilities
   - When rendering each project, check `isPinned(project.path, config)` and prepend `📌` if true
   - For missing/deleted pinned projects, render a special row: `"⚠️ /path/to/deleted (not found)"`
   - No component signature changes; just modify line rendering logic

5. **Update App.tsx keyboard handling & state** in [src/tui/App.tsx](src/tui/App.tsx)
   - Add state: `showLaunchMenu: boolean`
   - Modify `useInput` handler:
     - Change: `key.return` (Enter) now opens LaunchMenu instead of launching immediately
     - Set `showLaunchMenu = true` when Enter is pressed
     - Remove old behavior: direct launch on Enter
   - Add LaunchMenu component to render tree (replaces IDEDialog conditional)
   - In LaunchMenu callbacks:
     - `onSelectIde(ide)`: Launch project with IDE, exit process
     - `onTogglePin()`:
       - Call `togglePin()` → updated config
       - `await saveConfig(updatedConfig)`
       - Re-run `scanProjects()` (triggers resort & re-render)
       - Close menu (return to project list)
     - `onCancel()`: Close menu, return to project list
   - If launch menu open, trap other keyboard input (same pattern as IDEDialog)
   - **Update HintBar**: Change "Enter open" → "Enter menu"

### **Phase 3: Scanner & Sorting (Steps 6–7)**

_Dependency: Phase 1_

6. **Modify scanProjects() sort logic** in [src/core/scanner.ts](src/core/scanner.ts)
   - At the end of `scanProjects()`, after collecting all Project objects:
     - Create Set from `config.pinned` for O(1) lookup
     - Split projects into pinned + unpinned groups (maintain scan order within each)
     - Return `[...pinned, ...unpinned]`
   - Add validation: for each pinned path not found in scan, add a placeholder Project with `name` = path, `path`, `type: "generic"`, `missing: true` marker
   - Log warnings for invalid/missing pinned entries
   - Verify this respects the existing alphabetical sort _within_ pinned/unpinned groups (alphabetical _after_ split)

7. **Extend search to respect pin order** in [src/core/search.ts](src/core/search.ts)
   - `fuzzySearch()` already operates on pre-sorted results, so no changes needed
   - Verify: if projects are [pinned, pinned, unpinned, unpinned], search results should maintain that order
   - Document that order is determined upstream in scanProjects()

### **Phase 4: CLI Subcommands (Steps 8–10)**

_Dependency: Phase 1_

8. **Create `workon pin` command structure** in new file [src/commands/pin.ts](src/commands/pin.ts)
   - Export default function that registers three subcommands via commander:
     - `workon pin list` — handler: `listPinned()`
     - `workon pin open <name>` — handler: `openPinned(name)`
     - `workon pin toggle <name>` — handler: `togglePinCli(name)`
   - Each handler loads config, scanProjects(), and operates on the pinned array
   - Return exit codes: 0 on success, 1 on error
   - All handlers use `fuzzySearch()` with exact-first matching for project resolution

9. **Implement `pin list` subcommand**
   - Load config + scanProjects()
   - For each path in `config.pinned`:
     - Find matching Project in scan results (or note "not found")
     - Output: `[📌] ProjectName — /path/to/project` or `[📌] /path/to/project (not found)` if missing
   - If no pinned projects: "No pinned projects. Add one with: workon pin toggle <project-name>"
   - Exit 0

10. **Implement `pin open` & `pin toggle` subcommands**
    - `open <name>`: fuzzySearch pinned projects for `name`, call `openProject(matched)` (reuse from launcher.ts)
    - `toggle <name>`: fuzzySearch all projects for `name`, call `togglePin()`, save config, output "✓ Pinned <name>" or "✓ Unpinned <name>"
    - If not found, error: "Project '<name>' not found" (exit 1)

11. **Register pin command in CLI** in [src/cli.ts](src/cli.ts)
    - Import `{ registerPinCommand }` from `./commands/pin.js`
    - Call `registerPinCommand(program)` after existing command registrations
    - Test: `workon pin --help` shows subcommands

### **Phase 5: Edge Cases & Robustness (Steps 12–13)**

_Dependency: Phases 1–4_

12. **Handle missing/deleted projects in TUI & scanner**
    - Modify scanProjects() to include placeholder rows for pinned paths not found on disk
    - In ProjectList, detect `project.missing === true` and render with ⚠️ prefix
    - In LaunchMenu, if project.missing, disable IDE options and show only "Unpin Project" option
    - When LaunchMenu "Unpin Project" is selected for missing project, remove from config as normal

13. **Add `workon config cleanup-pins` subcommand** in [src/commands/config.ts](src/commands/config.ts)
    - Scan file system to check each pinned path exists
    - Collect list of missing paths
    - Prompt user: "Remove X missing pin(s)?" (or just remove with verbose output)
    - Update config, save, output: "✓ Removed N missing pin(s)"
    - This replaces manual editing if pins break

---

## Relevant Files

**To modify:**

- [src/core/config.ts](src/core/config.ts) — GlobalConfigSchema: add `pinned` field
- [src/core/scanner.ts](src/core/scanner.ts) — Final sort: split pinned/unpinned, add placeholders
- [src/tui/ProjectList.tsx](src/tui/ProjectList.tsx) — Rendering: prepend 📌 or ⚠️ per project
- [src/tui/App.tsx](src/tui/App.tsx) — Keyboard: Enter opens LaunchMenu, manage menu state, trigger config save on pin toggle
- [src/tui/HintBar.tsx](src/tui/HintBar.tsx) — Update hint text: "Enter menu" instead of "Enter open", add pin toggle hint
- [src/commands/config.ts](src/commands/config.ts) — Add cleanup-pins handler (reuse existing command structure)
- [src/cli.ts](src/cli.ts) — Register new pin command

**To create:**

- [src/core/pinning.ts](src/core/pinning.ts) — Utility functions: `isPinned()`, `togglePin()`, `deduplicatePins()`, `validatePinnedPaths()`
- [src/tui/LaunchMenu.tsx](src/tui/LaunchMenu.tsx) — New TUI component: unified menu for IDE selection and pin toggle
- [src/commands/pin.ts](src/commands/pin.ts) — New CLI subcommand: list, open, toggle handlers

**Tests to add/update:**

- [tests/config.test.ts](tests/config.test.ts) — Validate pinned field in schema
- [tests/scanner.test.ts](tests/scanner.test.ts) — Verify sort order (pinned first) and missing project placeholders
- [tests/tui/App.test.ts](tests/tui/App.test.ts) — Mock LaunchMenu interaction, config save on toggle
- [tests/tui/LaunchMenu.test.ts](tests/tui/LaunchMenu.test.ts) — Test LaunchMenu IDE selection, pin toggle, missing project handling
- [tests/fixtures/](tests/fixtures/) — Add .workonrc.json files with pinned arrays to test configs

---

## Verification

1. **Config schema validation** — `pnpm test` passes config.test.ts; GlobalConfig accepts/rejects pinned field correctly
2. **Scanner sort order** — scanner.test.ts confirms pinned projects appear first in output, within pinned group alphabetically
3. **TUI visual indicator** — Launch `pnpm tui` manually, verify 📌 appears next to pinned projects
4. **TUI Launch Menu** — Navigate to a project, press Enter, verify LaunchMenu appears with:
   - IDE options at top (default pre-selected)
   - Pin/Unpin option at bottom
   - Title bar shows project name only
5. **TUI Launch Menu IDE selection** — Press "1" to quick-select default IDE, verify project launches
6. **TUI Launch Menu pin toggle** — Navigate to Pin option (↓ arrow), press Enter, verify:
   - Config is saved
   - Menu closes
   - Project list re-renders with 📌 indicator
   - If unpinning, project moves to alphabetical position
7. **TUI sort after toggle** — Pin a project in TUI, verify it moves to top; unpin, verify it returns to alphabetical position
8. **TUI missing project handling** — Delete a pinned project directory, relaunch TUI, verify:
   - Placeholder with ⚠️ shown
   - Launch Menu opens on Enter
   - IDE options are disabled
   - Only "Unpin Project" option available
   - Unpinning removes entry from config
9. **CLI pin list** — `pnpm cli pin list` outputs all pinned projects (or "No pinned projects" if empty)
10. **CLI pin open** — `pnpm cli pin open <pinned-project-name>` launches the project
11. **CLI pin toggle** — `pnpm cli pin toggle <any-project>` toggles pin status, config is persisted
12. **CLI cleanup** — `pnpm cli config cleanup-pins` removes missing pinned entries
13. **Edge cases**:
    - Manually add duplicate paths to ~/.workonrc.json, verify deduplication on load
    - Run all tests: `pnpm test` (including new coverage for pinning logic)

---

## Decisions

- **Pinned storage**: Array of absolute paths in GlobalConfig (simple, atomic with rest of config)
- **Launch Menu**: Unified component combining IDE selection (with default pre-selected) and pin toggle
  - Replaces separate IDEDialog flow
  - Triggered by Enter key (no more direct launch)
  - Pin option always visible, context-sensitive ("Pin" vs "Unpin")
- **Menu structure**: IDE options at top, pin/unpin at bottom for efficient navigation
- **Title bar**: Project name only (cleaner display)
- **Missing projects**: Shown as placeholder rows with warning (transparent to user, allows unpin without search)
- **Pins outside scan roots**: Allowed (power user feature, not shown in TUI list but CLI-accessible)
- **Sort order**: Pinned projects first (globally), then alphabetical within each group
- **Fuzzy matching in CLI**: Use existing Fuse.js from search.ts, exact matches prioritized over fuzzy
- **Config persistence**: Trigger saveConfig() after each toggle in TUI (immediate feedback)
- **Keyboard shortcuts**: Number keys (1–3) for quick IDE selection, ↑↓ for menu navigation

---

## Further Considerations

1. **Quick IDE selection** — Number keys (1–3) provide fast IDE selection without navigating through menu. This reduces friction for power users.

2. **Visual distinction in narrow terminals** — 📌 emoji should work in most terminals, but fallback to `[*]` or `[P]` if needed. Document in README if terminal compatibility issues arise.

3. **Performance with many pinned projects** — Current design uses Set for O(1) lookup, so no concerns for typical use (<10k projects). If performance degrades, pin lookup can be further optimized by caching the pinned Set in a ref or app-level state.

4. **Alternative workflows** — Users can still use CLI commands (workon pin toggle, workon pin open) as quick shortcuts for pinning operations without opening the TUI.

---

This plan is structured so steps can proceed in phases (phases 1–2 are largely independent; phases 3–4 build on 1 but don't strictly depend on each other). You can implement the CLI first, then TUI, or vice versa. The test phase ensures all interactions are covered before merge.
