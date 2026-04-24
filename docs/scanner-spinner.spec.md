# F9 — Scanner Spinner — Detailed Functional Specification

## Overview

The Scanner Spinner provides real-time visual feedback during the project discovery phase of the `workon` TUI. It reassures the user that the application is responsive and working, particularly during longer scans across multiple or deep folder hierarchies.

---

## Purpose & Goals

1. **Perceived Responsiveness**: Eliminate the appearance of a frozen application during project discovery
2. **Progress Communication**: Signal to the user that scanning is actively in progress
3. **Better UX**: Improve the perceived performance of slow scans
4. **Professional Polish**: Display a smooth, animated indicator

---

## Functional Requirements

### FR1 — Spinner Visibility & Timing

- Spinner **must appear immediately** when the scan begins (< 50 ms after scan start)
- Spinner **remains visible** for the entire duration of the scan
- Spinner **is replaced** by the project list once the scan completes
- If scan completes very quickly (< 500 ms), the spinner **may** be skipped or briefly flashed, but this is optional

### FR2 — Spinner Animation

- Spinner **animates continuously** while the scan is in progress
- Animation uses a standard terminal spinner character set (e.g., `⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏` or similar)
- Animation cycle completes every 80–120 ms (12–8 frames per second)
- Animation is **smooth and consistent** with no jerky transitions or skipped frames

### FR3 — Spinner Content & Layout

- Spinner is displayed in the center of the TUI viewport or above the hint bar
- Spinner is accompanied by **status text**, e.g.: `Scanning for projects…` or `Scanning ~/projects/ and ~/work/…`
- Status text shows which root folder(s) are being scanned (if multiple)
- Spinner and text are **centered horizontally** on the screen
- Total height of spinner + text is **3–5 lines** maximum

### FR4 — Spinner Replacement by Results

- Once the scan completes:
  1. Spinner animation stops immediately
  2. Spinner is cleared from the display
  3. Project list is rendered in its place with no flicker
  4. If no projects were found, a message appears (e.g., `No projects found`)
- The transition **must be seamless** with no visible pause or blank space

### FR5 — User Interaction During Scan

- User **cannot interact** with the project list while the spinner is displayed
- User **can press Escape** at any time to cancel the scan and exit
- Cancelling the scan **terminates the discovery process** and closes the TUI
- Cancelling the scan **does not save** any incomplete results

### FR6 — Scan Status Updates (Optional)

- Optionally, the spinner status text **may update** to show:
  - Number of folders scanned so far
  - Current folder being scanned
  - Estimated time remaining (if determinable)
- Updates should occur **no more frequently than once per 500 ms** to avoid visual noise

### FR7 — Error Handling

- If a scan encounters an **error** (e.g., permission denied on a folder):
  - Spinner **continues** animating
  - Error is **logged** but does not stop the scan
  - Scan continues with remaining folders
- If a scan **fails completely** (e.g., invalid root path):
  - Spinner is replaced with an error message
  - Error message explains the problem
  - User is offered options to retry or exit

### FR8 — Accessibility

- Spinner animation **respects** `NO_COLOR` environment variable (if set, uses no ANSI colors)
- If terminal does not support ANSI animation, spinner **degrades gracefully** to a static indicator (e.g., `[Scanning…]`)
- Status text is **plain ASCII** where possible to maximize terminal compatibility

---

## User Experience Flow

### Typical Scan Flow

```
User runs: workon

[Screen clears, TUI initializes]

[Spinner appears, animates]
"Scanning for projects…"

[Spinner continues for 2–3 seconds]

[Scan completes]

[Spinner fades, project list appears]
[User can now search and navigate]
```

### Quick Scan Flow (optional optimization)

```
User runs: workon

[Scan completes in < 500 ms]

[Project list appears immediately, spinner may be skipped]
```

### User Cancels During Scan

```
User runs: workon

[Spinner appears, animates]
"Scanning for projects…"

[User presses Escape]

[Spinner stops, TUI closes]
[Shell returns to prompt]
```

---

## Acceptance Criteria

- [ ] Spinner appears within 50 ms of scan start
- [ ] Spinner animates smoothly at 8–12 FPS (80–120 ms per frame)
- [ ] Spinner is accompanied by clear status text
- [ ] Status text shows at least one root folder being scanned
- [ ] Spinner is centered on the screen
- [ ] Project list appears immediately after scan completes with no gap or flicker
- [ ] User can press Escape to cancel scan at any time
- [ ] Cancelling the scan cleanly exits the TUI
- [ ] If scan fails, an error message is displayed
- [ ] Spinner gracefully degrades to static indicator on terminals without ANSI support
- [ ] Spinner respects `NO_COLOR` environment variable
- [ ] Spinner works with both `code` and `code-insiders` IDE configurations

---

## Performance Considerations

### Optimization Targets

1. **Spinner Rendering**: Minimize re-renders and animation frame drops
2. **Animation Frame Rate**: Target 10 FPS (100 ms per frame) to reduce CPU usage
3. **Scanner Parallelization**: Process folders efficiently so the spinner stays animated
4. **Quick Exits**: For scans < 500 ms, consider whether spinner adds value

### Benchmarks (Target)

- Spinner first frame: < 50 ms
- Animation frame drop rate: < 1%
- CPU usage during animation: < 5% on a single core
- Memory usage: < 2 MB additional

---

## Edge Cases & Error Scenarios

### EC1 — Empty Scan Results

- **Scenario**: Scan completes but finds zero projects
- **Behavior**: Spinner replaced with `"No projects found"` message
- **User Action**: User can press Escape to exit, or re-run the command

### EC2 — Partial Failures

- **Scenario**: Scan encounters permission errors on some folders
- **Behavior**: Spinner continues; errors are logged; scan completes with available results
- **User Action**: User sees results for accessible folders only

### EC3 — Very Long Scan

- **Scenario**: User has hundreds of deep folders; scan takes 30+ seconds
- **Behavior**: Spinner animates continuously; status text may update to show progress
- **User Action**: User can press Escape to cancel and get partial results (optional)

### EC4 — Terminal Resize

- **Scenario**: User resizes terminal while spinner is animating
- **Behavior**: Spinner repositions to remain centered
- **User Action**: Spinner continues animating in new position

### EC5 — No Color Support

- **Scenario**: Terminal does not support ANSI colors (or `NO_COLOR` is set)
- **Behavior**: Spinner uses ASCII-only animation: `[/, -, \, |]` or static `[…]`
- **User Action**: Animation may be slower but remains visible

---

## Future Enhancements (Out of Scope for F9)

- Live scan progress display (% complete or count of projects found)
- Estimated time remaining
- Option to skip spinner for faster terminals
- Custom spinner character sets per theme
- Spinner color customization via config

---

## Related Features

- **F1 — Project Discovery**: Scanner that generates the data displayed
- **F4 — Interactive TUI**: Container that hosts the spinner and list
- **F5 — Direct Project Open**: Bypasses TUI/spinner entirely; no spinner needed

---

## Testing Strategy

### Unit Tests

- Spinner displays correct status text
- Spinner animation cycles smoothly without skipped frames
- Escaping during scan triggers cancellation

### Integration Tests

- Spinner appears when scan begins, disappears when scan ends
- Scanner can be cancelled mid-scan with no residual state
- Project list renders immediately after spinner exits with no flicker

### Manual Tests

- Run `workon` on a system with 50+ projects and verify smooth spinner animation
- Press Escape during scan and verify clean exit
- Verify spinner works with `code` and `code-insiders` configurations
- Resize terminal during scan and verify spinner re-centers
- Test on a terminal without color support and verify fallback works
