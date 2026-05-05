# F11 — Remote SSH Root Folders

> **Feature ID**: F11
> **Status**: Approved
> **Related**: `docs/workon.tech.md` §F11

## Purpose & Goals

Remote SSH Root Folders enables developers to register directories on remote Linux/macOS hosts (accessed over SSH) as project root folders alongside local roots. `workon` scans those remote directories to discover projects, caches the results locally for fast access, and manages remote projects identically to local ones (pinning, searching, opening).

Goals:

- G1: Let developers discover and open projects on remote SSH hosts from their local `workon` instance without extra tooling.
- G2: Make remote scan results available offline via a local cache, so the tool remains usable when the host is temporarily unreachable.
- G3: Keep the remote project experience consistent with local projects (pinning, fuzzy search, per-project config).

Out of scope (v1):

- SSH key or password management — authentication relies entirely on the SSH agent and `~/.ssh/config`.
- Non-VS Code remote openers (Zed Remote, JetBrains Gateway, etc.) — only VS Code and VS Code Insiders are supported.
- Windows remote targets — remote hosts must run Linux or macOS.
- Automatic cache invalidation or file-watching for remote directories.
- Custom port in the SSH URI — port aliasing must be configured in `~/.ssh/config`.

---

## Functional Requirements

### FR1 — Remote Root URI Format

Remote roots are identified by URIs of the form `ssh://user@hostname/absolute/path`. The `user` and `hostname` components are required; the path must be absolute (starts with `/`). No custom port is accepted in the URI — port mapping must be configured in `~/.ssh/config`.

Before storage, URIs are normalised: the hostname component is lowercased, trailing slashes on the path component are stripped, and no percent-encoding is applied to the path component. Deduplication and cache-key comparisons use normalised forms.

The global configuration schema is extended with a `remoteRoots` array (default: `[]`) that stores validated, normalised SSH URIs. This field is optional and backward-compatible — existing configs without it behave identically.

- **Trigger**: User adds or removes a remote root via CLI.
- **Behavior**: The system normalises and validates the URI structure before persisting. Invalid URIs (wrong scheme, missing user, relative path) are rejected with a clear error message and the config is not modified.
- **Output**: Normalised URI stored in the global config under `remoteRoots`.

### FR2 — Remote Root CLI Management

A new group of subcommands under `workon config` manages remote roots:

- `workon config add-remote-root <uri>` — Normalises and validates the URI, then triggers a scan of that remote root. **The URI is only saved to `remoteRoots` if the scan succeeds.** If the scan fails (host unreachable, auth error, path not found), the root is not persisted and the error is reported to the user.
- `workon config remove-remote-root <uri>` — Removes the URI from `remoteRoots` and deletes its cached scan results. If the URI is not currently configured, exits with code 1 and message `Remote root <uri> is not configured.`
- `workon config list-remote-roots` — Lists all configured remote roots, one per line. Connectivity status is derived from cache metadata (last scan timestamp) without making live SSH connections: `cached (last scanned: <date>)` or `never scanned`.

Duplicate URIs are silently deduplicated — adding the same URI twice is a no-op with message `Remote root <uri> is already configured.` and exit code 0.

- **Trigger**: User runs one of the above subcommands.
- **Behavior**: Config is validated and written atomically; scan (if triggered) runs synchronously with progress output.
- **Output**: Confirmation message on success; error message with exit code 1 on failure.

### FR3 — Remote Project Scanning

When a remote root is scanned (at add time or on demand), the system uses the standard system `ssh` binary to connect to the remote host and execute a single remote shell script that: (1) runs a `find` command bounded by `-maxdepth <config.maxDepth>` to locate project-marker files, and (2) for each discovered project directory, reads `.workonrc.json` if it exists — all within one SSH connection per host. The result is a structured text stream returned over that single connection.

Marker files are the full set used by the local scanner: `package.json`, `Cargo.toml`, `go.mod`, `requirements.txt`, `pom.xml`, `*.csproj`, `build.gradle`, `build.gradle.kts`, `*.sln`. The parent directory of each found marker file is treated as a project root. Ignore patterns from the global config are translated to `-path '*/pattern*' -prune` clauses in the `find` invocation.

