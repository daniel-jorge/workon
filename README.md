# 🚀 workon

Find and open your projects instantly from the terminal.

**What it does:** Scans your disk for projects, lets you search them by name, and opens them with your preferred editor (VS Code, Cursor, Zed, Neovim, etc.). Pin your favorites for quick access.

## 📦 Installation

```bash
npm install -g @crize2013/workon
```

## 🎯 Getting Started

**1. Add your project folders:**

```bash
workon config add-root ~/Developer
```

**2. Launch the interactive search:**

```bash
workon
```

- Type to search (fuzzy matching)
- Press `Enter` to open the menu (choose editor or pin/unpin)
- Press `Escape` to exit

That's it! You can now search and open projects instantly.

## 💻 Commands

```bash
workon                         # Interactive search and open (main command)
workon open <name>             # Open a project directly (no TUI)
workon list                    # List all discovered projects
workon init                    # Create .workonrc.json in current directory
workon pin list                # Show pinned projects
workon pin open <name>         # Open a pinned project
workon pin toggle <name>       # Pin or unpin a project
workon config show             # Show your configuration
workon config add-root <path>  # Add a folder to scan
workon config remove-root <path>  # Remove a scan folder
```

**Examples:**

```bash
workon config add-root ~/projects
workon open billing
workon pin toggle my-app
```

## ⚙️ Configuration

By default, workon creates `~/.workonrc.json` with sensible defaults. You can customize it:

```bash
workon config show                          # View your config
workon config add-root ~/Developer          # Add a scan folder
workon config remove-root ~/Developer       # Remove a scan folder
workon config set-default-command cursor    # Change default editor
workon config set-depth 5                   # Change scan depth
workon config set-profile personal          # Set default VS Code profile
```

**Config file options:**

- `roots` — Folders to scan for projects
- `maxDepth` — How many levels deep to scan (default: 3)
- `defaultOpenCommand` — Default editor executable (default: `code`)
- `openCommands` — Available open commands (add custom editors here)
- `defaultProfile` — VS Code profile to use by default
- `pinned` — Your pinned project paths
- `ignore` — Glob patterns to skip during scanning

### Managing Open Commands

```bash
# Add an editor
workon config add-command --name "Cursor" --command "cursor"

# Add a terminal editor (opens in current TTY)
workon config add-command --name "Neovim" --command "nvim" --terminal

# Remove an editor by executable
workon config remove-command cursor

# List all configured editors
workon config list-commands

# Set the default editor
workon config set-default-command nvim
```

`list-commands` output example:

```
Display Name  Executable  Terminal  Default
Neovim        nvim        Y         Y
Cursor        cursor      N         N
VS Code       code        N         N
```

### Per-Project Config

Create `.workonrc.json` in any project folder to customize just that project:

```json
{
  "openCommand": "code-insiders",
  "profile": "personal",
  "name": "My Project",
  "description": "Optional description",
  "tags": ["important", "client-work"]
}
```

Or run `workon init` in the project folder to generate this file.

## 🔍 What Projects Are Detected?

Workon finds projects by looking for marker files:

| Marker File        | Type    |
| ------------------ | ------- |
| `package.json`     | Node.js |
| `go.mod`           | Go      |
| `Cargo.toml`       | Rust    |
| `requirements.txt` | Python  |
| `pom.xml`          | Java    |
| `.csproj`          | .NET    |
| `.git`             | Generic |

## 💡 Tips

**Fuzzy search:** Type partial names — `bill` finds `billing`, `api-ser` finds `api-server`

**Multiple workspaces:** Add all your folders:

```bash
workon config add-root ~/Developer
workon config add-root ~/personal
workon config add-root ~/clients
```

**Pin favorites:** Press `P` in the TUI or run:

```bash
workon pin toggle my-app
```

**Terminal editors (Neovim, Vim, etc.):** Register with `--terminal` so workon attaches your TTY correctly instead of launching in the background:

```bash
workon config add-command --name "Neovim" --command "nvim" --terminal
```

**Custom editors:**

```bash
workon config add-command --name "Cursor" --command "cursor"
workon config add-command --name "Zed" --command "zed"
```

**Tags:** Organize projects with tags in `.workonrc.json`:

```json
{
  "tags": ["backend", "client:acme"]
}
```

**Clean up stale pins:**

```bash
workon config cleanup-pins
```

## 🔧 Troubleshooting

**Projects not showing?**

- Run `workon config show` to verify your folders
- Increase scan depth: `workon config set-depth 5`
- Check for marker files (package.json, Cargo.toml, etc.)

**Wrong editor opening?**

- Run `workon config list-commands` to see configured editors
- Run `workon config set-default-command cursor` to change the default
- Verify the command is in `$PATH`: `which nvim`

**Terminal editor gets stuck or shows garbled output?**

- Make sure the command is registered with `--terminal`:
  `workon config add-command --name "Neovim" --command "nvim" --terminal`

**Slow scanning?**

- Reduce `maxDepth`: `workon config set-depth 2`
- Remove folders you don't need: `workon config remove-root ~/old-folder`

## ⌨️ Keyboard Shortcuts

| Key      | Action                                 |
| -------- | -------------------------------------- |
| `↑` `↓`  | Navigate list                          |
| `Enter`  | Open menu (choose editor or pin/unpin) |
| `Escape` | Clear search, then exit                |
| Type     | Search (live filter)                   |

## 📌 Help & Updates

```bash
workon --version   # Check version
workon --help      # Show all commands
npm install -g @crize2013/workon@latest  # Update to latest
```
