# 🚀 workon

Find and open your projects quickly with this CLI tool.

## 🤔 What problem does `workon` solve?

Juggling multiple projects? Finding the right one shouldn't be a headache. `workon` helps you discover, remember, and launch your projects in seconds.

## ⚙️ How does it work?

Workon is a command-line tool that helps you find and open your projects quickly. It automatically discovers projects on your disk, remembers your preferred IDE and VS Code profile per project, and provides an interactive terminal UI to search and launch them instantly.

## 📦 Installation

```bash
npm install -g @crize2013/workon
```

## 🎯 Quick Start

### 1. Configure Your Workspace Folders

Before using `workon`, tell it where to find your projects:

```bash
workon config add ~/Developer
workon config add ~/workspace
```

You can add as many root folders as you need. Each folder will be scanned recursively to discover projects.

### 2. Launch the Interactive UI

Simply run:

```bash
workon
```

This opens an interactive terminal UI where you can:

- **Search** by typing the project name (live fuzzy matching)
- **Navigate** with arrow keys
- **Open** by pressing Enter (opens Launch Menu with IDE selection and pin toggle)
- **Pin/Unpin** projects from the Launch Menu for quick access
- **Exit** by pressing Escape

### 3. Optional: Configure Per-Project Settings

Inside any project folder, create a `.workonrc.json` file:

```bash
cd ~/Developer/my-project
workon init
```

Then edit `.workonrc.json` to customize:

```json
{
  "ide": "code",
  "profile": "work",
  "name": "My Project",
  "description": "A description of this project",
  "tags": ["backend", "nodejs"]
}
```

## 💻 Commands

```shell
❯ workon --help
Usage: workon [options] [command]

Find and open your projects quickly

Options:
  -V, --version  output the version number
  -h, --help     display help for command

Commands:
  open <query>   Open a project by name
  list           List all discovered projects
  init           Create a .workonrc.json file in the current directory
  config         Manage configuration
  pin            Manage pinned projects
```

### `workon` (default)

Opens the interactive TUI to browse and search all discovered projects.

```bash
workon
```

**Features:**

- Live fuzzy search as you type
- Pinned projects appear first (marked with 📌) for quick access
- Alphabetically sorted project list
- Shows project type (Node.js, Rust, Python, Go, Java, .NET)
- Shows configured IDE and profile
- Displays count of matching projects vs. total
- Launch Menu with IDE selection and pin toggle on Enter

### `workon open <query>`

Open a project directly by name without the TUI.

```bash
workon open billing
workon open "my project"
```

The first project matching the query is opened immediately.

### `workon list`

Print all discovered projects to the terminal as plain text.

```bash
workon list
```

Useful for scripting or quick reference without the interactive UI.

### `workon init`

Create a `.workonrc.json` file in the current directory with default values.

```bash
cd ~/Developer/my-project
workon init
```

This initializes a configuration file that you can edit to customize IDE, profile, name, and tags for that specific project.

### `workon config`

Manage global configuration stored in `~/.workonrc.json`.

```shell
❯ workon config --help
Usage: workon config [options] [command]

Manage configuration

Options:
  -h, --help          display help for command

Commands:
  show                Print current configuration
  add-root <path>     Add a root folder to scan
  remove-root <path>  Remove a root folder
  set-ide <ide>       Set the default IDE (code or code-insiders)
  set-profile <name>  Set the default VS Code profile
  set-depth <number>  Set the maximum scan depth
  help [command]      display help for command
```

Examples:

```bash
# Add a root folder to scan
workon config add ~/new-workspace

# Remove a root folder
workon config remove ~/old-workspace

# Set the default IDE (code or code-insiders)
workon config set-ide code-insiders

# Set the default VS Code profile
workon config set-profile work

# Set maximum scan depth (how many folder levels deep to look)
workon config set-depth 4

# View current configuration
workon config show
```

### `workon pin`

Manage your pinned projects for quick access.

#### `workon pin list`

List all pinned projects in order.

```bash
workon pin list
```

Output example:

```
[📌] my-app — /Users/user/projects/my-app
[📌] legacy-service — /Users/user/projects/legacy-service
```

#### `workon pin open <project-name>`

Open a pinned project directly by name (supports fuzzy matching).

```bash
workon pin open my-app
workon pin open "legacy-service"
```

The project launches with the configured IDE.

#### `workon pin toggle <project-name>`

Toggle the pin status of a project (add to or remove from pinned projects).

```bash
workon pin toggle my-app
```

When adding a project to pins:

```
✓ Pinned my-app
```

When removing from pins:

