# F9 — Pinned Projects — Detailed Functional Specification

## Overview

A pinned projects feature that allows developers to pin frequently-used projects for quick access, with auto-sorting in the TUI and dedicated CLI commands to view and open pinned projects.

---

## Purpose & Goals

1. **Quick Access** — Developers can prioritize frequently-used projects and access them at the top of the project list without searching
2. **Persistent Pins** — Pinned status is stored globally in `~/.workonrc.json` and survives across sessions
3. **Streamlined Navigation** — Reduce friction to open commonly-used projects through both TUI and CLI interfaces
4. **Visual Clarity** — Clearly distinguish pinned projects from regular projects in listings and searches

---

## Functional Requirements

### FR1 — Pin Status Storage

- Pinned project paths are stored in the global config (`~/.workonrc.json`) as a top-level `pinned` array
- Each entry in the `pinned` array is the absolute path to the project root
- Default value for `pinned` is an empty array `[]`
- Pinned paths are validated at load time; invalid or missing paths trigger a warning
- Schema update: `GlobalConfigSchema` extends to include `pinned: z.array(z.string()).default([])`

### FR2 — TUI Interaction (Launch Menu & Pin Toggle)

- Projects in `ProjectList.tsx` display a visual indicator (📌) if pinned
- Pressing **Enter** on a selected project opens a unified **Launch Menu** with:
  - **IDE Selection** — Lists available IDEs (e.g., VS Code, VS Code Insiders)
    - Default IDE for the project is pre-selected and highlighted
    - Keyboard shortcuts: `1`, `2`, `3`, etc. for quick IDE selection
  - **Pin/Unpin Option** — Single action at bottom:
    - Shows "Pin Project" if not currently pinned
    - Shows "Unpin Project" if currently pinned
  - Title bar displays project name only
- Menu Navigation:
  - `↑↓` — Navigate between options
  - `1–3` — Quick-select an IDE
  - `Return` — Execute selected action (launch with IDE or toggle pin)
  - `Esc` — Cancel and return to project list
- Executing an action immediately:
  - Updates the in-memory project state
  - Writes the updated `pinned` array to `~/.workonrc.json` (if toggling pin)
  - Launches the project with selected IDE (if selecting IDE)
  - Updates the TUI display to reflect new pin status (if toggling pin)
- No disruption to current project list position or search state after toggling pin

### FR3 — TUI Auto-Sort & Display

- When displaying the project list, pinned projects appear first, before unpinned projects
- Within the pinned group, projects are ordered by scan result order (same as unpinned projects)
- Within the unpinned group, projects are ordered by scan result order
- Pinned projects remain sorted first even when search filter is active
- Pinned projects are visually marked with a clear indicator (📌, ✓, or similar) in the list
- Pinned count and regular project count can be displayed in the status/hint bar

### FR4 — CLI Subcommand: `workon pin`

#### `workon pin list`

- Lists all pinned projects in order (as they appear in global config)
- Displays: `[📌] Project Name — /path/to/project`
- If no pinned projects exist, show: "No pinned projects. Add one with: workon pin toggle <project-name>"
- Exit code: 0

#### `workon pin open <project-name>`

- Opens the first pinned project matching `<project-name>` (fuzzy match or exact match)
- Uses the same IDE launcher and profile logic as `workon open`
- If project not found in pinned projects: show error "Project '<project-name>' not found in pinned projects. Run 'workon pin list' to see available pinned projects."
- Exit code: 0 on success, 1 on error

#### `workon pin toggle <project-name>`

- Toggles pin status of the project matching `<project-name>` (fuzzy match or exact match)
- If project is not in any scan root, show error: "Project '<project-name>' not found."
- If toggling to pinned (adding), show: "✓ Pinned <project-name>"
- If toggling to unpinned (removing), show: "✓ Unpinned <project-name>"
- Exit code: 0 on success, 1 on error
- Persists the change to `~/.workonrc.json`

### FR5 — Edge Case: Deleted or Moved Projects

- During project scan, check each pinned path for existence
- If a pinned path no longer exists (directory deleted or moved):
  - Display a warning in the TUI: "⚠ Pinned project path not found: /path/to/deleted/project"
  - Include "Unpin Project" option in the Launch Menu for that entry
  - Do NOT automatically remove the entry; let the user decide
  - User can press Enter on missing pinned project to open Launch Menu and unpin it
- In CLI, if a pinned path is missing, warn during scan: "⚠ Pinned project not found: /path/to/deleted/project"
- Provide a `workon config cleanup-pins` command to remove all missing pinned entries at once

### FR6 — Integration with Existing Features

- Pinned status does not affect project type detection or IDE selection
- Pinned projects work with search/filter (pinned projects appear first in filtered results)
- Pinned projects work across all project types (nodejs, rust, python, go, java, dotnet, generic)
- Pinned status can be set for projects with or without `.workonrc.json`

---

## Non-Functional Requirements

### Performance

- Pin lookup (checking if a project is pinned) must be O(1) or O(log n) for responsiveness in TUI
- Writing pinned projects to config must not block the TUI for >100ms
- Scanning and sorting pinned projects should add <50ms to overall scan time for typical use (< 1000 projects)

### Accessibility

- Launch Menu triggered by Enter is discoverable in hint bar
- Pin toggle is easily accessible without leaving the Launch Menu (↓ arrow + Enter)
- Quick-select IDE shortcuts (1–3) are intuitive and visible in menu
- Pin indicator (📌) must be distinguishable in both light and dark terminal themes
- Launch Menu navigation is intuitive: arrow keys to navigate, number keys for quick IDE selection

### Compatibility

