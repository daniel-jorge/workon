# F11 — Remote SSH Root Folders: Implementation Plan

## TL;DR

Extend `workon` to discover and manage projects on remote SSH hosts. Introduces a URI validation module, an SSH scanning module, a local JSON cache, three new `config` subcommands, a new `scan` command, and remote-aware rendering in the TUI. Remote projects integrate with all existing features (pinning, fuzzy search, `workon open`) behind a local cache so the tool remains offline-functional.

---

## Phases

### Phase 1 — Schema & Type Changes (blocks Phase 2)

**1. Extend `Project` type** in `src/types.ts`

- Add `isRemote?: true` — present only for remote projects
- Add `sshHost?: string` — `user@hostname`, used to build VS Code Remote command
- Add `remotePath?: string` — bare absolute path on remote host

**2. Extend `GlobalConfigSchema`** in `src/core/config.ts`

- Add `remoteRoots: z.array(z.string()).default([])` — stores validated, normalised SSH URIs
- No migration needed; field is optional and backward-compatible

---

### Phase 2 — Core Logic (blocks Phase 3)

**3. Create `src/core/remote-uri.ts`** — pure URI operations

- `validateAndNormalizeSSHUri(uri: string): string` — validates scheme, user, hostname, absolute path; normalises hostname to lowercase, strips trailing slash; throws Error with user-facing message on invalid input
- `parseSSHUri(uri: string): { user: string; hostname: string; path: string; sshHost: string; normalizedUri: string }` — parses after validation

**4. Create `src/core/remote-cache.ts`** — cache I/O

- `getCachePath(): string` — returns `WORKON_CACHE_PATH` env var or `~/.workon-remote-cache.json`
- `loadRemoteCache(): RemoteCache` — reads and validates cache; returns empty cache on missing or invalid file (with warning flag in result); uses `RemoteCacheSchema` (Zod)
- `saveRemoteCache(cache: RemoteCache): void` — atomic write (tmp → rename)
- `RemoteCacheSchema` and `CachedRemoteProject` types
- `deduplicateRemoteProjects(projects: CachedRemoteProject[]): CachedRemoteProject[]` — dedup by `remotePath`

**5. Create `src/core/remote-scan.ts`** — SSH scanning

- `scanRemoteRoot(uri: string, config: GlobalConfig): Promise<{ projects: CachedRemoteProject[]; error?: string }>` — spawns `ssh` via `execa`, runs embedded shell script; 30s timeout; returns projects or error string
- `buildRemoteScanScript(rootPath: string, maxDepth: number, ignorePatterns: string[]): string` — constructs the `find`-based shell script with prune clauses for ignore patterns and per-project `.workonrc.json` reads
- `parseRemoteScanOutput(raw: string, sshHost: string, rootPath: string): CachedRemoteProject[]` — parses the structured text output from the remote script

**6. Modify `src/core/pinning.ts`**

- `validatePinnedPaths()`: SSH URIs (starting with `ssh://`) go into `valid` bucket, not `invalid`; only local paths are checked against the filesystem

**7. Modify `src/core/launcher.ts`**

- `openProject()`: if `project.isRemote === true`, validate `openCommand` is `code` or `code-insiders`; if not, throw `Error("Remote projects can only be opened with VS Code or VS Code Insiders.")`; if valid, run `code --remote ssh-remote+<sshHost> <remotePath>` (no profile for remote projects)

**8. Modify `src/core/scanner.ts`**

- Import `loadRemoteCache()` and convert cached remote projects to `Project` objects
- Merge remote projects with local ones; preserve sorting (pinned first, then alphabetical)
- Skip placeholder ("missing") logic for remote paths that are present in the cache — only generate "missing" placeholder for remote paths that are pinned but NOT in the remote cache
- Deduplicate merged list by `project.path` (SSH URI) — handles overlapping remote roots (EC9)

**9. Modify `src/core/search.ts`**

- Add `sshHost` to Fuse.js search keys so hostname is searchable (AC10)

---

### Phase 3 — Tests (blocks Phase 4)

**10. Create `tests/remote-uri.test.ts`**

- `validateAndNormalizeSSHUri`: valid URIs, lowercase hostname, strip trailing slash
- Invalid URIs: wrong scheme, missing user, relative path, missing hostname, not-a-URI (AC2, EC outline)
- Duplicate detection after normalization (EC3, EC9)

**11. Create `tests/remote-cache.test.ts`**