- **Trigger**: Remote root added via CLI (only if URI not yet in config), or `workon scan` / `workon scan --remote` executed.
- **Behavior**: The system connects to each remote host and executes a single remote shell script over one SSH connection per host. The script runs `find <root> -maxdepth <config.maxDepth>` bounded by the same depth limit used by the local scanner, locating marker files and reading per-project configs inline. The system detects project types from the returned marker file names, merges per-project config where available, and writes all results to the local cache. Scanning continues sequentially across remote hosts; a failure on one host does not abort scanning of others.
- **Output**: Progress output per host (`Scanning ssh://user@hostname...`); summary on completion (`Found N projects on hostname`).

### FR4 — Local Scan Cache

Remote scan results are stored in a dedicated local cache file at `~/.workon-remote-cache.json` (separate from `~/.workonrc.json`). The file path may be overridden by the `WORKON_CACHE_PATH` environment variable (used in tests). The cache has the following structure:

```
{
  version: number,
  roots: {
    [normalised-ssh-uri: string]: {
      scannedAt: ISO-8601 timestamp,
      projects: CachedRemoteProject[]
    }
  }
}
```

Each `CachedRemoteProject` record contains: name, remote path (bare absolute path on host), project type, tags, description, openCommand, profile (from `.workonrc.json` if present), and the SSH host string (`user@hostname`) needed to construct the open command.

- **Trigger**: Successful completion of a remote scan.
- **Behavior**: The cache is written atomically (write to temp file, then rename). On subsequent `workon` invocations, remote projects are loaded from the cache without any SSH connection.
- **Output**: No visible output during normal load; projects appear in lists and TUI as if local.

### FR5 — On-Demand Cache Refresh

A new `workon scan` CLI command refreshes project scan results.

- `workon scan` — Rescans all roots (local + remote), prints a summary, and updates the remote cache. Local projects are always rescanned on every `workon` invocation without needing this command.
- `workon scan --remote` — Rescans only remote roots and updates the cache. No local scan is performed.

- **Trigger**: User runs `workon scan` or `workon scan --remote`.
- **Behavior**: The system performs a fresh scan of the selected scope, updates the cache, and reports results. If a remote host is unreachable during a full scan, the existing cached data for that host is retained and a warning is displayed.
- **Output**: Per-host progress and a final summary. Exit code 0 on full success; exit code 0 with warnings if some hosts were unreachable (cache preserved); exit code 1 only if no scan could complete at all.

### FR6 — Remote Project Display Marker

Remote projects are visually distinguished from local projects with the remote indicator icon `⌁` in all listing contexts.

- **Trigger**: Any project list is rendered (TUI project list, `workon list` CLI output).
- **Behavior**: The remote indicator is prepended to or placed alongside the project name. The hostname is shown as a secondary label so the user knows which host the project belongs to.
- **Output**: TUI: `⌁ project-name  [user@hostname]`; CLI (`workon list`): same inline format.

### FR7 — Remote Project Management (Pin, Search, Open)

Remote projects participate in all existing management operations identically to local projects:

- **Pinning**: A remote project can be pinned and unpinned via the TUI Launch Menu or `workon pin toggle <name>`. The full SSH URI (e.g., `ssh://user@hostname/path/to/project`) is stored as the canonical identifier in the `pinned` array. The existing pinned-path validation (which checks local filesystem existence) must place SSH URI entries in the **valid** bucket, not the invalid bucket, so that no false-positive "missing" placeholder is generated for remote pinned projects.
- **Fuzzy search**: The project name and hostname are both searchable via the existing fuzzy-search mechanism in TUI and `workon open`.
- **`workon open <name>`** and **`workon pin toggle <name>`**: When multiple projects (local or remote) match the same name, the system prints all matching projects and exits with code 1, instructing the user to be more specific. This applies to both commands.
- **`workon list`**: Remote projects appear in the list alongside local projects, sorted with pinned projects first.

### FR8 — Remote-Aware VS Code Launch

When a remote project is opened with VS Code or VS Code Insiders, the system constructs the remote-aware launch command using the project's `sshHost` and `remotePath` fields (see FR9) and the configured VS Code variant:

- VS Code: `code --remote ssh-remote+<sshHost> <remotePath>`
- VS Code Insiders: `code-insiders --remote ssh-remote+<sshHost> <remotePath>`

