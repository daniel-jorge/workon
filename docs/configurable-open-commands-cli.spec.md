# F10 — Configurable Open Commands CLI Management

> **Feature ID**: F10  
> **Status**: Approved  
> **Related**: `docs/workon.tech.md` §F10

## Purpose & Goals

Configurable Open Commands CLI Management enables developers to add, remove, list, and set default open commands directly from the command line, without manually editing the `.workonrc.json` file. This provides a programmatic and user-friendly interface for managing the editor/tool ecosystem.

Goals:

- G1: Eliminate the need to manually edit `.workonrc.json` for managing open commands
- G2: Make it easy to add new editors or open commands interactively via CLI
- G3: Provide visibility into configured commands without opening config files
- G4: Allow automation/scripting to manage open commands (team setup scripts, CI/CD)

Out of scope (v1):

- Per-project open command management via CLI
- Validation that commands exist in `$PATH` (warn only, do not block)
- Interactive wizard mode or TUI-based editor
- Reordering open commands via CLI (use file editing)
- Custom command arguments or environment variables per command

---

## Functional Requirements

### FR1 — Add Open Command

The system must allow users to add a new open command to the global config via `workon config add-command`.

- **Trigger**: User runs `workon config add-command --name "<display-name>" --command "<executable>"`
- **Behavior**:
  - Adds a new object `{ "name": "<display-name>", "command": "<executable>" }` to the `openCommands` array
  - `--name` is the display name (e.g., "Visual Studio Code"), used for TUI menus
  - `--command` is the executable name (e.g., "code"), used to launch projects
  - If a command with the same display name already exists, the system rejects with an error
  - If an executable with the same value already exists, the system rejects with an error (no duplicate executables)
- **Output**: Success message: `"Added open command: <display-name> (<executable>)"` | Error with reason

### FR2 — Remove Open Command

The system must allow users to remove an open command by display name via `workon config remove-command`.

- **Trigger**: User runs `workon config remove-command --name "<display-name>"`
- **Behavior**:
  - Removes the command object with matching display name from `openCommands` array
  - If the removed command's executable matched `defaultOpenCommand`, auto-promote the default to the first remaining command's executable
  - If no commands remain after removal, set `defaultOpenCommand` to empty string (projects will fail at open time with clear error)
- **Output**: Success message: `"Removed open command: <display-name>"` | Error message if not found

### FR3 — List Open Commands

The system must display all configured open commands with consistent formatting via `workon config list-commands`.

- **Trigger**: User runs `workon config list-commands`
- **Behavior**:
  - Displays all commands in the `openCommands` array in a table format
  - Shows: Display Name | Executable | Is Default (Y/N)
  - Lists are ordered as they appear in the config file
  - Clearly marks which command is the current default with a visual indicator
- **Output**: Table format:
  ```
  Display Name              Executable    Default
  Visual Studio Code        code          Y
  VS Code Insiders          code-insiders N
  Cursor                    cursor        N
  ```

### FR4 — Set Default Open Command

The system must allow users to change the default open command via `workon config set-default-command`.

- **Trigger**: User runs `workon config set-default-command "<executable>"`
- **Behavior**:
  - Sets `defaultOpenCommand` to the specified executable name (e.g., "code", "cursor")
  - The executable must exist in the `openCommands` array (matching the "command" field of some entry)
  - If no command with that executable exists, the system rejects with an error message showing available executables
- **Output**: Success message: `"Set default open command to: <executable>"` | Error with list of available executables

### FR5 — Validation Warning on Add

When adding an open command, the system must warn the user if the executable does not appear to exist in the system.

- **Trigger**: `workon config add-command --name "<display-name>" --command "<executable>"` with an executable that may not exist
- **Behavior**:
  - Attempt to resolve the executable in `$PATH` using the `which` command (or OS equivalent)
  - If the executable is not found, display a warning but proceed with the add operation
  - If the executable is found, add silently with no warning
  - This is informational only; commands are not blocked if they don't exist