- `loadRemoteCache`: returns empty cache when file missing; returns empty cache + warning when file corrupted (AC13, EC8)
- `saveRemoteCache`: writes valid JSON atomically; reads back correctly
- `deduplicateRemoteProjects`: removes duplicates by `remotePath`

**12. Create `tests/remote-scanner.test.ts`** (mocking `execa` / ssh subprocess)

- `scanRemoteRoot`: returns projects on success; returns error string on SSH failure
- `parseRemoteScanOutput`: parses structured output correctly; handles malformed `.workonrc.json` (EC7)

**13. Create `tests/remote-integration.test.ts`** — config subcommands + scanner integration (mock SSH)

- `add-remote-root`: valid URI + scan succeeds → stored + cache written (AC1)
- `add-remote-root`: duplicate → no-op message (AC12, EC3)
- `add-remote-root`: duplicate after normalization → no-op (EC3)
- `add-remote-root`: invalid URI → error, not stored (AC2)
- `add-remote-root`: SSH fail → not stored (FR2: only saved if scan succeeds)
- `remove-remote-root`: removes URI, cache entries, pinned projects (AC11)
- `remove-remote-root`: non-configured URI → exit 1 (AC16, EC10)
- `list-remote-roots`: shows roots with `cached (last scanned: ...)` or `never scanned` (FR2)
- Scanner: loads remote projects from cache (AC3)
- Scanner: remote projects have `isRemote`, `sshHost`, `remotePath` (AC4)
- Scanner: overlapping roots deduplicated (AC17)
- Scanner: missing/corrupted cache → zero remote projects, no crash (AC13)
- Pinning: SSH URIs placed in `valid` bucket (NFR3)
- Launcher: remote project with `code` → `code --remote ssh-remote+...` (AC5)
- Launcher: remote project with non-VS Code command → throws (AC6)
- `workon open`: same name → disambiguation message, exit 1 (AC15)
- `workon pin toggle`: same name → disambiguation message, exit 1 (AC18)
- `workon scan --remote`: re-scans and updates cache (AC7)
- `workon scan --remote`: unreachable host with existing cache → preserves cache, exit 0 (AC8)
- Per-project config cached and applied without SSH (AC14)
- Pinning a remote project uses SSH URI (AC9)

---

### Phase 4 — CLI Wiring (blocks Phase 5)

**14. Modify `src/commands/config.ts`** — add three subcommands

- `workon config add-remote-root <uri>`: validate + normalise URI; check if already configured (no-op); run SSH scan; if scan succeeds, store URI and write cache; if scan fails, do not store; print progress and result
- `workon config remove-remote-root <uri>`: normalise URI; validate it is in config; remove from `remoteRoots`; delete cache entries for that root; remove any pinned paths belonging to that root; print result with warning if pinned items removed
- `workon config list-remote-roots`: list each remote root with cache-derived status (no SSH); derive `scannedAt` from cache metadata

**15. Create `src/commands/scan.ts`**

- `workon scan`: rescan all local roots (via `scanProjects`) + all remote roots; update cache
- `workon scan --remote`: rescan only remote roots; update cache; preserves cache for unreachable hosts; exit 0 with warning

**16. Modify `src/cli.ts`**

- Import and register `registerScanCommand`

**17. Modify `src/commands/open.ts`**

- After fuzzy search, if multiple matches span local AND remote with the same name: print disambiguation list and exit 1 (AC15)
- For single remote match: delegate to `openProject()` (launcher handles remote command construction)

**18. Modify `src/commands/pin.ts`** — `togglePinCli`

- After fuzzy search, if multiple matches span local AND remote with the same name: print disambiguation list and exit 1 (AC18)
- Use `project.path` (SSH URI for remote) as the pin identifier

**19. Modify `src/commands/list.ts`**

- Format remote projects with `⌁ name  [user@hostname]` (AC4)
- Pinned remote projects show `📌 ⌁ name  [user@hostname]`

---

### Phase 5 — TUI Layer

**20. Modify `src/tui/ProjectList.tsx`**

- Render remote indicator: if `project.isRemote`, display `⌁ name  [sshHost]` instead of bare `name`
- Pinned remote projects show both `📌` and `⌁` indicators (AC4)

**21. Modify `src/tui/LaunchMenu.tsx`**

- If `project.isRemote` and `openCommand` is not `code` / `code-insiders`: show `⚠ Remote projects require VS Code` and disable the open option (EC5)

---

## Relevant Files

### To Modify

