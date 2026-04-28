# Configurable Launch Commands — Functional Specification

**Status**: Feature Specification  
**Date**: 2026-04-28  
**Feature**: Configurable open commands in global `.workonrc.json`

---

## Overview

Replace hardcoded open command options (`"code"` and `"code-insiders"`) with user-configurable open commands defined in the global `.workonrc.json` configuration file. This allows users to open projects with any CLI command (e.g., `cursor`, `zed`, `vim`, custom scripts) instead of being limited to VS Code variants.

---

## Goals & Benefits

1. **Extensibility**: Support any editor or open command, not just VS Code
2. **User Control**: Let users define their preferred open tools globally
3. **Flexibility**: Allow different teams/workflows to standardize on different editors
4. **Future-Proof**: Enable adoption of emerging editors without code changes
5. **Simplicity**: Maintain intuitive project opening behavior while expanding options

---

## User Stories

### Story 1: Custom Editor Configuration

> As a developer, I want to configure multiple editors in `.workonrc.json` so that I can open any project with my preferred editor.

**Acceptance Criteria:**

- User can define an array of launch commands with names
- Launch menu displays all configured commands
- User can select any command to open a project
- Configuration persists across sessions

### Story 2: Team Standardization

> As a team lead, I want to share a `.workonrc.json` with launch commands so all team members can open projects with the same tools.

**Acceptance Criteria:**

- `.workonrc.json` can be checked into version control
- All projects use the team's configured launch commands
- Team defaults work without individual configuration

### Story 3: Quick Open Keyboard Shortcuts

> As a power user, I want to open projects using number keys (1, 2, 3, etc.) mapped to my configured commands.

**Acceptance Criteria:**

- Number keys still work as quick selection shortcuts
- Shortcut order matches the display order in the launch menu
- Behavior is consistent with current UX

---

## Scope

### In Scope

- Define open commands as an array in `.workonrc.json`
- Each open command has a `name` and `command` field
- Update `OpenMenu` component to display all configured commands
- Preserve number-key shortcuts (1–9) for quick selection
- Validate configuration with Zod schema
- Update `Project` type to store selected open command (not hardcoded IDE names)
- Maintain `defaultOpenCommand` in global config
- Ensure backward compatibility with existing projects

### Out of Scope

- Per-project open command overrides (reserved for future)
- Graphical editor for open commands
- Auto-detection of installed editors
- Custom command arguments per project type
- Open command aliases or variants

---

## Configuration Structure

### Global `.workonrc.json` Format

```json
{
  "roots": ["~/Projects", "~/Work"],
  "maxDepth": 3,
  "defaultOpenCommand": "code",
  "defaultProfile": "",
  "openCommands": [
    {
      "name": "Visual Studio Code",
      "command": "code"
    },
    {
      "name": "VS Code Insiders",
      "command": "code-insiders"
    },
    {
      "name": "Cursor",
      "command": "cursor"
    },
    {
      "name": "Zed",
      "command": "zed"
    }
  ],
  "ignore": ["**/node_modules/**", "**/dist/**"],
  "pinned": []
}
```

### Schema Specification

```typescript
interface OpenCommand {
  name: string; // Display name for the menu (e.g., "Visual Studio Code")
  command: string; // CLI command to execute (e.g., "code", "cursor")
}

interface GlobalConfig {
  roots: string[];
  maxDepth: number;
  defaultOpenCommand: string; // Name or command that serves as default
  defaultProfile: string;
  openCommands: OpenCommand[];
  ignore: string[];
  pinned: string[];
}
```

### Validation Rules

1. **`openCommands` array:**
   - Must be an array of objects
   - Must not be empty (minimum 1 command required)
   - Maximum 9 commands (UI constraint due to number key shortcuts)

2. **`OpenCommand.name`:**
   - Must be a non-empty string
   - Should be user-friendly and descriptive
   - No length limit, but recommend ≤ 30 characters

3. **`OpenCommand.command`:**
   - Must be a non-empty string
   - Should be a valid shell command name (alphanumeric + hyphens/underscores)
   - Recommended: match executable available in `$PATH`
   - No validation that command exists (user responsibility)

4. **`defaultOpenCommand`:**
   - Must match one of the `command` values in `openCommands`
   - Defaults to first command if not specified or invalid

5. **Uniqueness:**
   - `command` values must be unique (no duplicates)
   - `name` values should be unique but not enforced

---

## Data Model Changes

### Updated `Project` Type

**Before:**

```typescript
interface Project {
  name: string;
  path: string;
  type: ProjectType;
  ide: "code" | "code-insiders"; // Hardcoded enum
  profile: string;
  description: string;
  tags: string[];
  hasDevProject: boolean;
  missing?: boolean;
}
```

**After:**