- **Output**:
  - Warning (non-fatal, if not found): `"Warning: executable '<executable>' not found in $PATH (but will be added anyway)"`
  - Followed by success message from FR1: `"Added open command: <display-name> (<executable>)"`

### FR6 — Persist to Global Config

All operations must persist changes to the global `.workonrc.json` file atomically.

- **Trigger**: Any add/remove/set-default operation completes successfully
- **Behavior**:
  - Entire global config is written to disk with changes applied
  - Write is atomic (file is not left in a corrupted state if interrupted)
  - File permissions and encoding are preserved
- **Output**: Changes visible on subsequent `list-commands` or when projects are opened

---

## User Experience Flow

### Flow A — Add a New Editor

1. User runs `workon config add-command --name "Zed" --command "zed"`
2. System checks if executable `"zed"` exists in `$PATH` (not found)
3. System displays warning: `"Warning: executable 'zed' not found in $PATH (but will be added anyway)"`
4. System adds the command and displays: `"Added open command: Zed (zed)"`
5. User can verify with `workon config list-commands` and see "Zed" in the list

### Flow B — Switch Default Editor

1. User has configured: Visual Studio Code (executable: "code"), Cursor (executable: "cursor"), Zed (executable: "zed")
2. User runs `workon config list-commands` and sees that "code" is marked as the default
3. User runs `workon config set-default-command "cursor"`
4. System responds: `"Set default open command to: cursor"`
5. Next time user opens a project without specifying an editor, it uses Cursor by default

### Flow C — Remove an Unused Editor

1. User has "Visual Studio Code" (code) as default and "VS Code Insiders" (code-insiders) configured
2. User runs `workon config remove-command --name "VS Code Insiders"`
3. System responds: `"Removed open command: VS Code Insiders"`
4. "VS Code Insiders" was not the default, so defaultOpenCommand remains "code"
5. If the default had been removed, system would auto-promote to the next available command

---

## Non-Functional Requirements

### NFR1 — Performance

- All config operations (add, remove, list, set-default) must complete within 500ms
- Config file I/O (read/write) must not block other workon commands

### NFR2 — Backward Compatibility

- Existing configurations with `openCommands` array continue to work unchanged
- Legacy `ide` field conversion (if present) is applied before add/remove operations
- Global config schema version remains compatible
- The existing `set-ide` command (if any) coexists with new commands; `set-ide` is deprecated but continues to work
- If `openCommands` field is missing from old configs, default to `[{ "name": "Visual Studio Code", "command": "code" }, { "name": "VS Code Insiders", "command": "code-insiders" }]`

### NFR3 — Data Integrity

- Write operations use atomic file writes: write to temporary file in same directory, then atomic rename to `.workonrc.json`
- If a write fails, the original config file remains untouched
- If write fails due to permission denied or disk full, user receives clear error: `"Error: Failed to save config: <reason>. Your config has NOT been changed."`
- Config is re-loaded from disk before each add/remove/set-default operation to ensure consistency with concurrent processes

### NFR4 — User Experience

- Error messages are clear and actionable (e.g., not just "error: command exists")
- Success messages confirm the action taken (e.g., show the new command details)
- The `--help` text for each subcommand is concise and includes examples

---

## Test Strategy

- **Unit tests**: FR1–FR4 logic (add/remove/list/set-default) using mock config files
- **Integration tests**: Full config file round-trip (read → modify → write → verify) for each operation
- **Edge case tests**: Duplicate detection, missing defaults, empty arrays
- **Manual tests**: Actual `workon config add-command` invocation to verify CLI output formatting

---

## Edge Cases & Error Handling

### EC1 — Duplicate Display Name

- **Scenario**: User attempts to add a command with a display name that already exists
- **Expected behavior**: Operation is rejected; original config unchanged
- **User feedback**: Error message: `"Error: A command with display name '<display-name>' already exists. Use 'remove-command' first to replace it."`

### EC2 — Duplicate Executable

- **Scenario**: User attempts to add a command with an executable that already exists (e.g., two commands with executable "code")
- **Expected behavior**: Operation is rejected; no duplicate executables allowed
- **User feedback**: Error message: `"Error: The executable '<executable>' is already configured under display name '<existing-display-name>'. Each executable must be unique."`

