# `workon` — Functional Specification

## Purpose

`workon` is a command-line tool that helps developers find and open their projects quickly.
It automatically discovers projects on disk, remembers preferred IDE and profile per project,
and provides an interactive terminal UI to search and launch them.

---

## Features

### F1 — Project Discovery

- Scans one or more configured root folders to find projects automatically
- Scan depth is configurable (how many folder levels deep to look)
- A folder is recognized as a project when it contains known marker files (e.g. `package.json`, `.git`, `Cargo.toml`, etc.)
- Detected project type is shown in the UI (Node.js, Rust, Go, Python, Java, .NET, Generic)
- Folders and file patterns to ignore during scan are configurable (e.g. `node_modules`, `dist`)
- Discovered projects are sorted alphabetically

### F2 — Per-Project Configuration

- Any project can have a `.workonrc.json` file at its root
- This file defines a preferred IDE, VS Code profile, display name, description, and tags for that project
- Settings in `.workonrc.json` override the global defaults
- Projects that have a `.workonrc.json` file are visually marked in the UI

### F3 — Global Configuration

- A single configuration file stored in the user's home directory (`~/.workonrc.json`)
- Configurable options:
  - List of root folders to scan
  - Maximum scan depth
  - Default IDE (`code` or `code-insiders`)
  - Default VS Code profile
  - List of folder/file names to ignore during scan

### F4 — Interactive TUI (default command)

- Launches a full-screen interactive terminal UI when running `workon` with no arguments
- Displays the list of discovered projects with name, path, type, IDE, and profile
- Live fuzzy search: typing filters the list in real time
- Navigate the list with arrow keys
- Press Enter to open the selected project
- Press Escape to clear the search or exit
- Shows a count of visible vs total projects
- Shows keyboard hint bar at the bottom

### F5 — Direct Project Open

- Open a project by name without going through the TUI
- Matches by project name (case-insensitive) or partial path

### F6 — Plain Project List

- Print all discovered projects to the terminal as plain text
- Useful for scripting or quick reference without the TUI

### F7 — Project File Scaffolding

- Running `workon init` in any project folder creates a `.workonrc.json` file pre-filled with defaults
- Fails gracefully if a `.workonrc.json` already exists

### F8 — Configuration Management

- CLI subcommands to manage `~/.workonrc.json` without editing it manually:
  - Add or remove a root folder
  - Set the default IDE
  - Set the default VS Code profile
  - Set the maximum scan depth
  - Print the current configuration

---

## User Flows

### Opening a project (TUI)

1. User runs `workon`
2. List of all discovered projects appears
3. User types part of the project name to filter
4. User navigates with arrow keys to the desired project
5. User presses Enter — VS Code opens the project with the configured IDE and profile
6. Terminal returns to the shell

### Opening a project (direct)

1. User runs `workon open billing`
2. First matching project opens immediately
3. Terminal returns to the shell

### Adding a new root folder

1. User runs `workon config add ~/new-workspace`
2. Folder is added to `~/.workonrc.json`
3. Next time `workon` runs, projects in that folder are discovered automatically

### Configuring a specific project

1. User navigates to a project folder
2. User runs `workon init`
3. A `.workonrc.json` file is created in the folder
4. User edits the file to set a preferred IDE, profile, name, or tags
5. Next time `workon` runs, that project uses the custom configuration

---

## Constraints

- Requires Node.js 18 or later
- IDE launch requires VS Code (`code`) or VS Code Insiders (`code-insiders`) to be installed and available in the system PATH
- `.workonrc.json` files must be valid JSON
- `~/.workonrc.json` is created automatically with empty defaults on first use if it does not exist