```typescript
interface Project {
  name: string;
  path: string;
  type: ProjectType;
  openCommand: string; // Changed: now references open command string
  profile: string;
  description: string;
  tags: string[];
  hasDevProject: boolean;
  missing?: boolean;
}
```

**Rationale:** Replace hardcoded IDE type union with string reference to configured open command.

### Updated `launcher.ts`

**Current:**

```typescript
export async function openProject(project: Project, overrideIde?: string): Promise<void> {
  const ide = overrideIde ?? project.ide;
  const args = project.profile ? ["--profile", project.profile, project.path] : [project.path];
  await execa(ide, args, { detached: true, stdio: "ignore" });
}
```

**After:**

```typescript
export async function openProject(project: Project, overrideOpenCommand?: string): Promise<void> {
  const command = overrideOpenCommand ?? project.openCommand;
  const args = project.profile ? ["--profile", project.profile, project.path] : [project.path];
  await execa(command, args, { detached: true, stdio: "ignore" });
}
```

---

## UI/UX Changes

### Open Menu Component

**Current Behavior:**

- Displays exactly 2 IDE options: "Visual Studio Code" and "VS Code Insiders"
- Number keys 1–2 select IDEs
- Fixed layout

**New Behavior:**

- Displays all configured open commands from `openCommands` array
- Number keys 1–N select corresponding commands (N ≤ 9)
- Dynamic layout adapts to command count
- Menu shows full `name` field from configuration

**Open Menu Display Example:**

```
┌────────────────────────────────────────────────┐
│ Where do you want to open "my-project"?        │
├────────────────────────────────────────────────┤
│ ❯ Visual Studio Code                (1)        │
│   VS Code Insiders                  (2)        │
│   Cursor                            (3)        │
│   Zed                               (4)        │
├────────────────────────────────────────────────┤
│ Press P to toggle pin • ESC to cancel          │
└────────────────────────────────────────────────┘
```

### Keyboard Shortcuts

**Preserved:**

- Number keys 1–9: Quick selection of corresponding command
- Arrow up/down: Navigate menu items
- Enter: Confirm selection
- P: Toggle pin (still available)
- ESC: Cancel

**Behavior Update:**

- Key shortcuts always work, regardless of command count
- If user presses "3" but only 2 commands exist, nothing happens (already in code)

### Component Props Change

**`OpenMenu` component update:**

```typescript
interface OpenMenuProps {
  visible: boolean;
  projectName: string;
  currentOpenCommand: string; // Changed from currentIde
  openCommands: OpenCommand[]; // New: pass available commands
  isPinned: boolean;
  isMissing: boolean;
  onSelectOpenCommand: (command: string) => void; // Changed from onSelectIde
  onTogglePin: () => void;
  onCancel: () => void;
}
```

---

## Migration & Backward Compatibility

### Default Configuration

When `.workonrc.json` does not exist or lacks `openCommands`, provide sensible defaults:

```json
{
  "openCommands": [
    {
      "name": "Visual Studio Code",
      "command": "code"
    },
    {
      "name": "VS Code Insiders",
      "command": "code-insiders"
    }
  ],
  "defaultOpenCommand": "code"
}
```

**Rationale:** Maintains current behavior if users don't configure anything.

### Existing Project Metadata

Existing `.workonrc.json` files in projects may have:

```json
{
  "ide": "code"
}
```

**Migration Strategy:**

1. Accept both `ide` (legacy) and `openCommand` (new) fields during load
2. If `openCommand` missing but `ide` present, map `ide` value to `openCommand`
3. When saving, normalize to `openCommand` field
4. Deprecation period: Support legacy `ide` field for 2 releases, then remove

---

## Validation & Error Handling

### Config Load Errors

| Scenario                             | Behavior                   | User Feedback                                                                |
| ------------------------------------ | -------------------------- | ---------------------------------------------------------------------------- |
| `openCommands` array is empty        | Fail with error            | "Invalid `.workonrc.json`: `openCommands` must contain at least one command" |
| `defaultOpenCommand` not in commands | Use first command          | No error; silently correct                                                   |
| `openCommand.command` is empty       | Fail with validation error | "Open command cannot be empty string"                                        |
| More than 9 commands defined         | Fail with error            | "Maximum 9 open commands allowed (UI constraint)"                            |
| Duplicate `command` values           | Fail with validation error | "Duplicate open command: '{name}'"                                           |

### Launch Failure Handling

If user selects a launch command that doesn't exist in `$PATH`:

- `execa` will throw an error
- Current error handling applies (non-zero exit code)
- User sees command not found error

**No change needed:** Existing error handling is sufficient.

---

## Related Configuration Options

### `defaultOpenCommand` Field

**Current (v1):**

```json
"defaultIde": "code-insiders"  // Hardcoded to ["code", "code-insiders"]
```

**New (v2):**

```json
"defaultOpenCommand": "cursor"  // Matches a command string in openCommands
```

**Behavior:**

