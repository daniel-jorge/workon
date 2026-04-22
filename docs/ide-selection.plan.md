# Plan: IDE Selection Feature Implementation

## TL;DR

Implement a modal IDE selection dialog triggered by SHIFT+ENTER in the TUI. When selected, the chosen IDE (from `code` or `code-insiders`) is passed to the launcher, overriding the project's configured default. The dialog is a new React component (IDEDialog.tsx) that overlays the project list, manages its own keyboard input, and returns to the TUI when dismissed.

---

## Steps

### Phase 1: Setup & Infrastructure (can run in parallel)

1. **Create IDE constants module**
   - Extract hardcoded IDE enum values to a shared constant
   - File: Create `src/core/ides.ts`
   - Export: `const AVAILABLE_IDES = ["code", "code-insiders"] as const`
   - Why: Single source of truth for IDE list, simplifies future IDE additions

2. **Modify launcher to accept IDE override**
   - File: `src/core/launcher.ts`
   - Change signature: `openProject(project: Project, overrideIde?: string): void`
   - Use `overrideIde ?? project.ide` to select IDE
   - Why: Allows passing a user-selected IDE without modifying the project object

3. **Create IDEDialog component**
   - File: Create `src/tui/IDEDialog.tsx`
   - Props: `{ projectName: string; ides: string[]; currentIde: string; onSelect: (ide: string) => void; onCancel: () => void }`
   - Internal state: `selectedIndex` (tracks which IDE is highlighted)
   - Render: Dialog title shows "Select IDE for {projectName}", vertically stacked IDE options with ▸ marker for selected item
   - Keyboard handling: Up/Down arrows change selection, ENTER confirms, ESC cancels
   - Styling: Modal box with border, dimmed background awareness
   - _depends on step 1_

### Phase 2: Integrate Dialog into TUI

4. **Add dialog state to App component**
   - File: `src/tui/App.tsx`
   - Add state: `const [showIDEDialog, setShowIDEDialog] = useState(false)`
   - Add state: `const [selectedDialogIde, setSelectedDialogIde] = useState(projects[selectedIndex]?.ide || config.defaultIde)`
   - Why: Controls dialog visibility and tracks the IDE selected in the dialog

5. **Detect SHIFT+ENTER in keyboard input**
   - File: `src/tui/App.tsx`
   - Location: In the `useInput` callback (currently ~line 31-45)
   - Add condition: `else if (key.return && key.shift && selectedIndex >= 0) { setShowIDEDialog(true) }`
   - Why: Distinguishes between normal ENTER (open project) and SHIFT+ENTER (show dialog)

6. **Render dialog with modal pattern**
   - File: `src/tui/App.tsx`
   - Conditional render: `{showIDEDialog && <IDEDialog ... />}`
   - Dialog receives:
     - `projectName={projects[selectedIndex]?.name}`
     - `ides={AVAILABLE_IDES}`
     - `currentIde={selectedDialogIde}`
     - `onSelect={(ide) => { setSelectedDialogIde(ide); openProject(projects[selectedIndex], ide); setShowIDEDialog(false); }}`
     - `onCancel={() => setShowIDEDialog(false)}`
   - Why: Dialog appears over the TUI without removing the background
   - _depends on steps 3 & 4_

### Phase 3: Styling & UX Polish

7. **Implement modal overlay styling**
   - File: `src/tui/IDEDialog.tsx`
   - Use Ink `Box` with `borderStyle="round"` and `borderColor="blue"`
   - Center the dialog: `position="absolute"` with calculated offsets (or Ink flex center pattern)
   - Add padding and margin for visual separation
   - Render title: "Select IDE for {projectName}"
   - Render hint text at bottom: "ENTER: Select | ESC: Cancel"
   - _depends on step 3_

8. **Add visual selection indicator**
   - File: `src/tui/IDEDialog.tsx`
   - Selected IDE: prefix with "▸ " and `bold={true}` + `color="blue"`
   - Unselected IDEs: normal text
   - Mirror pattern from `src/tui/ProjectList.tsx` lines 34-36

