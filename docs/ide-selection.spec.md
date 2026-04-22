# IDE Selection Feature — Functional Specification

## Purpose

Allow users to override the default IDE configuration and select a different IDE at the moment of opening a project from the interactive TUI. This feature provides flexibility when a project has a different IDE preference than the user's default, without requiring configuration changes.

---

## Overview

When a project is selected in the TUI, the user can press **SHIFT+ENTER** instead of just **ENTER** to open an IDE selection dialog. This dialog displays all configured IDEs available on the system, allows the user to navigate and select one, and then opens the project with the selected IDE.

---

## Feature Details

### F9 — IDE Selection Dialog

#### Trigger

- User has a project highlighted in the TUI list
- User presses **SHIFT+ENTER**

#### Dialog Behavior

- A modal dialog appears overlaid on the project list
- Dialog displays the project name in the title
- Dialog displays a vertically-stacked list of available IDEs
- Each IDE option is clearly labeled with its name and binary identifier
- One IDE is pre-selected (the project's configured IDE or the global default)
- The dialog remains focused until the user makes a selection or cancels

#### Available IDEs

- **Visual Studio Code** (`code`)
- **Visual Studio Code Insiders** (`code-insiders`)

#### Dialog Content

```
┌────────────────────────────────────┐
│ Select IDE for my-awesome-project  │
├────────────────────────────────────┤
│                                    │
│ ▸ Visual Studio Code (code)        │  ← pre-selected
│   Visual Studio Code Insiders      │
│                                    │
├────────────────────────────────────┤
│ ENTER: Select | ESC: Cancel        │
└────────────────────────────────────┘
```

#### Navigation

- **Up Arrow** / **Down Arrow**: Move selection between IDEs
- **ENTER**: Confirm selection and open the project with the selected IDE
- **ESC**: Cancel the dialog and return to the TUI without opening any project

#### Return to TUI

- After opening the project (ENTER), the terminal returns to the shell
- If canceled (ESC), the TUI remains open with the same project highlighted

---

## User Flow

### IDE Selection Workflow

1. User runs `workon` and the TUI displays the project list
2. User searches/navigates to the desired project
3. User presses **SHIFT+ENTER** instead of **ENTER**
4. IDE selection dialog appears with the list of available IDEs
5. Pre-selected IDE is the project's configured IDE (or global default if not specified)
6. User navigates with arrow keys to select a different IDE (if desired)
7. User presses **ENTER** to confirm
8. Project opens with the selected IDE
9. Terminal returns to the shell

### Example: Override Default IDE

**Scenario:** A project is configured to open with `code` (VS Code stable), but the user wants to test it with `code-insiders` for a specific session.

1. Project is highlighted in TUI
2. User presses **SHIFT+ENTER**
3. Dialog shows two options:
   - `code` (selected by default)
   - `code-insiders` (not selected)
4. User presses Down Arrow to move to `code-insiders`
5. User presses ENTER
6. Project opens in VS Code Insiders
7. No configuration is changed; the next time the project is opened with plain **ENTER**, it still uses `code`

---

## UI/UX Requirements

### Dialog Design

- Dialog is visually distinct from the TUI background (consider dimmed overlay)
- Dialog is centered on the screen
- Dialog has clear borders/edges
- Minimum width of 40 characters
- Clear instruction text at the bottom: "ENTER: Select | ESC: Cancel"

### Selected vs Unselected Items

- Selected IDE is visually highlighted (e.g., with a cursor or background color)
- Selected item may be prefixed with a marker (e.g., `▸ ` or `→ `)
- Unselected items are shown without highlight or marker

### Keyboard Hints

- Hints are displayed at the bottom of the dialog
- Hints show: `ENTER: Select | ESC: Cancel`
- Hint bar uses the same styling as the main TUI hint bar

---

## Technical Considerations

### Available IDEs Detection

- Before showing the dialog, the system does NOT need to verify IDE availability
- The dialog shows all supported IDEs (`code` and `code-insiders`)
- If a selected IDE is not available on the system, the launcher will fail gracefully with an error message (handled by existing launcher code)

### Keyboard Input Handling

- **SHIFT+ENTER** is captured by the TUI and triggers the dialog instead of opening with the default IDE
- The dialog intercepts keyboard input and prevents it from reaching the TUI behind it
- Arrow keys and ENTER/ESC are the only keys processed by the dialog

### State Management

- The dialog is a temporary modal overlay; it does not modify any application state until the user presses ENTER
- The selected IDE is passed directly to the launcher; no configuration is modified
- The TUI remains unchanged after canceling the dialog

---

## Dialog Interaction State Machine

```
[TUI Project Selected]
         ↓
   User presses SHIFT+ENTER
         ↓
   [IDE Selection Dialog Open] ← Initial: Project's IDE is pre-selected
         ↓
   ┌─────┴──────┬────────────────┐
   ↓            ↓                ↓
User presses   User presses    User presses
Up/Down Arrow   ESC             ENTER
   ↓            ↓                ↓
[Move Selection] → [Dialog Closes] [Launch Project]
   ↓                             ↓
   └─────────────────→ [Return to Shell]
                      (or TUI if ESC)
```

---

## Configuration & Defaults

### Pre-selection Logic

The dialog pre-selects an IDE in this order of priority:

1. The project's configured IDE (from `.workonrc.json` or inherited from global config)
2. The first IDE in the list (i.e., `code`)

### Global Configuration Impact

- No new configuration options are added to `~/.workonrc.json`
- The global `defaultIde` setting is not modified by this feature
- Per-project IDE settings in `.workonrc.json` are also not modified

---

## Constraints & Edge Cases

### Constraints

- Only two IDEs are available for selection: `code` and `code-insiders`
- The feature is only available in the interactive TUI (not in direct project open mode like `workon open projectname`)
- SHIFT+ENTER only works when a project is selected (not while searching)

### Edge Cases

#### No Project Selected

- If the user presses SHIFT+ENTER with no project highlighted, nothing happens (same behavior as pressing ENTER without a selection)

#### Single Project in List

- If only one project matches the search, it is auto-selected and SHIFT+ENTER can be used immediately

#### Rapid IDE Changes

- If a user opens the same project multiple times with different IDEs in quick succession, each instance opens independently (no conflicts)

#### Launcher Unavailable

- If the selected IDE is not found on the system:
  - The launcher attempts to execute the IDE command
  - If the command fails, the error is displayed to the user
  - The terminal returns to the shell with an error message
  - No partial state is left behind

---

## Acceptance Criteria

- [ ] SHIFT+ENTER opens the IDE selection dialog when a project is highlighted
- [ ] Dialog displays both available IDEs: `code` and `code-insiders`
- [ ] The project's configured IDE is pre-selected in the dialog
- [ ] Up/Down arrow keys navigate between IDE options
- [ ] The selected IDE is visually highlighted
- [ ] ENTER key confirms the selection and opens the project with that IDE
- [ ] ESC key closes the dialog and returns to the TUI
- [ ] Project opens with the selected IDE (not the default/configured IDE)
- [ ] No configuration files are modified when selecting a different IDE
- [ ] Dialog displays clear keyboard hints: "ENTER: Select | ESC: Cancel"
- [ ] Dialog is visually distinct and centered on the screen
- [ ] Repeated SHIFT+ENTER presses (before opening project) cycle through IDE selections

---

## Future Extensibility

### Potential Enhancements

- Support for additional IDEs (e.g., JetBrains IDEs, Vim, etc.) via plugin/extension mechanism
- IDE availability detection before showing dialog (grey out unavailable IDEs)
- "Set as default for this project" option in the dialog
- IDE-specific command-line arguments or profiles
- Recent IDE selection memory per project

---

## Dependencies

- Existing launcher infrastructure to open projects with a specified IDE
- Existing TUI keyboard event handling system
- Existing project configuration system

---

## Related Features

- **F4 — Interactive TUI**: The IDE selection dialog is triggered from and returns to the TUI
- **F2 — Per-Project Configuration**: Pre-selected IDE comes from project configuration
- **F3 — Global Configuration**: Default IDE setting influences pre-selection
