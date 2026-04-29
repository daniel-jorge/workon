# Plan: Keep TUI Running After Project Open

## TL;DR

Remove the `process.exit(0)` call that terminates the TUI after opening a project. Instead, close the OpenMenu and return to project selection, allowing users to open multiple projects in one session. The Escape key at the main menu remains the way to quit.

## Steps

### Phase 1: Modify Exit Logic (2 changes)

1. **Remove process.exit in App.tsx** — In the `onSelectOpenCommand` callback (App.tsx lines 130-133), remove the `process.exit(0)` call after `await openProject(project, command)` completes. Instead, set `showOpenMenu = false` to close the menu and return to project selection.

2. **Optional: Add brief visual feedback** — Consider adding a state flag (e.g., `lastOpenSuccess`) to display a brief success message (e.g., "Opening {projectName}...") before closing the OpenMenu. This can be a future enhancement; the core change is just removing the exit and resetting `showOpenMenu`.

### Phase 2: Testing (3 verification steps)

1. **Manual test — Open single project**: Start TUI, search for a project, press Enter, select an IDE, verify TUI remains open and returns to project list. Verify the IDE still launches.

2. **Manual test — Open multiple projects**: Open one project, verify TUI stays open, open a second project, verify both IDEs launch and TUI remains responsive.

3. **Verify exit still works**: Ensure Escape at the main menu (empty search) still exits the TUI cleanly.

## Relevant Files

- `src/tui/App.tsx` — Main TUI component; currently calls `process.exit(0)` in the `onSelectOpenCommand` callback

## Verification

1. Start TUI: `pnpm build && node dist/cli.js tui`
2. Search for a project and open it via the OpenMenu (press Enter, select IDE with 1-9 or Enter)
3. Confirm: IDE launches in background, TUI remains running and shows project list again
4. Repeat opening another project to verify state resets correctly
5. Press Escape at main menu to confirm exit still works

## Decisions

- **Keep current exit behavior**: Escape at main menu is the only way to exit; no new "Exit" menu option needed
- **No confirmation message required**: Just silently close the menu and return to selection (can add visual feedback later if desired)
- **Preserve IDE launching**: The `detached: true` process spawning in launcher.ts requires no changes

## Further Considerations

None — the change is straightforward and low-risk since removing `process.exit(0)` and resetting UI state don't affect the IDE launch logic.