If the project's configured open command is not VS Code or VS Code Insiders, the system refuses to open it and displays a clear error message explaining that only VS Code variants support remote SSH projects.

- **Trigger**: User selects a remote project to open (TUI or `workon open`).
- **Behavior**: The system detects the project is remote (`isRemote === true`), validates the open command is a VS Code variant, and executes the remote-aware launch command.
- **Output**: VS Code opens the remote folder. On incompatible open command: error message `Remote projects can only be opened with VS Code or VS Code Insiders.`, exit code 1.

### FR9 — Remote Project Record & Per-Project Config

During a remote scan, if a `.workonrc.json` file is present in a discovered project directory, the system reads it within the same SSH session (see FR3) and caches its contents alongside the project record. The cached per-project config is applied at project load time (name, description, openCommand, profile, tags) without requiring an active SSH connection at open time.

The standard `Project` record is extended with the following optional fields to represent remote projects:

- `isRemote: true` — present and `true` for all remote projects; absent for local projects.
- `sshHost: string` — the SSH connection string `user@hostname`, used to construct the VS Code Remote launch command.
- `remotePath: string` — the absolute path on the remote host (e.g. `/home/alice/projects/myapp`), used as the path argument in the `--remote` flag.

For remote projects, `project.path` holds the full SSH URI (`ssh://user@hostname/path/to/project`). This is the canonical identifier used for pinning, deduplication, and cache keying. `project.remotePath` holds the bare remote path used in the launch command.

- **Trigger**: Remote scan execution.
- **Behavior**: For each discovered project, the system attempts to read `.workonrc.json`. On success, the parsed config is stored in the cache. On SSH read error or JSON parse error, the project is included with default values and a warning is logged.
- **Output**: No visible output during normal operation; warning logged on parse errors.

---

## User Experience Flow

### Flow A — Adding a Remote Root

1. User runs `workon config add-remote-root ssh://alice@devbox.corp/home/alice/projects`
2. System validates the URI format; rejects with error if invalid.
3. System connects via SSH and scans the remote directory tree (progress: `Scanning ssh://alice@devbox.corp...`).
4. System writes discovered projects to the local cache.
5. Output: `✓ Added remote root ssh://alice@devbox.corp/home/alice/projects — found 12 projects`
6. Subsequent `workon` invocations list the remote projects without any SSH connection.

### Flow B — Refreshing the Remote Cache

1. User runs `workon scan --remote`
2. System connects to each remote host sequentially and re-scans.
3. For each host: `Scanning ssh://alice@devbox.corp... found 13 projects`
4. Cache updated. If a host is unreachable: `⚠ ssh://alice@devbox.corp unreachable — using cached results from 2025-04-28`
5. Exit code 0 (with warning on unreachable hosts).

### Flow C — Opening a Remote Project via TUI

1. User launches `workon` TUI.
2. Remote projects appear in the list, each marked with `⌁` and the hostname label.
3. User navigates to a remote project and presses `Enter`.
4. Launch Menu opens. If the project's open command is VS Code, the menu shows `Open with VS Code` and (if configured) `Open with VS Code Insiders`.
5. User selects an option; system launches VS Code with `--remote ssh-remote+alice@devbox.corp /path`.
6. If the project's open command is not a VS Code variant, the menu shows `⚠ Remote projects require VS Code` and the open option is disabled.

### Flow D — Pinning a Remote Project

1. User navigates to a remote project in the TUI and presses `Enter` → Launch Menu.
2. User selects "Pin Project".
3. System stores the remote project's path in the `pinned` array.
4. Project moves to the top of the TUI list with a 📌 indicator (in addition to ⌁).

### Flow E — Removing a Remote Root

1. User runs `workon config remove-remote-root ssh://alice@devbox.corp/home/alice/projects`
2. System removes the URI from `remoteRoots` and deletes cached results for that root.
3. Output: `✓ Removed remote root ssh://alice@devbox.corp/home/alice/projects`
4. If any projects from that root were pinned, they are automatically removed from `pinned` with a warning: `⚠ Removed 3 pinned projects belonging to the removed remote root.`

---

## Non-Functional Requirements

### NFR1 — Scan Performance

- Each remote host scan must time out after 30 seconds if no SSH response is received.
- Local cache reads must complete in under 100 ms regardless of the number of cached remote projects.
- Remote scan may be slow (network dependent); progress output must be shown so the terminal does not appear frozen.
- `workon config list-remote-roots` must complete without any SSH connections (status derived from cache metadata only).

