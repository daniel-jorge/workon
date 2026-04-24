# Plan: Implement Scanner Spinner (F9)

## TL;DR

Refactor the TUI command to move the scanner inside the App component, enabling an intermediate "loading" state. The App will display an animated spinner (braille characters) while scanning, then seamlessly transition to the project list once results arrive. User can press Escape during the scan to exit cleanly. Error handling is deferred.

**Architecture shift**: App(config) + useEffect → triggers scan internally, rather than App(projects) with pre-scanned results.

---

## Steps

### Phase 1: Create Spinner Component

1. Create new file `src/tui/Spinner.tsx` — React/Ink component that:
   - Accepts optional `status` text prop (e.g., "Scanning for projects…")
   - Animates braille spinner frames: `⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏`
   - Uses `setInterval` or Ink's render loop to cycle through frames every 100 ms (10 FPS)
   - Centers spinner + status text horizontally on screen
   - Respects `NO_COLOR` env var and degrades to `[…]` if set
   - Returns clean JSX (Box + Text from Ink)

### Phase 2: Refactor App.tsx to Add Loading State

2. Modify `src/tui/App.tsx`:
   - Add `config: GlobalConfig` as a prop (currently only receives `projects`)
   - Add state: `const [isLoading, setIsLoading] = useState(true)`
   - Add state: `const [projects, setProjects] = useState<Project[]>([])`
   - Add `useEffect` hook that:
     - Runs once on component mount (dependency: [config])
     - Calls `scanProjects(config)`
     - Sets `setProjects(results)` when complete
     - Sets `setIsLoading(false)`
   - Add conditional render:
     - If `isLoading` → render `<Spinner status="Scanning for projects…" />`
     - Else → render existing UI (`<SearchBar>`, `<ProjectList>`, etc.)
   - Add `useInput` handler to detect Escape key during loading phase:
     - On Escape during loading → call `process.exit(0)` to cleanly exit

3. Import `scanProjects` from `@/core/scanner.js` in App.tsx

### Phase 3: Update TUI Command Entry Point

4. Modify `src/commands/tui.ts`:
   - Remove the `const projects = await scanProjects(config)` blocking call
   - Pass `config` to App component instead: `<App config={config} .../>`
   - Keep render setup and event handling unchanged

### Phase 4: Update Type Definitions (if needed)

5. Verify `src/tui/App.tsx` prop interface matches new signature:
   - Props should now include `config: GlobalConfig`
   - Update JSDoc or TypeScript interface if one exists
   - Remove `projects: Project[]` prop (now managed internally)

### Phase 5: Testing

6. Create test file `tests/tui/Spinner.test.ts`:
   - Test spinner frame cycle (does it animate through all 10 frames?)
   - Test `NO_COLOR` fallback behavior
   - Test status text is rendered

7. Update or create `tests/tui/App.test.ts`:
   - Mock `scanProjects` to return results after a delay
   - Verify spinner is rendered while loading
   - Verify project list appears once loading is false
   - Verify Escape key during loading exits cleanly

### Phase 6: Verification & Polish

8. Manual testing:
   - Run `pnpm build` to ensure no TypeScript errors
   - Run `pnpm test` to verify all tests pass
   - Run `workon` in the terminal and verify:
     - Spinner appears immediately and animates smoothly
     - Spinner disappears and project list appears once scan completes
     - Pressing Escape during spinner exits cleanly
     - Status text shows "Scanning for projects…"
   - Test with `NO_COLOR=1 workon` and verify spinner degrades to `[…]`

---

## Relevant Files

- `src/tui/Spinner.tsx` — **New component** — animated spinner with braille frames, 100 ms/frame, status text, NO_COLOR support
- `src/tui/App.tsx` — Add `config` prop, `isLoading` + `projects` state, `useEffect` scan trigger, conditional render, Escape listener
- `src/commands/tui.ts` — Remove blocking `scanProjects` call, pass `config` to App
- `src/core/scanner.ts` — No changes (already has `scanProjects` export)
- `tests/tui/Spinner.test.ts` — **New tests** — animation, fallback, status text
- `tests/tui/App.test.ts` — **New tests** — loading state transitions, Escape behavior, mock scanner

---

## Verification

1. **Spinner component renders and animates**:
   - Unit test: Spinner cycles through all 10 braille frames in sequence
   - Unit test: Each frame delay is ~100 ms (actual timing varies by system, but frame order is deterministic)
   - Unit test: Status text prop is rendered correctly

2. **App state management works**:
   - Integration test: App mounts with `isLoading=true`, spinner visible
   - Integration test: After mock scan completes, `isLoading=false`, project list visible, spinner gone
   - Integration test: No visible flicker or blank space during transition

3. **Escape key cancels scan**:
   - Integration test: Press Escape while `isLoading=true` triggers `process.exit(0)`
   - Manual test: Terminal returns to prompt cleanly (no errors, no residual state)

4. **NO_COLOR support**:
   - Unit test: Spinner respects `NO_COLOR` env var and renders `[…]` instead of braille
   - Manual test: `NO_COLOR=1 workon` shows ASCII fallback

5. **End-to-end flow**:
   - Manual: Run `workon` with 10+ projects and verify smooth animation
   - Manual: Run `workon` on fast system (instant scan < 500 ms) — verify no stutter
   - Manual: Resize terminal during spinner animation — verify re-centers (if feasible)

---

## Decisions

- **Exit on Escape**: Press Escape during scan → `process.exit(0)` (no partial results, matches FR5)
- **Spinner animation**: Braille characters `⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏` cycling every 100 ms (10 FPS), as per spec
- **Status text**: Static "Scanning for projects…" for MVP (spec FR6 progress updates deferred)
- **Error handling**: Deferred to separate task (FR7 not included in this plan)
- **Architecture**: Move scanner into App.tsx as side effect on mount (vs. keeping blocking call in command)
- **Cancel behavior**: Immediate exit via `process.exit(0)` (no attempt to collect partial results)

---

## Further Considerations

1. **Optional: Performance monitoring** — If scan stays fast (<500 ms on most systems), consider skipping spinner entirely (optional per FR1). Can add as flag or heuristic in future.

2. **Optional: Terminal resize handling** — Ink's `useStdout()` hook provides terminal dimensions. If terminal is resized mid-animation, spinner could re-center. Currently out of scope but worth noting for future refinement.

3. **Follow-up task**: Error handling (FR7) — scan failures, permission errors, invalid paths should display error UI with retry/exit options.