### EC3 — Remove Non-Existent Command

- **Scenario**: User attempts to remove a command with a display name that does not exist
- **Expected behavior**: Operation is rejected; config unchanged
- **User feedback**: Error message: `"Error: No command found with display name '<display-name>'. Available: [list of display names]"`

### EC4 — Set Default to Non-Existent Command

- **Scenario**: User attempts to set default to an executable that does not exist in `openCommands`
- **Expected behavior**: Operation is rejected; current default unchanged
- **User feedback**: Error message: `"Error: No executable '<executable>' found. Available: code, cursor, zed"`

### EC5 — Remove Default Command with Promotion

- **Scenario**: User removes a command that is currently set as the default
- **Expected behavior**: Command is removed; `defaultOpenCommand` is automatically promoted to the first remaining command's executable
- **User feedback**: Success message: `"Removed open command: <display-name>. Default promoted to: <new-default-executable>."`

### EC5b — Remove Last Command

- **Scenario**: User removes the last remaining command
- **Expected behavior**: Command is removed; `defaultOpenCommand` is set to empty string
- **User feedback**: Success message with warning: `"Removed open command: <display-name>. Warning: No commands remain in config. Projects will fail to open until at least one command is added."`

### EC6 — Config File Corruption / Permission Denied

- **Scenario**: Write operation fails (e.g., permission denied, disk full, corrupted JSON)
- **Expected behavior**: Operation fails; original config is preserved
- **User feedback**: Error message: `"Error: Failed to save config: <reason>. Your config has NOT been changed."`

### EC7 — Executable Not in $PATH (Warning, Not Blocking)

- **Scenario**: User adds `--command "my-custom-script"` that doesn't exist in `$PATH`
- **Expected behavior**: Executable is added anyway; warning is displayed
- **User feedback**: Warning message: `"Warning: executable 'my-custom-script' not found in $PATH (but will be added anyway)"`

---

## Acceptance Criteria

- [ ] AC1: `workon config add-command --name "Cursor" --command "cursor"` adds `{ "name": "Cursor", "command": "cursor" }` to `openCommands` array in `~/.workonrc.json`
- [ ] AC2: The new command is immediately visible in `workon config list-commands` output
- [ ] AC3: Attempting to add a duplicate display name (e.g., "Cursor" when "Cursor" exists) shows error and does not modify config
- [ ] AC4: Attempting to add a duplicate executable (e.g., "cursor" when "cursor" exists) shows error and does not modify config
- [ ] AC5: `workon config list-commands` displays table with columns: Display Name | Executable | Default (Y/N), with default marked "Y"
- [ ] AC6: `workon config remove-command --name "Cursor"` removes the command from config and deletes the matching entry from `openCommands` array
- [ ] AC7: If removed command's executable matched `defaultOpenCommand`, the default is auto-promoted to first remaining command's executable
- [ ] AC8: Attempting to remove a non-existent display name shows error "No command found with display name..."
- [ ] AC9: `workon config set-default-command "cursor"` (where "cursor" is an existing executable) updates `defaultOpenCommand` to "cursor" in config
- [ ] AC10: Attempting to set default to a non-existent executable shows error with list of available executables
- [ ] AC11: When adding an executable not in `$PATH`, a warning is displayed but the command is added successfully
- [ ] AC12: When adding an executable found in `$PATH`, no warning is displayed
- [ ] AC13: All changes are persisted to `~/.workonrc.json` and survive process restart (config survives after `workon` exits and restarts)
- [ ] AC14: Invalid input (e.g., `workon config add-command --name "Cursor"` without `--command`, or `workon config set-default-command` without argument) shows usage error with helpful examples
- [ ] AC15: All four commands (`add-command`, `remove-command`, `list-commands`, `set-default-command`) have `--help` text with at least one usage example each

---

## Open Questions / Decisions

**None** — all decisions have been made based on user requirements clarification.