```
✓ Unpinned my-app
```

## ⚡ Configuration

### Global Configuration (`~/.workonrc.json`)

Created automatically on first use. Edit directly or use `workon config` commands.

```json
{
  "rootFolders": ["~/Developer", "~/workspace"],
  "maxScanDepth": 3,
  "defaultIde": "code",
  "defaultProfile": "default",
  "ignorePatterns": ["node_modules", "dist", ".git", ".venv"],
  "pinned": ["/Users/user/projects/my-app", "/Users/user/projects/legacy-service"]
}
```

**Options:**

- `rootFolders` — Directories to scan for projects
- `maxScanDepth` — How many folder levels deep to scan (default: 3)
- `defaultIde` — Default IDE to use (`code` or `code-insiders`)
- `defaultProfile` — Default VS Code profile name
- `ignorePatterns` — Folders/files to skip during scanning
- `pinned` — Array of absolute paths to pinned projects (for quick access)

### Per-Project Configuration (`.workonrc.json`)

Add to any project root folder to override defaults:

```json
{
  "ide": "code-insiders",
  "profile": "personal",
  "name": "My Special Project",
  "description": "A custom description",
  "tags": ["important", "client-work"]
}
```

**Options:**

- `ide` — IDE to use for this project (overrides global default)
- `profile` — VS Code profile to use (overrides global default)
- `name` — Display name shown in the TUI
- `description` — Short description of the project
- `tags` — Searchable tags

## 🔍 Project Discovery

`workon` automatically detects projects by looking for marker files:

| Marker File        | Project Type |
| ------------------ | ------------ |
| `package.json`     | Node.js      |
| `Cargo.toml`       | Rust         |
| `go.mod`           | Go           |
| `requirements.txt` | Python       |
| `pom.xml`          | Java         |
| `.csproj`          | .NET         |
| `.git`             | Generic      |

Folders matching ignore patterns (like `node_modules`, `dist`, `.git`) are skipped during scanning.

## 💡 Tips & Tricks

### Search More Efficiently

The search is fuzzy, so you can type partial names:

- Type `bill` to find `billing` or `billpay`
- Type `api-ser` to find `api-server`
- Type `py` to find Python projects

### Configure Multiple Workspaces

Add all your workspace folders:

```bash
workon config add ~/Developer
workon config add ~/personal
workon config add ~/clients
```

### Pin Your Favorite Projects

Pin frequently-used projects for quick access at the top of the project list:

```bash
# In the interactive TUI: press Enter on a project, then navigate to "Pin Project"
# Or from the CLI:
workon pin toggle my-app

# List all pinned projects
workon pin list

# Open a pinned project directly
workon pin open my-app
```

Pinned projects always appear first in the project list (marked with 📌) and persist across sessions.

### Organize Projects with Tags

Use `.workonrc.json` to tag projects for better organization:

```json
{
  "tags": ["client:acme", "backend"]
}
```

Then search by tag in the TUI.

### Use Different IDE Profiles

Set up VS Code profiles for different contexts (Work, Personal, etc.) and configure projects to use them:

```json
{
  "profile": "work",
  "ide": "code"
}
```

## 🔧 Troubleshooting

**Projects not showing up?**

- Run `workon config show` to check configured folders
- Verify folders exist and contain projects with marker files
- Check that `maxScanDepth` is high enough
- Try `workon config set-depth 5` to increase scan depth

**Wrong IDE opening?**

- Check `~/.workonrc.json` for `defaultIde`
- Check project's `.workonrc.json` (if it has one)
- Install `code-insiders` if using that option

**Performance issues?**

- Reduce `maxScanDepth` in config
- Add more patterns to `ignorePatterns`
- Make sure `node_modules` and similar folders are ignored

## ⌨️ Keyboard Shortcuts (Interactive TUI)

### Project List

| Key       | Action                         |
| --------- | ------------------------------ |
| `↑` / `↓` | Navigate project list          |
| `Enter`   | Open Project Menu              |
| `Escape`  | Clear search, then exit        |
| Type      | Filter projects (fuzzy search) |

### Launch Menu

| Key       | Action                                   |
| --------- | ---------------------------------------- |
| `↑` / `↓` | Navigate between options                 |
| `1–X`     | Quick-select IDE                         |
| `P`       | Toggle pin/unpin project                 |
| `Enter`   | Confirm selection (launch or toggle pin) |
| `Escape`  | Cancel and return to list                |

## 📌 Version

Check your version:

```bash
workon --version
```

Update to the latest:

```bash
npm install -g @crize2013/workon
```