---

## Relevant Files

- `src/core/launcher.ts` — Modify `openProject()` to accept optional IDE override parameter
- `src/tui/App.tsx` — Add dialog state, detect SHIFT+ENTER, render dialog conditionally
- `src/types.ts` — No changes required (IDE types already exist)
- `src/core/config.ts` — No changes required (IDE config already structured)
- Create `src/core/ides.ts` — New constant file for AVAILABLE_IDES
- Create `src/tui/IDEDialog.tsx` — New modal dialog component
- `src/tui/ProjectList.tsx` — Reference for selection styling pattern

---

## Verification

1. **IDE dialog renders**
   - Run `workon` in interactive TUI
   - Highlight a project
   - Press SHIFT+ENTER
   - Verify: Dialog appears with centered modal box containing project name and IDE options

2. **Pre-selection is correct**
   - Verify: Dialog title displays the correct project name
   - Verify: The project's configured IDE (or global default) has the ▸ marker
   - Test with different projects (some with custom IDE config, some using global default)

3. **Navigation works**
   - Press Up/Down arrows while dialog is open
   - Verify: Project name remains correct in dialog title
   - Verify: Selection marker moves between IDE options
   - Verify: Parent TUI does not scroll (input is consumed by dialog)

4. **Confirmation opens project**
   - Dialog shows `code` selected
   - Press ENTER
   - Verify: Project opens with `code` (check by looking for VS Code window or error if not installed)
   - Verify: Terminal returns to shell (or TUI if launcher fails gracefully)

5. **Selection override works**
   - Navigate to `code-insiders` in dialog
   - Press ENTER
   - Verify: Project opens with `code-insiders`, not the project's default IDE
   - Verify: Project configuration is NOT modified (next open still uses original IDE)

6. **Cancel returns to TUI**
   - Open dialog with SHIFT+ENTER
   - Press ESC
   - Verify: Dialog disappears
   - Verify: Project is still highlighted (no action taken)
   - Verify: Pressing ENTER now opens with default IDE (not the one selected in dialog)

7. **Repeated SHIFT+ENTER cycles through**
   - Press SHIFT+ENTER multiple times without selecting
   - Navigate dialog selection each time
   - Verify: Each press resets to pre-selected IDE (not remembering previous selection)
   - Verify: ESC after navigation shows correct selection on next SHIFT+ENTER

8. **Edge case: no selection in list**
   - Search to filter all projects out
   - Press SHIFT+ENTER
   - Verify: Nothing happens (no error, no dialog)

---

## Decisions

- **IDE detection**: NOT implemented. Dialog always shows both IDEs. If IDE is unavailable, launcher fails with error (existing behavior).
- **Dialog component isolation**: IDEDialog is a pure component that receives callbacks; state is managed in App.tsx. Keeps separation of concerns.
- **IDE constants**: Extracted to `src/core/ides.ts` to avoid hardcoding and enable future extensibility.
- **State reset on cancel**: Dialog pre-selection resets to project's IDE on each open (not remembered between dialog sessions). Aligns with "no configuration modified" requirement.
- **No keyboard filtering changes**: Dialog consumes all input (Up/Down/Enter/ESC); parent TUI's `useInput` remains unchanged. Dialog is rendered as overlay.

---

## Further Considerations

1. **Modal overlay appearance**: The spec mentions "dimmed overlay" but terminal dimming is complex in Ink. Current plan is to render dialog as a centered box with border. Is this acceptable, or should we explore terminal-specific dimming libraries?
2. **Keyboard input consumption**: When the dialog is open, should we prevent the parent TUI's `useInput` from firing? Current Ink behavior may fire both dialog and parent handlers. Should we add a guard in App's `useInput` to check `if (showIDEDialog) return` first?

3. **Testing coverage**: Should we add unit tests for:
   - IDEDialog component (keyboard navigation, selection state)?
   - Launcher modification (IDE override parameter)?
   - App integration (SHIFT+ENTER detection, dialog state transitions)?
