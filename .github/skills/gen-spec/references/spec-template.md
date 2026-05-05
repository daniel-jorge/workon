# Spec Template — workon Functional Specification

Use this template when drafting `.spec.md` files for new `workon` features.

---

```markdown
# F{N} — {Feature Name}

> **Feature ID**: F{N}  
> **Status**: Draft | Review | Approved  
> **Related**: `docs/workon.tech.md` §F{N}

## Purpose & Goals

{Feature Name} enables developers to {goal statement — what problem is solved}.

Goals:

- G1: {Primary goal — user value}
- G2: {Secondary goal — system quality}
- G3: {Optional goal — future-proofing or UX goal}

Out of scope (v1):

- {Explicitly excluded item 1}
- {Explicitly excluded item 2}

---

## Functional Requirements

### FR1 — {Requirement Name}

{Description of what the system must do. One clear behavior per requirement.}

- **Trigger**: {What initiates this behavior — user action, system event}
- **Behavior**: {What the system does}
- **Output**: {What the user sees / what state changes}

### FR2 — {Requirement Name}

...

_(Repeat for all functional requirements. Typical range: 3–8)_

---

## User Experience Flow

### Flow A — {Primary Flow Name}

1. User {action} (`workon {command} {args}` or TUI: `{key}`)
2. System {immediate response — what appears on screen}
3. User {next action}
4. System {response}
5. Outcome: {final state — what has changed}

### Flow B — {Alternative Flow Name} _(if applicable)_

1. ...

---

## Non-Functional Requirements

### NFR1 — Performance

- {Performance constraint, e.g., "Response within 100ms for up to 500 projects"}

### NFR2 — Compatibility

- {Compatibility constraint, e.g., "Backward-compatible with GlobalConfig v1; migration handled automatically"}

### NFR3 — Accessibility / UX

- {UX constraint, e.g., "All actions reachable via keyboard; no mouse required"}

---

## Test Strategy

- **Unit tests**: {Which FRs should be covered by unit tests, e.g., "FR1, FR2 — pure logic in core/"}
- **Integration tests**: {Which FRs need integration tests, e.g., "FR3, FR4 — TUI rendering with ink-testing-library"}
- **Manual tests**: {Which FRs need manual verification, e.g., "FR5 — actual IDE launch cannot be unit-tested"}

---

## Edge Cases & Error Handling

### EC1 — {Edge Case Name}

- **Scenario**: {When / what situation}
- **Expected behavior**: {What the system does}
- **User feedback**: {What the user sees, if any}

### EC2 — {Edge Case Name}

...

_(Cover: empty state, invalid input, missing file, concurrent operations, large datasets, first-run/no-config)_

---

## Acceptance Criteria

- [ ] AC1: {Verifiable statement — "When [condition], [outcome] occurs"}
- [ ] AC2: {Verifiable statement}
- [ ] AC3: {Verifiable statement}
- [ ] AC4: {Verifiable statement}
- [ ] AC5: {Verifiable statement}

_(Each AC must be independently testable in under 2 minutes by a QA engineer, via CLI command, TUI interaction, or config file inspection.)_

**Typical AC count**: Simple features (3–5) | Medium features (5–8) | Complex features (8–15)
```

---

## Conventions

### Feature Numbering

- Check `docs/workon.tech.md` for the current highest F-number (currently F13 = Context Menu)
- Assign the next sequential number (F14, F15, …)

### Requirement Prefixes

| Prefix | Meaning                    |
| ------ | -------------------------- |
| `FR`   | Functional Requirement     |
| `NFR`  | Non-Functional Requirement |
| `EC`   | Edge Case                  |
| `AC`   | Acceptance Criterion       |
| `G`    | Goal                       |

### Writing Style

- **Active voice**: "System displays…" not "A message is displayed…"
- **One behavior per requirement**: Split compound behaviors into separate FRs
- **Testable language**: Use "must", "shall", not "should" or "may" for required behaviors
- **No implementation details**: Don't mention `src/core/config.ts`, `fuse.js`, etc. — those belong in `.plan.md`
- **User-facing language**: Describe what the user sees/does, not how the code works

### User Flow Format

```
User presses `↑` / `↓` → List selection moves
User types characters → Search bar filters the list in real time
User presses `Enter` → Selected project opens in configured IDE
User presses `Escape` → Returns to previous state / cancels
User presses `META+P` → Toggles pin state for selected project
```

### Scope Anti-patterns to Avoid

- Don't specify data structure details (e.g., "stored as an array of strings")
- Don't specify library choices (e.g., "uses fuse.js with threshold 0.4")
- Don't specify file paths or function names
- Don't leave `TBD` items — resolve all decisions before marking status = Approved

### Typical Section Count (by feature complexity)

| Complexity               | FRs  | ECs | ACs  |
| ------------------------ | ---- | --- | ---- |
| Simple (single command)  | 2–4  | 2–3 | 3–5  |
| Medium (TUI interaction) | 4–6  | 3–5 | 5–8  |
| Complex (new subsystem)  | 6–10 | 5–8 | 8–15 |
