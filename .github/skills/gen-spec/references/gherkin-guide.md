# Gherkin Guide — workon Feature Files

Conventions for writing `.feature` files in the `workon` project.

---

## File Structure

```gherkin
Feature: {Feature Name}
  {One-sentence description of the feature.}
  {Optional second line: how/where it works.}
  {Optional third line: key behaviors.}

  # ===== HAPPY PATH — Core Functionality =====

  Scenario: {Title}
    ...

  # ===== EDGE CASES — Boundary Conditions =====

  Scenario: {Title}
    ...

  # ===== ERROR HANDLING — Failure Scenarios =====

  Scenario: {Title}
    ...

  # ===== INTEGRATION — Cross-Feature Interactions =====

  Scenario: {Title}
    ...
```

---

## Scenario Groups

Always organize scenarios in this order. Use the exact group header format:

```
# ===== GROUP TITLE — Subtitle =====
```

| Group                                      | Purpose                                                     |
| ------------------------------------------ | ----------------------------------------------------------- |
| `HAPPY PATH — Core Functionality`          | Primary user flows working correctly                        |
| `EDGE CASES — Boundary Conditions`         | Valid but unusual inputs, empty states, limits              |
| `ERROR HANDLING — Failure Scenarios`       | Invalid input, missing files, system errors                 |
| `INTEGRATION — Cross-Feature Interactions` | Interactions with other features (search, config, scanning) |

Add or skip groups as needed. Not all features require all four groups.

---

## Step Vocabulary

### Given (setup/precondition)

```gherkin
Given the TUI is displaying a list of projects
Given the project "my-app" is pinned
Given the following projects exist:
  | name     | path                        |
  | my-app   | /Users/user/projects/my-app |
Given ~/.workonrc.json contains: {"roots": ["/Users/user/projects"]}
Given no configuration file exists
```

### When (action)

```gherkin
When the user runs: workon {command}
When the user presses "{key}"
When the user navigates to "{project}" and presses Enter
When the user types "{text}" in the search bar
When the user selects "{option}" from the menu
```

### Then (outcome)

```gherkin
Then the output should display: "..."
Then the TUI should show "{indicator}" next to "{project}"
Then {project} should appear at the top of the list
Then ~/.workonrc.json should contain: {...}
Then the CLI should exit with code {0|1}
Then an error message should be shown: "..."
Then the TUI should exit
```

### And / But

Use `And` to continue a Given/When/Then block of the same type.  
Use `But` to express a contrasting condition:

```gherkin
Then the project list should update
But the TUI should remain open
```

---

## Data Tables

Use tables for lists of options, projects, or key-value pairs:

```gherkin
Then a menu should appear with:
  | option              | shortcut |
  | Open in VS Code     | 1        |
  | Open in Cursor      | 2        |
  | Pin Project         | ↓+ENTER  |
```

```gherkin
Given the following projects are pinned:
  | name     | path                           |
  | my-app   | /Users/user/projects/my-app    |
  | backend  | /Users/user/projects/backend   |
```

---

## Docstrings

Use docstrings for multi-line CLI output:

```gherkin
Then the output should display:
  """
  [📌] my-app — /Users/user/projects/my-app
  [📌] backend — /Users/user/projects/backend
  """
```

---

## Scenario Outline

Use `Scenario Outline` + `Examples` for parametric cases:

```gherkin
Scenario Outline: Opening a project with different commands
  Given the project "my-app" is configured with open command "<command>"
  When the user runs: workon open my-app
  Then the project should open using "<command>"

  Examples:
    | command     |
    | code        |
    | cursor      |
    | idea        |
```

---

## Naming Conventions

**Scenario titles** — plain English, subject first:

```
✓ User pins a project via Launch Menu
✓ Pinned projects appear at the top of the TUI list
✓ Handle deleted pinned project in CLI
✗ Test that pinning works          ← too vague
✗ Pin toggle scenario              ← not descriptive
```

**Project names in scenarios** — use lowercase, hyphenated names: `my-app`, `app-legacy`, `backend-service`

**File paths in scenarios** — use Unix paths: `/Users/user/projects/my-app`

**Config file references** — always use `~/.workonrc.json` for global config, `.workonrc.json` for per-project

**Key names** — use backtick inline in step text: `` `↑` ``, `` `Enter` ``, `` `Escape` ``, `` `META+P` ``

---

## Coverage Checklist

Before submitting a `.feature` file, verify coverage for:

- [ ] Primary happy-path flow (end-to-end)
- [ ] Alternative happy paths (different options, shortcuts)
- [ ] Empty state (no projects, no config, first run)
- [ ] Single-item state (exactly one project / one pin)
- [ ] Large dataset (many projects — performance/pagination concern)
- [ ] Invalid input (bad args, malformed config)
- [ ] Missing file (project dir deleted, config missing)
- [ ] Persistence (state survives restart / re-launch)
- [ ] Integration with search (filter + feature interaction)
- [ ] Integration with scan (project discovery + feature)
- [ ] CLI and TUI paths (if the feature is available in both)

---

## Correspondence to Spec

Every **Acceptance Criterion** in the `.spec.md` must have at least one corresponding scenario.

**Mapping table example:**

| Spec AC                           | Gherkin Scenarios                                                           |
| --------------------------------- | --------------------------------------------------------------------------- |
| AC1: User can pin via TUI         | "User pins a project via Launch Menu", "Pinned project shows pin indicator" |
| AC2: User can unpin via TUI       | "User unpins a project via Launch Menu"                                     |
| AC3: Pins persist across sessions | "Pins persist across multiple TUI sessions"                                 |
| AC4: CLI pin toggle works         | "User toggles pin status via CLI command"                                   |

Mark the mapping with inline comments when the link is not obvious:

```gherkin
  # Covers AC3: Pinned projects appear at top after toggle
  Scenario: Pinned project appears at top after CLI toggle
    ...
```

---

## Anti-patterns to Avoid

| Anti-pattern                                  | Fix                                                               |
| --------------------------------------------- | ----------------------------------------------------------------- |
| `When the user does stuff`                    | Be specific: `When the user runs: workon pin toggle my-app`       |
| `Then it should work`                         | Be verifiable: `Then the output should contain "✓ Pinned my-app"` |
| Implementation steps in Given                 | `Given the config file has X` not `Given the Zod schema parses X` |
| Scenario longer than 20 steps                 | Split into multiple scenarios                                     |
| Missing `And the CLI should exit with code 0` | Always assert exit code for CLI scenarios                         |
| One giant scenario for the happy path         | Break into focused, independently-runnable scenarios              |