- Node 18+
- Works cross-platform (macOS, Linux, Windows)
- Terminal width handling: favorite indicator should not break layout on narrow terminals

### Data Integrity

- Pinned array must validate on every read from `~/.workonrc.json`
- Invalid entries (non-strings, non-existent paths) are skipped with a warning, not lost
- Config writes are atomic (no partial writes on failure)

---

## User Experience Flow

### Workflow 1: Pin a Project in TUI

```
1. User runs: workon (launches TUI)
2. TUI displays project list: "my-app", "legacy-service", "tooling-repo", etc.
3. User navigates with arrow keys to "my-app"
4. User presses Enter to open the Launch Menu
5. Menu appears:
   ┌─────────────────────────────────────┐
   │ my-app                              │
   ├─────────────────────────────────────┤
   │ ▸ [1] Visual Studio Code            │
   │   [2] VS Code Insiders              │
   │   [3] Pin Project ✓                 │
   ├─────────────────────────────────────┤
   │ ↑↓: Navigate | 1-3: Select | ENTER: Confirm | ESC: Cancel
   └─────────────────────────────────────┘
6. User navigates down to "Pin Project" option and presses Enter
7. "my-app" is added to ~/.workonrc.json pinned array
8. Menu closes and TUI updates to show 📌 before "my-app"
9. User continues browsing (pinned projects remain sorted at top)
10. User can now quickly access "my-app" since it appears first in the list
```

### Workflow 2: Open a Project Using Launch Menu IDE Selection

```
1. User runs: workon (launches TUI)
2. User navigates to "my-app" and presses Enter
3. Launch Menu appears with default IDE (VS Code) pre-selected
4. User presses Enter to confirm and launch with default IDE
5. "my-app" opens in VS Code and terminal exits

Alternatively:
3. Launch Menu appears
4. User presses "2" to quick-select VS Code Insiders
5. "my-app" opens in VS Code Insiders and terminal exits
```

### Workflow 3: Open a Pinned Project from CLI

```
1. User runs: workon pin open my-app
2. CLI finds "my-app" in the pinned projects list
3. CLI launches "my-app" using the configured IDE (code or code-insiders)
4. Terminal exits with code 0
```

### Workflow 4: View and Unpin a Project

```
1. User runs: workon pin list
2. Terminal shows:
   [📌] my-app — /Users/user/projects/my-app
   [📌] legacy-service — /Users/user/projects/legacy
3. User runs: workon pin toggle legacy-service
4. "legacy-service" is removed from pinned projects
5. Terminal shows: "✓ Unpinned legacy-service"
```

### Workflow 5: Handle Deleted Pinned Project

```
1. User deletes ~/projects/my-app directory
2. User runs: workon (launches TUI)
3. TUI displays projects, but shows warning: "⚠ Pinned project not found: /Users/user/projects/my-app"
4. User navigates to the warning entry and presses Enter to open Launch Menu
5. Menu shows IDE options (disabled) and "Unpin Project" option
6. User presses ↓ to navigate to "Unpin Project" and presses Enter
7. Project is removed from pinned projects and TUI updates
```

---

## Edge Cases & Error Handling

### Edge Case 1: Pinned Path No Longer Exists

**Scenario:** User pinned a project, then deleted the project directory.

**Expected Behavior:**

- TUI scan shows a placeholder/warning entry for the missing project
- Display: "⚠ /Users/user/projects/deleted-project (not found)"
- Launch Menu can be opened (Enter) to unpin it
- CLI `workon pin list` shows it but notes "(path not found)"
- CLI `workon config cleanup-pins` removes all missing entries

### Edge Case 2: Duplicate Project Paths in Pinned Array

**Scenario:** Config is manually edited and contains duplicate paths in pinned array.

**Expected Behavior:**

- On load, deduplicate the pinned array
- Log a warning: "Duplicate pinned projects detected and removed"
- Write the cleaned array back to config

### Edge Case 3: Invalid Paths in Pinned Array

**Scenario:** A non-string or malformed path is in the pinned array.

**Expected Behavior:**

- Skip invalid entries during validation
- Log warning: "Invalid pinned entry (not a string): [object]"
- Valid entries are loaded normally
- Invalid entries are preserved in the config (user must fix manually or use cleanup command)

### Edge Case 4: Pin a Project That Isn't in Scan Results

**Scenario:** User runs `workon pin toggle /path/to/project` but that path is outside all configured scan roots.

**Expected Behavior:**

- Add it to pinned projects anyway (allows power users to pin arbitrary paths)
- TUI will not display it unless that path is within a scan root
- CLI `workon pin open` will still work
- Log warning: "Pinned path is outside configured scan roots"

### Edge Case 5: Project Name Ambiguity in CLI

**Scenario:** User has two pinned projects: "app" and "app-legacy", and runs `workon pin open app`.

**Expected Behavior:**

- Match the exact name first (exact > fuzzy)
- If exact match found, use it
- If no exact match, use fuzzy match (Fuse.js, same logic as regular search)
- If multiple fuzzy matches with the same score, prompt user to disambiguate or use full path

### Edge Case 6: Context Menu Visibility on Small Terminals

**Scenario:** Terminal is <40 characters wide.

**Expected Behavior:**

- Context menu collapses to abbreviated labels or single-character shortcuts
- Pin indicator (📌) remains visible or adapts to fit
- No layout breakage

---

## Related

- [Architecture](workon.tech.md) — System design and integration points
- [Project Plan](workon.plan.md) — Timeline and dependencies
- [Core Config Schema](../src/core/config.ts) — Global config implementation
- [TUI Components](../src/tui/) — Ink components for display and interaction
- [CLI Favorites Command](../src/commands/pin.ts) — Pin subcommand implementation
