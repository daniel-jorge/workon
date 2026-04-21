# Feature: workon - Project Discovery and Launch

Feature: Discover and open projects quickly with a CLI tool
  As a developer
  I want to find and open my projects from the terminal
  So that I can switch between projects efficiently

---

## Main Scenario: Interactive TUI Project Selection

Scenario: User discovers and opens a project via interactive TUI
  Given the system has scanned root folders and discovered multiple projects
  And projects are sorted alphabetically
  When the user runs `workon` with no arguments
  Then an interactive terminal UI appears displaying:
    | Field          | Example                        |
    | Project name   | billing                        |
    | Project path   | ~/workspace/billing            |
    | Project type   | Node.js                        |
    | IDE            | code                           |
    | Profile        | work                           |
  And a search bar is visible at the top
  And keyboard hints are shown at the bottom
  And the total count of projects is displayed

Scenario: User filters projects via live fuzzy search
  Given the interactive TUI is open with 10 discovered projects
  When the user types "bill" in the search bar
  Then the project list filters in real-time
  And only projects matching "bill" are displayed
  And the visible project count updates (e.g., "2 / 10")

Scenario: User navigates and selects a project
  Given the interactive TUI shows a filtered list of projects
  When the user presses the arrow key down to navigate
  Then the selection moves to the next project in the list
  When the user presses Enter on the selected project
  Then VS Code opens with the project's configured IDE and profile
  And the terminal returns to the shell

Scenario: User clears search and exits TUI
  Given the interactive TUI is open with search text entered
  When the user presses Escape
  Then the search text is cleared
  When the user presses Escape again
  Then the TUI closes
  And the terminal returns to the shell

---

## Main Scenario: Project Discovery

Scenario: System discovers projects during scan
  Given root folders are configured in `~/.workonrc.json`
  And the maximum scan depth is set to 3 levels
  And ignore patterns are set to: node_modules, dist, .git
  When `workon` runs
  Then the system scans each root folder recursively
  And folders containing marker files are recognized as projects:
    | Marker file | Project Type |
    | package.json | Node.js |
    | Cargo.toml | Rust |
    | go.mod | Go |
    | requirements.txt | Python |
    | pom.xml | Java |
    | .csproj | .NET |
  And folders matching ignore patterns are skipped
  And discovered projects are sorted alphabetically
  And projects with `.workonrc.json` files are marked as configured

Scenario: Per-project configuration overrides defaults
  Given a project has a `.workonrc.json` file at its root
  And the file contains: { "ide": "code-insiders", "profile": "personal" }
  When the project is displayed in the TUI
  Then the IDE shown is "code-insiders" (not the global default)
  And the profile shown is "personal"
  When the user opens this project
  Then VS Code Insiders is launched with the "personal" profile

---

## Main Scenario: Direct Project Open

Scenario: User opens a project by name without TUI
  Given projects are discovered
  And a project named "billing" exists
  When the user runs `workon open bill`
  Then the first matching project opens immediately
  And VS Code launches with the configured IDE and profile
  And the terminal returns to the shell

Scenario: No match found for project name
  Given projects are discovered
  When the user runs `workon open nonexistent`
  Then an error message is displayed: "No project found matching 'nonexistent'"
  And the terminal returns to the shell