- When opening project via `workon open <name>` without specifying command, uses `defaultOpenCommand`
- If invalid or not found, falls back to first command in `openCommands`
- Pinned projects still use their stored `openCommand`, not the default

---

## Implementation Considerations

### Type Definitions

1. Create `OpenCommand` interface in `src/types.ts`
2. Update `Project` interface to use `openCommand: string`
3. Update `GlobalConfig` type in `src/core/config.ts`
4. Remove `AVAILABLE_IDES` constant; derive from config

### Files to Modify

| File                     | Change                                                                           |
| ------------------------ | -------------------------------------------------------------------------------- |
| `src/types.ts`           | Add `OpenCommand` interface; update `Project.ide` → `openCommand`                |
| `src/core/config.ts`     | Update `GlobalConfigSchema` with `openCommands` array; rename `defaultIde` field |
| `src/core/ides.ts`       | Remove `AVAILABLE_IDES` export; move to config lookup                            |
| `src/core/launcher.ts`   | Rename `overrideIde` → `overrideOpenCommand`                                     |
| `src/tui/OpenMenu.tsx`   | Accept `openCommands` prop; render dynamic menu                                  |
| `src/tui/App.tsx`        | Pass `openCommands` to `OpenMenu`                                                |
| `src/core/devproject.ts` | Handle `openCommand` field in project metadata                                   |
| `src/commands/*.ts`      | Update references where needed                                                   |
| `tests/*.test.ts`        | Update test fixtures and assertions                                              |

### Backward Compatibility Code

In `src/core/config.ts`:

```typescript
// Provide migration from old defaultIde to new defaultOpenCommand
if ("defaultIde" in raw) {
  // Map old defaultIde value to defaultOpenCommand
  raw.defaultOpenCommand = raw.defaultIde;
  delete raw.defaultIde;
}
```

---

## Testing Strategy

### Unit Tests

1. **Config validation:**
   - Load config with valid `openCommands`
   - Reject config with empty `openCommands`
   - Reject config with > 9 commands
   - Reject config with duplicate commands
   - Validate `defaultOpenCommand` correction

2. **Launcher:**
   - Verify `openProject` calls correct command
   - Verify profile arguments passed correctly
   - Verify override works with new command names

3. **Project loading:**
   - Map `openCommand` field correctly
   - Handle migration from `ide` → `openCommand`

### Integration Tests

1. **Open Menu:**
   - Display all commands from config
   - Number keys select correct commands
   - Navigation works with variable command count
   - Display names from `name` field shown correctly

2. **End-to-end:**
   - Load project → open with different commands
   - Change `defaultOpenCommand` → verify behavior

### Fixtures

Create test `.workonrc.json` files:

- `configs/multi-commands.json` — 4 commands
- `configs/single-command.json` — 1 command (minimum)
- `configs/max-commands.json` — 9 commands (maximum)
- `configs/invalid-duplicate-open-commands.json` — Should fail validation

---

## Edge Cases & Constraints

1. **Less than 2 commands:**
   - Allowed; menu shows only 1 option
   - Still display open menu for consistency
   - Number key "1" opens with that command

2. **More than 9 commands:**
   - Reject during config validation
   - Clear error message explaining UI constraint

3. **Command not in `$PATH`:**
   - No pre-flight check; let `execa` handle
   - User sees standard shell error
   - Suggestion: add `workon config validate` command later

4. **Special characters in command name:**
   - Allow any shell-safe string in `command` field
   - Validate command format is alphanumeric + hyphen/underscore

5. **Project with missing `openCommand`:**
   - Use `defaultOpenCommand` from global config
   - Or first available command if default invalid

---

## Future Extensions (Out of Scope)

1. Per-project `openCommand` override in `.workonrc.json`
2. Open command profiles (different args per project type)
3. Custom environment variables per open command
4. Command availability detection / auto-filtering
5. GUI for configuring open commands
6. `workon config validate` command
7. Open command aliases

---

## Documentation Updates Needed

1. **README.md:** Update global config example
2. **docs/workon.tech.md:** Update config schema section
3. **Add migration guide** for users upgrading from old config format
4. **Add examples** showing various launch command configurations

---

## Acceptance Criteria

- ✅ Users can define `openCommands` array in `.workonrc.json`
- ✅ Open menu displays all configured commands with user-friendly names
- ✅ Number keys 1–9 select corresponding commands
- ✅ `defaultOpenCommand` controls default selection
- ✅ At least 1, at most 9 commands allowed
- ✅ Backward compatible with existing configs (defaults to code + code-insiders)
- ✅ All tests passing
- ✅ No breaking changes to public API

---

## Success Metrics

1. **User Experience:** Open menu feels responsive with varying command counts
2. **Configuration:** Users can complete setup in < 5 minutes
3. **Compatibility:** No regressions in existing functionality
4. **Documentation:** Clear examples for common scenarios (Cursor, Zed, etc.)