### NFR2 — Reliability & Offline Use

- `workon` must remain fully functional for local and cached remote projects when SSH hosts are unreachable.
- A stale cache is always preferred over an error when the host is offline.
- Concurrent `workon scan` invocations may overwrite each other's cache file; the last atomic rename wins. No file locking is used in v1. This is acceptable for a developer tool where simultaneous scans are unlikely.

### NFR3 — Backward Compatibility

- Existing `roots`, `pinned`, and all other config fields are unaffected.
- Users with no `remoteRoots` configured experience no behavior change.
- The local cache file is additive; its absence does not cause errors (treated as empty cache).
- Pinned-path validation (which checks local filesystem existence) must place SSH URI entries in the **valid** bucket (not the invalid bucket) to avoid false-positive "missing" markers for remote pinned projects.
- The "missing project" placeholder logic (for pinned paths not found during local scan) must exclude remote-pinned paths that are present in the remote cache.

### NFR4 — Security

- No credentials, private keys, or passphrases are stored by `workon`. Authentication is fully delegated to the SSH agent and `~/.ssh/config`.
- SSH connections use the standard system `ssh` binary; no custom SSH implementation is used.

### NFR5 — UX Clarity

- The remote indicator icon must be distinguishable in both light and dark terminal themes.
- Error messages for SSH failures must distinguish between "connection refused", "host unreachable", and "authentication failed".

---

## Test Strategy

- **Unit tests**: FR1 (URI validation), FR4 (cache read/write logic), FR8 (remote open command construction), FR9 (per-project config merging from cache).
- **Integration tests**: FR2 (config subcommands with mocked SSH), FR5 (`workon scan` with mocked SSH), FR7 (TUI rendering of remote projects with ink-testing-library).
- **Manual tests**: FR3 (actual SSH scan against a real host), FR8 (actual VS Code Remote SSH launch).

---

## Edge Cases & Error Handling

### EC1 — SSH Connection Refused or Timed Out During Scan

- **Scenario**: The remote host is offline or unreachable when a scan is attempted.
- **Expected behavior**: The system skips that host, retains any existing cached results, and continues scanning other hosts. A warning is printed.
- **User feedback**: `⚠ ssh://user@hostname unreachable — using cached results from <date>`. If no cache exists: `⚠ ssh://user@hostname unreachable — no cached results available`.

### EC2 — Remote Root Path Does Not Exist on Host

- **Scenario**: The SSH connection succeeds but the configured path does not exist on the remote host.
- **Expected behavior**: The system treats this as a scan error for that root; no projects are cached for it. An error is displayed.
- **User feedback**: `✗ Remote path /home/alice/projects does not exist on devbox.corp`.

### EC3 — Duplicate Remote Root Added

- **Scenario**: User runs `add-remote-root` with a URI already in `remoteRoots`.
- **Expected behavior**: No-op. Config is not modified, no scan is triggered.
- **User feedback**: `Remote root ssh://user@hostname/path is already configured.` Exit code 0.

### EC4 — Remote Project Pinned, Host Goes Offline

- **Scenario**: A project was pinned while reachable; the host is later offline and a new scan fails.
- **Expected behavior**: The pinned project remains in the list (from cache) with both the 📌 and ⌁ indicators. The `missing` flag is not set unless the project was explicitly removed from cache.
- **User feedback**: Normal display using cached data; no error unless the user attempts to open it.

### EC5 — Remote Project Opening with Incompatible Command

- **Scenario**: User attempts to open a remote project whose configured open command is not a VS Code variant (e.g., Neovim).
- **Expected behavior**: System refuses to open and shows an error.
- **User feedback**: `Remote projects can only be opened with VS Code or VS Code Insiders.` Exit code 1 (CLI) or disabled option in TUI Launch Menu.

### EC6 — Name Collision Between Local and Remote Project

- **Scenario**: A local project and a remote project share the same name.
- **Expected behavior**: Both appear in lists; the remote one is distinguished by its ⌁ indicator and hostname label. Fuzzy search returns both; the user selects one from the result list.
- **User feedback**: No error. Both entries are shown with their respective indicators.