- `src/types.ts` — add `isRemote`, `sshHost`, `remotePath` to `Project` (lines 1–18)
- `src/core/config.ts` — add `remoteRoots` to schema (lines ~30–45)
- `src/core/pinning.ts` — SSH URIs in valid bucket (lines ~30–45)
- `src/core/launcher.ts` — remote-aware VS Code launch (entire 15-line file)
- `src/core/scanner.ts` — merge remote cache projects (lines ~1–70)
- `src/core/search.ts` — add `sshHost` to Fuse keys (line ~7)
- `src/commands/config.ts` — add three subcommands (lines ~175–end)
- `src/commands/open.ts` — disambiguation + remote (entire 16-line file)
- `src/commands/pin.ts` — disambiguation for remote (lines ~40–65)
- `src/commands/list.ts` — remote indicator formatting (entire 9-line file)
- `src/cli.ts` — register scan command (lines ~1–25)
- `src/tui/ProjectList.tsx` — ⌁ indicator rendering
- `src/tui/LaunchMenu.tsx` — disable open for non-VS Code remote

### To Create

- `src/core/remote-uri.ts` — URI validation and normalization
- `src/core/remote-cache.ts` — local JSON cache read/write
- `src/core/remote-scan.ts` — SSH scanning via system `ssh`
- `src/commands/scan.ts` — `workon scan` / `workon scan --remote`
- `tests/remote-uri.test.ts` — URI validation unit tests
- `tests/remote-cache.test.ts` — cache read/write tests
- `tests/remote-scanner.test.ts` — SSH scan logic tests (mocked)
- `tests/remote-integration.test.ts` — config subcommands + scanner integration

---

## Tests to Add / Update

| File                               | Coverage                                                            |
| ---------------------------------- | ------------------------------------------------------------------- |
| `tests/remote-uri.test.ts`         | FR1: all valid + invalid URI shapes, normalization, dedup detection |
| `tests/remote-cache.test.ts`       | FR4: cache load/save, corruption handling, atomic write             |
| `tests/remote-scanner.test.ts`     | FR3: SSH script output parsing, malformed config handling           |
| `tests/remote-integration.test.ts` | FR2, FR5, FR7, FR8, FR9: all AC1–AC18                               |
| `tests/pinning.test.ts`            | Update `validatePinnedPaths` tests — SSH URIs in valid bucket       |

---

## Verification Checklist

- [ ] `pnpm test` passes (all tests green)
- [ ] `pnpm build` succeeds with no TypeScript errors
- [ ] `pnpm lint` passes
- [ ] Manual: `workon config add-remote-root ssh://user@host/path` validates and displays scan progress
- [ ] Manual: `workon config list-remote-roots` shows status without SSH
- [ ] Manual: `workon list` shows ⌁ indicator for remote projects
- [ ] Manual: `workon scan --remote` refreshes cache
- [ ] Manual: `workon open <remote-project>` launches VS Code with `--remote ssh-remote+...`

---

## Decisions

### Why a separate cache file (`~/.workon-remote-cache.json`)?

Keeps the main config (`~/.workonrc.json`) small and human-editable. The cache can be large (many remote projects) and is disposable — it can always be rebuilt with `workon scan --remote`.

### Why `WORKON_CACHE_PATH` env var (not `WORKON_REMOTE_CACHE_PATH`)?

Shorter and consistent with the `WORKONRC_PATH` pattern already used for tests.

### Why only store URI in `remoteRoots` after a successful scan?

FR2 specifies: "The URI is only saved to `remoteRoots` if the scan succeeds." This prevents the config from containing unreachable or invalid roots that will always fail.

### Why deduplicate by `project.path` (full SSH URI) rather than by project name?

Project names are not unique; the same name can exist on multiple remote hosts or locally. The SSH URI (`ssh://user@host/path/to/project`) is the canonical identifier.

### Why SSH URIs in the `valid` bucket of `validatePinnedPaths`?

`validatePinnedPaths` checks filesystem existence with `existsSync`, which fails for `ssh://` paths. Remote-pinned projects should never be marked "missing" — they're managed via the cache, not the local filesystem.

### Why no atomic write on cache vs. spec requires atomic on config?

Both use atomic write (tmp → rename). The spec (FR4) explicitly requires it for the cache too.

### Disambiguation for `open` and `pin toggle` (AC15, AC18)

When multiple projects match the same fuzzy query and span both local and remote, listing all matches and exiting with code 1 is the safest behavior — avoids silently operating on the wrong project.
