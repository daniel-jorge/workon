# 🚀 workon

Find and open your projects instantly from the terminal.

**What it does:** Scans your disk for projects, lets you search them by name, and opens them with your preferred editor (VS Code, Cursor, Zed, Neovim, etc.). Pin your favorites for quick access. Supports remote projects on SSH hosts.

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
workon scan                    # Rescan local + remote roots
workon scan --remote           # Rescan remote roots only
workon pin list                # Show pinned projects
workon pin open <name>         # Open a pinned project
workon pin toggle <name>       # Pin or unpin a project
workon config show             # Show your configuration
workon config add-root <path>  # Add a folder to scan
workon config remove-root <path>              # Remove a scan folder
workon config add-remote-root <ssh-uri>       # Add a remote SSH root
workon config remove-remote-root <ssh-uri>    # Remove a remote SSH root
workon config list-remote-roots               # List configured remote roots
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
- `pinned` — Your pinned project paths (local paths or `ssh://` URIs)
- `ignore` — Glob patterns to skip during scanning
- `remoteRoots` — SSH root URIs to scan (managed via `workon config add-remote-root`)

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

## 🌐 Remote SSH Projects

workon can discover and open projects on remote SSH hosts, keeping them available offline via a local cache.

**Requirements:**

- SSH access to the remote host (via SSH agent or `~/.ssh/config`)
- VS Code or VS Code Insiders (other editors cannot open remote folders)

### Quick Start

```bash
# 1. Add a remote root (triggers an initial scan)
workon config add-remote-root ssh://alice@devbox.corp/home/alice/projects

# 2. Remote projects appear immediately in the TUI and list
workon
workon list        # shows: ⌁ api-service  [alice@devbox.corp]

# 3. Open a remote project — VS Code Remote SSH is launched automatically
workon open api-service
# runs: code --remote ssh-remote+alice@devbox.corp /home/alice/projects/api-service

# 4. Refresh the remote cache when projects change on the host
workon scan --remote
```

### Remote Root URI Format

Remote roots use the format `ssh://user@hostname/absolute/path`:

```bash
workon config add-remote-root ssh://alice@devbox.corp/home/alice/projects
workon config add-remote-root ssh://bob@build.internal/home/bob/work
```

- The `user` and `hostname` components are required
- The path must be absolute (start with `/`)
- Custom ports are not supported in the URI — configure them in `~/.ssh/config`
- Hostnames are normalised to lowercase before storage

### Managing Remote Roots

```bash
# Add a remote root (validates URI, scans, then saves)
workon config add-remote-root ssh://alice@devbox.corp/home/alice/projects

# List configured remote roots with cache status
workon config list-remote-roots
# ssh://alice@devbox.corp/home/alice/projects  cached (last scanned: 2025-04-28)
# ssh://bob@build.internal/home/bob/work       never scanned

# Remove a remote root (also clears its cache and any pinned remote projects)
workon config remove-remote-root ssh://alice@devbox.corp/home/alice/projects
```

### Offline Use

Remote projects are cached locally at `~/.workon-remote-cache.json`. Once scanned, they appear in `workon list` and the TUI even when the SSH host is unreachable. Refresh the cache whenever you need up-to-date results:

```bash
workon scan --remote
```

If a host is unreachable during a scan, the existing cached results are preserved and a warning is shown. Exit code remains 0.

### Pinning Remote Projects

Remote projects can be pinned just like local ones:

```bash
workon pin toggle api-service
```

The full SSH URI is stored as the pin identifier. Pinned remote projects are loaded from cache and are never shown as "missing" while the cache is valid.

### Per-Project Config on Remote Hosts

If a `.workonrc.json` exists in a remote project directory, workon reads it during the scan and caches the result. The `name`, `description`, `openCommand`, `profile`, and `tags` overrides are applied at load time — no SSH connection is needed when opening the project.

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

The same markers are used for remote scanning.

## 💡 Tips

**Fuzzy search:** Type partial names — `bill` finds `billing`, `api-ser` finds `api-server`

**Search by hostname:** Type part of the hostname to find remote projects — `devbox` finds all projects on `devbox.corp`

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

**Remote projects not showing?**

- Run `workon scan --remote` to refresh the cache
- Check SSH access: `ssh alice@devbox.corp echo ok`
- Run `workon config list-remote-roots` to verify the URI is stored correctly

**"Remote projects can only be opened with VS Code or VS Code Insiders"**

- Only `code` and `code-insiders` support the `--remote ssh-remote+` flag
- Update the project's `openCommand` in its `.workonrc.json` on the remote host, then re-scan

**Remote cache is corrupted?**

- Run `workon scan --remote` to rebuild it
- Or delete `~/.workon-remote-cache.json` and re-scan

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