### EC7 — Malformed or Missing `.workonrc.json` on Remote

- **Scenario**: A remote project's `.workonrc.json` exists but contains invalid JSON or unknown fields.
- **Expected behavior**: The project is included in scan results with default values; the malformed config is ignored and a warning is logged to the scan output.
- **User feedback**: `⚠ Could not parse .workonrc.json for project-name on devbox.corp — using defaults`.

### EC8 — Cache File Corrupted or Missing

- **Scenario**: The local cache file is deleted or has become corrupt (invalid JSON).
- **Expected behavior**: The system treats the cache as empty and loads zero remote projects. No error is thrown; a warning suggests running `workon scan --remote` to repopulate.
- **User feedback**: `⚠ Remote project cache is empty or corrupted. Run 'workon scan --remote' to rebuild.` (shown once, non-fatal).

### EC9 — Overlapping Remote Roots

- **Scenario**: `remoteRoots` contains both `ssh://user@host/home/alice` and `ssh://user@host/home/alice/projects`. Both roots are scanned independently; subdirectories of `projects/` are discovered via each root, producing candidate duplicates.
- **Expected behavior**: The merged project list is deduplicated by full remote path URI. A project discovered under two overlapping roots appears only once, associated with the more specific (deeper) root.
- **User feedback**: No error; deduplication is silent.

### EC10 — `remove-remote-root` for Non-Configured URI

- **Scenario**: User runs `workon config remove-remote-root <uri>` with a URI not in `remoteRoots`.
- **Expected behavior**: Command exits with code 1 and a clear message.
- **User feedback**: `Remote root <uri> is not configured.`

---

## Acceptance Criteria

- [ ] AC1: When a user runs `workon config add-remote-root ssh://user@hostname/path` with a valid URI and reachable host, the URI is stored in the global config and a scan of that remote root is performed immediately.
- [ ] AC2: When a user runs `workon config add-remote-root` with an invalid URI (missing user, non-absolute path, or wrong scheme), the command exits with code 1 and the config is not modified.
- [ ] AC3: After a successful remote root scan, subsequent `workon` invocations load remote projects from the local cache without establishing any SSH connection.
- [ ] AC4: Remote projects are displayed with the `⌁` remote indicator and the hostname label in both the TUI and `workon list` output.
- [ ] AC5: When a user opens a remote project configured to use VS Code, the system executes `code --remote ssh-remote+user@hostname /path` and exits with code 0.
- [ ] AC6: When a user attempts to open a remote project whose open command is not VS Code or VS Code Insiders, the system refuses with an error message and exits with code 1.
- [ ] AC7: Running `workon scan --remote` re-scans all remote roots and updates the cache; projects discovered in the new scan are reflected in subsequent `workon` invocations.
- [ ] AC8: When a remote host is unreachable during `workon scan --remote` and a cache exists, the existing cache is preserved, a warning is shown, and the command exits with code 0.
- [ ] AC9: A remote project can be pinned and unpinned using the TUI Launch Menu or `workon pin toggle`; the pin persists across sessions.
- [ ] AC10: A remote project can be found via fuzzy search by its name or hostname in both the TUI and `workon open`.
- [ ] AC11: Running `workon config remove-remote-root <uri>` removes the URI from config, deletes its cached results, and removes any pinned projects belonging to that root with a warning.
- [ ] AC12: Adding the same remote root URI twice results in a no-op with a clear message; the config is not modified.
- [ ] AC13: When the cache file is absent or corrupted, `workon` starts without error, shows zero remote projects, and suggests running `workon scan --remote`.
- [ ] AC14: Per-project `.workonrc.json` read from a remote host during scan is cached and applied to the project (name, description, openCommand, tags) without requiring SSH at open time.
- [ ] AC15: When `workon open <name>` matches both a local and a remote project with the same name, the command prints all matches and exits with code 1 instructing the user to be more specific.
- [ ] AC16: Running `workon config remove-remote-root <uri>` with a URI that is not configured exits with code 1 and message `Remote root <uri> is not configured.`
- [ ] AC17: Two remote roots with overlapping paths on the same host produce no duplicate projects in the merged list.
- [ ] AC18: When `workon pin toggle <name>` matches both a local and a remote project with the same name, the command prints all matching projects and exits with code 1 instructing the user to be more specific.
