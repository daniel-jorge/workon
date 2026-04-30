# Ubiquitous Language — `workon`

Domain terms used consistently across specs, code, and documentation.

---

## Core Concepts

### Project

A directory on disk that has been recognised as a developer workspace. A directory qualifies as a project when it contains at least one **marker file**. Every project has a name, path, type, open command, profile, description, and tags.

### Project Type

A category automatically assigned to a project based on which **marker file** is found first. Possible values: `nodejs`, `rust`, `go`, `python`, `java`, `dotnet`, `generic`.

### Marker File

A well-known file whose presence in a directory identifies the **project type**. Examples: `package.json` → nodejs, `Cargo.toml` → rust, `go.mod` → go, `pyproject.toml` / `requirements.txt` → python, `pom.xml` / `build.gradle` → java, `*.csproj` / `*.sln` → dotnet, `.git` (fallback) → generic. First match wins.

### Generic Project

A project whose only marker is `.git` — no language-specific marker file was found.

---

## Configuration

### Global Config

The user-level configuration file stored at `~/.workonrc.json`. Controls **roots**, **max depth**, **ignore patterns**, **open commands**, **default open command**, **default profile**, and **pinned projects**. Created automatically with defaults on first run if absent.

### DevProject Config / Per-Project Config

An optional `.workonrc.json` file placed at a project's root. Overrides global defaults for that specific project. Fields: `name`, `description`, `openCommand`, `profile`, `tags`. A project that has this file is said to **have a DevProject** (`hasDevProject: true`).

### Root (Root Folder)

An absolute path configured in the **global config** as a top-level directory to scan for projects. Multiple roots can be configured.

### Max Depth

The maximum number of directory levels the **scanner** descends below each **root** when looking for projects. Configured as `maxDepth` in the global config.

### Ignore Patterns

A list of glob patterns in the **global config** specifying folders or files the **scanner** should skip. Defaults include `**/node_modules/**`, `**/dist/**`, `**/.git/**`.

### Profile

A named VS Code profile applied when opening a project. Stored in global config as `defaultProfile` and can be overridden per project in **DevProject Config**.

---

## Open Commands

### Open Command

A named entry that pairs a human-readable `name` (e.g., `"Visual Studio Code"`) with a CLI `command` (e.g., `"code"`). Open commands are defined in the global config and presented to the user in the **Launch Menu**. At most 9 open commands are supported (UI constraint).

### Default Open Command

The `command` value from the **open commands** list that is pre-selected when opening a project. Stored as `defaultOpenCommand` in the global config.

---

## Discovery & Search

### Scan / Project Discovery

The process of traversing each **root** up to **max depth** levels, identifying directories that contain a **marker file**, loading any **DevProject Config**, and returning a sorted list of **projects**.

### Scanner

The module (`src/core/scanner.ts`) responsible for running **project discovery**. Uses `fast-glob` to enumerate directories and assembles the final project list, including **pinned** ordering.

### Fuzzy Search

Real-time filtering of the project list using approximate string matching (Fuse.js). Searches across project `name`, `path`, and `tags`. Active in the **TUI** as the user types.

---

## Pinning

### Pinned Project

A project marked by the user for quick access. Pinned projects are stored as an array of absolute paths in the **global config** under `pinned` and always appear at the top of the project list, above unpinned projects.

### Pin / Unpin

The act of adding or removing a project from the **pinned** list. Can be triggered from the **Launch Menu** in the TUI or via `workon pin toggle <name>`.

### Missing Project

A project whose path appears in the **pinned** list but no longer exists on disk. Displayed with a `(not found)` description and a warning. The user must explicitly unpin it; it is never removed automatically.

---

## Terminal UI (TUI)

### TUI (Terminal User Interface)

The full-screen interactive mode launched by running `workon` with no arguments. Built with Ink (React for terminals). Displays the project list, accepts **fuzzy search** input, and allows keyboard-driven navigation and launching.

### App

The root Ink component (`src/tui/App.tsx`) that owns TUI state: the search query, selected index, and project list. Composes `SearchBar`, `ProjectList`, `HintBar`, and overlays such as `LaunchMenu`.

### Project List

The scrollable, filtered list of **projects** displayed in the TUI. Pinned projects are shown first, marked with a 📌 indicator.

### Search Bar

The text input at the top of the TUI. Keystrokes update the search query and trigger **fuzzy search** in real time.

### Hint Bar

The static bar at the bottom of the TUI showing available keyboard shortcuts (e.g., `↑↓ navigate · Enter open · Esc clear/exit`).

### Launch Menu

An overlay in the TUI triggered by pressing `Enter` on a selected project. Lists all configured **open commands** with number-key shortcuts (`1`–`9`) and a **pin/unpin** option. Pressing `Esc` dismisses it and returns to the project list.

### Context Menu

An alternative name for the **Launch Menu** used in some TUI component files.

---

## CLI Commands

| Command                      | Description                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `workon`                     | Launch the **TUI**                                                           |
| `workon open <name>`         | Open the first project matching `<name>` directly                            |
| `workon list`                | Print all discovered projects as plain text                                  |
| `workon init`                | Scaffold a **DevProject Config** (`.workonrc.json`) in the current directory |
| `workon config <subcommand>` | Manage the **global config** (add-root, remove-root, set-depth, etc.)        |
| `workon pin list`            | List all **pinned projects**                                                 |
| `workon pin open <name>`     | Open a **pinned project** by name                                            |
| `workon pin toggle <name>`   | Pin or unpin a project by name                                               |
| `workon config cleanup-pins` | Remove all **missing projects** from the pinned list                         |

---

## Data Integrity & Validation

### Schema Validation

All config files (`~/.workonrc.json` and per-project `.workonrc.json`) are parsed and validated with **Zod** schemas (`GlobalConfigSchema`, `DevProjectSchema`) on every read. Invalid data is rejected with an error; missing optional fields fall back to defaults.

### Migration

Automatic, backward-compatible transformation applied during schema parsing. Example: `defaultIde` (old field) is transparently mapped to `defaultOpenCommand` so existing configs continue to work.
