# 🚀 workon

Find and open your projects instantly from the terminal.

**What it does:** Scans your disk for projects, lets you search them by name, and opens them with your preferred editor (VS Code, Cursor, Zed, etc.). Pin your favorites for quick access.

## 📦 Installation

```bash
npm install -g @crize2013/workon
```

## 🎯 Getting Started

**1. Add your project folders:**

```bash
workon config add ~/Developer
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
workon              # Interactive search and open (main command)
workon open <name>  # Open a project directly (no TUI)
workon list         # List all projects
workon init         # Create .workonrc.json in current directory
workon pin list     # Show pinned projects
workon pin open <name>     # Open a pinned project
workon config show  # Show your configuration
workon config add <path>   # Add a folder to scan
```

**Examples:**

```bash
workon config add ~/projects
workon open billing
workon pin toggle my-app
```

## ⚙️ Configuration

By default, workon creates `~/.workonrc.json` with sensible defaults. You can customize it:

```bash
workon config show                    # View your config
workon config add ~/Developer         # Add a scan folder
workon config set-open-command cursor # Change default editor
workon config set-depth 5             # Change scan depth
```

**Config file options:**

- `roots` — Folders to scan for projects
- `maxDepth` — How many levels deep to scan (default: 3)
- `defaultOpenCommand` — Default editor to use (default: `code`)
- `openCommands` — Available open options (add custom editors here)
- `defaultProfile` — VS Code profile to use
- `pinned` — Your pinned projects

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
workon config add ~/Developer
workon config add ~/personal
workon config add ~/clients
```

**Pin favorites:** Press `P` in the TUI or run:

```bash
workon pin toggle my-app
```

**Custom editors:** Add to your config:

```json
{
  "openCommands": [
    { "name": "Cursor", "command": "cursor" },
    { "name": "Zed", "command": "zed" },
    { "name": "Neovim", "command": "nvim" }
  ]
}
```

**Tags:** Organize projects with tags in `.workonrc.json`:

```json
{
  "tags": ["backend", "client:acme"]
}
```

## 🔧 Troubleshooting

**Projects not showing?**

- Run `workon config show` to verify your folders
- Increase scan depth: `workon config set-depth 5`
- Check for marker files (package.json, Cargo.toml, etc.)

**Wrong editor opening?**

- Check `workon config show` for `defaultOpenCommand`
- Verify the command is installed: `which code` or `which cursor`
- Use `workon config set-open-command cursor` to change

**Slow scanning?**

- Reduce `maxDepth`: `workon config set-depth 2`
- Remove folders you don't need: `workon config remove ~/old-folder`

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
