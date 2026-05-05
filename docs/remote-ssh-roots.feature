Feature: Remote SSH Root Folders
  Developers can register directories on remote Linux/macOS hosts as project root folders.
  workon scans those directories via SSH, caches results locally, and manages remote projects
  identically to local ones (pinning, searching, opening via VS Code Remote SSH).

  # ===== HAPPY PATH — Remote Root Configuration =====
  # Covers AC1, AC3, AC12

  Scenario: Add a valid remote root URI with a reachable host
    Given the SSH host "devbox.corp" is reachable as "alice"
    And the remote path "/home/alice/projects" exists on "devbox.corp"
    When the user runs: workon config add-remote-root ssh://alice@devbox.corp/home/alice/projects
    Then the output should display: "Scanning ssh://alice@devbox.corp..."
    And the output should display: "✓ Added remote root ssh://alice@devbox.corp/home/alice/projects"
    And "ssh://alice@devbox.corp/home/alice/projects" should be stored in remoteRoots in ~/.workonrc.json
    And the CLI should exit with code 0

  Scenario: Subsequent workon invocations load remote projects from cache without SSH
    Given a remote root "ssh://alice@devbox.corp/home/alice/projects" is configured
    And a successful scan has populated the local cache
    And the SSH host "devbox.corp" is unreachable
    When the user runs: workon list
    Then remote projects from the cache should appear in the output
    And no SSH connection should be attempted
    And the CLI should exit with code 0

  Scenario: URI hostname is normalised to lowercase before storage
    Given the SSH host "DevBox.Corp" is reachable as "alice"
    And the remote path "/home/alice/projects" exists on "DevBox.Corp"
    When the user runs: workon config add-remote-root ssh://alice@DevBox.Corp/home/alice/projects
    Then "ssh://alice@devbox.corp/home/alice/projects" should be stored in remoteRoots in ~/.workonrc.json
    And the CLI should exit with code 0

  Scenario: Adding the same remote root URI twice is a no-op
    Given "ssh://alice@devbox.corp/home/alice/projects" is already configured in remoteRoots
    When the user runs: workon config add-remote-root ssh://alice@devbox.corp/home/alice/projects
    Then the output should display: "Remote root ssh://alice@devbox.corp/home/alice/projects is already configured."
    And no SSH connection should be attempted
    And remoteRoots should remain unchanged
    And the CLI should exit with code 0

  # ===== HAPPY PATH — Remote Project Discovery & Display =====
  # Covers AC4, AC14

  Scenario: Remote projects shown with ⌁ indicator and hostname label in TUI
    Given a remote root "ssh://alice@devbox.corp/home/alice/projects" is configured
    And the cache contains remote projects: "api-service", "frontend"
    When the user launches: workon
    Then the TUI should display "⌁ api-service  [alice@devbox.corp]"
    And the TUI should display "⌁ frontend  [alice@devbox.corp]"

  Scenario: Remote projects shown with ⌁ indicator and hostname label in workon list
    Given a remote root "ssh://alice@devbox.corp/home/alice/projects" is configured
    And the cache contains remote projects: "api-service", "frontend"
    When the user runs: workon list
    Then the output should include "⌁ api-service  [alice@devbox.corp]"
    And the output should include "⌁ frontend  [alice@devbox.corp]"
    And the CLI should exit with code 0

  Scenario: Cached per-project .workonrc.json is applied at open time without SSH
    Given a remote root "ssh://alice@devbox.corp/home/alice/projects" is configured
    And the cache contains project "api-service" with per-project config:
      | field       | value          |
      | name        | API Service    |
      | description | Core API layer |
      | openCommand | code           |
      | tags        | backend, api   |
    And the SSH host "devbox.corp" is unreachable
    When the user runs: workon list
    Then the project should appear as "API Service" with description "Core API layer"
    And no SSH connection should be attempted
    And the CLI should exit with code 0

  # ===== HAPPY PATH — Remote Root Status Listing =====
  # Covers FR2 (list-remote-roots; no dedicated AC)

  Scenario: workon config list-remote-roots shows configured roots with cache-derived status
    Given the following remote roots are configured:
      | uri                                          | scannedAt            |
      | ssh://alice@devbox.corp/home/alice/projects  | 2025-04-28T10:00:00Z |
      | ssh://bob@buildbox.internal/home/bob/work    | never                |
    When the user runs: workon config list-remote-roots
    Then the output should display:
      """
      ssh://alice@devbox.corp/home/alice/projects  cached (last scanned: 2025-04-28)
      ssh://bob@buildbox.internal/home/bob/work    never scanned
      """
    And no SSH connection should be attempted
    And the CLI should exit with code 0

  # ===== HAPPY PATH — Opening Remote Projects =====
  # Covers AC5, FR8

  Scenario Outline: Open a remote project with a VS Code variant
    Given a remote project "api-service" is cached with:
      | field       | value                                    |
      | sshHost     | alice@devbox.corp                        |
      | remotePath  | /home/alice/projects/api-service         |
      | openCommand | <openCommand>                            |
    When the user runs: workon open api-service
    Then the system should execute: <expectedCommand>
    And the CLI should exit with code 0

    Examples:
      | openCommand   | expectedCommand                                                                      |
      | code          | code --remote ssh-remote+alice@devbox.corp /home/alice/projects/api-service          |
      | code-insiders | code-insiders --remote ssh-remote+alice@devbox.corp /home/alice/projects/api-service |

  # ===== HAPPY PATH — On-Demand Cache Refresh =====
  # Covers AC7, AC8, FR5

  Scenario: workon scan --remote refreshes cache and reflects new projects
    Given a remote root "ssh://alice@devbox.corp/home/alice/projects" is configured
    And the SSH host "devbox.corp" is reachable
    And a new project "new-service" has been added to the remote host since the last scan
    When the user runs: workon scan --remote
    Then the output should display: "Scanning ssh://alice@devbox.corp..."
    And the output should display a summary: "Found N projects on devbox.corp"
    And the cache should be updated with "new-service"
    And the CLI should exit with code 0

  Scenario: workon scan --remote with unreachable host preserves existing cache
    Given a remote root "ssh://alice@devbox.corp/home/alice/projects" is configured
    And the cache contains 5 projects from a previous scan dated "2025-04-28"
    And the SSH host "devbox.corp" is currently unreachable
    When the user runs: workon scan --remote
    Then the output should display: "⚠ ssh://alice@devbox.corp unreachable — using cached results from 2025-04-28"
    And the cache should still contain the 5 previously cached projects
    And the CLI should exit with code 0

  # ===== HAPPY PATH — Remote Root Removal =====
  # Covers AC11

  Scenario: remove-remote-root removes URI, cache, and pinned projects with warning
    Given a remote root "ssh://alice@devbox.corp/home/alice/projects" is configured
    And 3 projects from that remote root are pinned
    When the user runs: workon config remove-remote-root ssh://alice@devbox.corp/home/alice/projects
    Then the output should display: "✓ Removed remote root ssh://alice@devbox.corp/home/alice/projects"
    And the output should display: "⚠ Removed 3 pinned projects belonging to the removed remote root."
    And "ssh://alice@devbox.corp/home/alice/projects" should no longer appear in remoteRoots
    And the cache entries for that remote root should be deleted
    And the CLI should exit with code 0

  # ===== HAPPY PATH — Pinning & Fuzzy Search Parity =====
  # Covers AC9, AC10

  Scenario: Pin a remote project via TUI Launch Menu
    Given the TUI is displaying the project list
    And the remote project "api-service" is visible as "⌁ api-service  [alice@devbox.corp]"
    When the user navigates to "api-service"
    And the user presses Enter to open the Launch Menu
    And the user navigates to "Pin Project" and presses Enter
    Then "api-service" should be marked with both 📌 and ⌁ indicators
    And "api-service" should move to the top of the project list
    And the SSH URI "ssh://alice@devbox.corp/home/alice/projects/api-service" should be added to the pinned array in ~/.workonrc.json
    And the Launch Menu should close and TUI should update

  Scenario: Pin and unpin a remote project via CLI
    Given a remote project "api-service" is cached for host "alice@devbox.corp"
    When the user runs: workon pin toggle api-service
    Then the output should display: "✓ Pinned api-service"
    And the SSH URI for "api-service" should be added to the pinned array in ~/.workonrc.json
    And the CLI should exit with code 0
    When the user runs: workon pin toggle api-service
    Then the output should display: "✓ Unpinned api-service"
    And the SSH URI for "api-service" should be removed from the pinned array in ~/.workonrc.json
    And the CLI should exit with code 0

  Scenario: Find a remote project by name via TUI fuzzy search
    Given the TUI is displaying the project list
    And the cache contains remote projects: "api-service", "frontend-app", "worker-daemon"
    When the user types "api" in the TUI search bar
    Then "⌁ api-service  [alice@devbox.corp]" should appear in the filtered results

  Scenario: Find a remote project by hostname via workon open
    Given a remote project "api-service" is cached with sshHost "alice@devbox.corp" and remotePath "/home/alice/projects/api-service"
    When the user runs: workon open devbox
    Then the system should execute: code --remote ssh-remote+alice@devbox.corp /home/alice/projects/api-service
    And the CLI should exit with code 0

  # ===== EDGE CASES — Connection & Availability =====
  # Covers EC1, EC2, EC4

  Scenario: SSH host unreachable during scan with no existing cache
    Given a remote root "ssh://alice@devbox.corp/home/alice/projects" is configured
    And no cache exists for that remote root
    And the SSH host "devbox.corp" is unreachable
    When the user runs: workon scan --remote
    Then the output should display: "⚠ ssh://alice@devbox.corp unreachable — no cached results available"
    And the CLI should exit with code 0

  Scenario: Remote path does not exist on host when adding remote root
    Given the SSH host "devbox.corp" is reachable as "alice"
    But the path "/home/alice/nonexistent" does not exist on "devbox.corp"
    When the user runs: workon config add-remote-root ssh://alice@devbox.corp/home/alice/nonexistent
    Then the output should display: "✗ Remote path /home/alice/nonexistent does not exist on devbox.corp"
    And "ssh://alice@devbox.corp/home/alice/nonexistent" should not be stored in remoteRoots
    And the CLI should exit with code 1

  Scenario: Pinned remote project is shown from cache when host goes offline
    Given a remote project "api-service" is pinned and present in the local cache
    And the SSH host "devbox.corp" is offline (no scan possible)
    When the user launches: workon
    Then "api-service" should appear in the TUI with both 📌 and ⌁ indicators
    And the "missing" flag should not be applied to the project
    And no error should be shown for the pinned remote project

  # ===== EDGE CASES — Config & Cache Integrity =====
  # Covers EC3, EC7, EC8, EC9, AC13, AC17

  Scenario: Normalised duplicate URI is also detected and deduplicated
    Given "ssh://alice@devbox.corp/home/alice/projects" is already configured in remoteRoots
    When the user runs: workon config add-remote-root ssh://alice@DevBox.Corp/home/alice/projects/
    Then the output should display: "Remote root ssh://alice@devbox.corp/home/alice/projects is already configured."
    And remoteRoots should remain unchanged
    And the CLI should exit with code 0

  Scenario: Malformed .workonrc.json on remote host is included with defaults and a warning
    Given the SSH host "devbox.corp" is reachable
    And the project "bad-config-app" on "devbox.corp" has an unparseable .workonrc.json
    When the user runs: workon scan --remote
    Then the project "bad-config-app" should still appear in the scan results with default values
    And the output should display: "⚠ Could not parse .workonrc.json for bad-config-app on devbox.corp — using defaults"
    And the CLI should exit with code 0

  Scenario: Corrupted cache file causes workon to start cleanly with zero remote projects
    Given ~/.workon-remote-cache.json exists but contains invalid JSON
    When the user runs: workon
    Then the TUI should start without throwing an error
    And zero remote projects should be shown in the project list
    And the output should display: "⚠ Remote project cache is empty or corrupted. Run 'workon scan --remote' to rebuild."

  Scenario: Missing cache file causes workon to start cleanly with zero remote projects
    Given a remote root is configured
    And ~/.workon-remote-cache.json does not exist
    When the user runs: workon
    Then the TUI should start without throwing an error
    And zero remote projects should be shown in the project list
    And the output should display: "⚠ Remote project cache is empty or corrupted. Run 'workon scan --remote' to rebuild."

  Scenario: Overlapping remote roots produce no duplicate projects in the merged list
    Given the following remote roots are configured:
      | uri                                         |
      | ssh://alice@devbox.corp/home/alice          |
      | ssh://alice@devbox.corp/home/alice/projects |
    And both roots discover "api-service" at "/home/alice/projects/api-service" on "devbox.corp"
    When the user runs: workon list
    Then "api-service" should appear exactly once in the output
    And the CLI should exit with code 0

  # ===== ERROR HANDLING — Invalid Inputs & Refused Operations =====
  # Covers AC2, AC6, AC16, EC5, EC10

  Scenario Outline: Invalid remote root URI is rejected and config is not modified
    Given no remote roots are configured
    When the user runs: workon config add-remote-root <uri>
    Then the output should display an error message
    And remoteRoots should remain unchanged
    And the CLI should exit with code 1

    Examples:
      | uri                                             | reason                        |
      | http://alice@devbox.corp/home/alice/projects    | wrong scheme (not ssh://)     |
      | ssh://devbox.corp/home/alice/projects           | missing user component        |
      | ssh://alice@devbox.corp/relative/path           | relative path (no leading /)  |
      | ssh://alice@/home/alice/projects                | missing hostname              |
      | not-a-uri                                       | not a URI at all              |

  Scenario: Attempting to open a remote project with a non-VS Code command is refused
    Given a remote project "nvim-project" is cached with openCommand "nvim"
    When the user runs: workon open nvim-project
    Then the output should display: "Remote projects can only be opened with VS Code or VS Code Insiders."
    And the CLI should exit with code 1

  Scenario: remove-remote-root for a URI not in config exits with error
    Given no remote roots are configured
    When the user runs: workon config remove-remote-root ssh://alice@devbox.corp/home/alice/projects
    Then the output should display: "Remote root ssh://alice@devbox.corp/home/alice/projects is not configured."
    And the CLI should exit with code 1

  # ===== ERROR HANDLING — Disambiguation on Name Collision =====
  # Covers AC15, AC18, EC6

  Scenario: workon open with a name matching both a local and a remote project exits with guidance
    Given a local project "shared-lib" exists at "/Users/alice/projects/shared-lib"
    And a remote project "shared-lib" is cached for host "alice@devbox.corp"
    When the user runs: workon open shared-lib
    Then the output should list all matching projects:
      | project    | location                                        |
      | shared-lib | /Users/alice/projects/shared-lib (local)        |
      | shared-lib | ssh://alice@devbox.corp/.../shared-lib (remote) |
    And the output should display: "Multiple projects match 'shared-lib'. Please be more specific."
    And the CLI should exit with code 1

  Scenario: workon pin toggle with a name matching both a local and a remote project exits with guidance
    Given a local project "shared-lib" exists at "/Users/alice/projects/shared-lib"
    And a remote project "shared-lib" is cached for host "alice@devbox.corp"
    When the user runs: workon pin toggle shared-lib
    Then the output should list all matching projects:
      | project    | location                                        |
      | shared-lib | /Users/alice/projects/shared-lib (local)        |
      | shared-lib | ssh://alice@devbox.corp/.../shared-lib (remote) |
    And the output should display: "Multiple projects match 'shared-lib'. Please be more specific."
    And the CLI should exit with code 1

  Scenario: Local and remote projects with the same name both appear in TUI without error
    Given a local project "shared-lib" exists
    And a remote project "shared-lib" is cached for host "alice@devbox.corp"
    When the user launches: workon
    Then the TUI should display two entries:
      | name       | indicator | label               |
      | shared-lib |           |                     |
      | shared-lib | ⌁         | [alice@devbox.corp]  |
    And no error should be shown

  Scenario: TUI Launch Menu disables open option for non-VS Code remote projects
    Given the TUI is displaying the project list
    And a remote project "nvim-project" is visible with openCommand "nvim"
    When the user navigates to "nvim-project" and presses Enter to open the Launch Menu
    Then the Launch Menu should display: "⚠ Remote projects require VS Code"
    And the open option should be disabled (not selectable)

  # ===== INTEGRATION — End-to-End Flows =====
  # Covers AC1, AC3, AC4, AC5, AC7, AC9, AC10, AC14

  Scenario: Full flow — add remote root, list discovered projects, open one via VS Code
    Given the SSH host "devbox.corp" is reachable as "alice"
    And the remote path "/home/alice/projects" contains projects: "api-service", "frontend"
    When the user runs: workon config add-remote-root ssh://alice@devbox.corp/home/alice/projects
    Then the scan should complete and cache the discovered projects
    And the CLI should exit with code 0
    When the user runs: workon list
    Then the output should include "⌁ api-service  [alice@devbox.corp]"
    And the output should include "⌁ frontend  [alice@devbox.corp]"
    And the CLI should exit with code 0
    When the user runs: workon open api-service
    Then the system should execute: code --remote ssh-remote+alice@devbox.corp /home/alice/projects/api-service
    And the CLI should exit with code 0

  Scenario: Full flow — pin a remote project and verify it persists across sessions
    Given a remote project "api-service" is cached for "alice@devbox.corp"
    When the user runs: workon pin toggle api-service
    Then the CLI should exit with code 0
    When the user starts a new workon session
    Then "api-service" should be shown with 📌 and ⌁ indicators in the TUI project list
    And the SSH URI "ssh://alice@devbox.corp/home/alice/projects/api-service" should remain in the pinned array in ~/.workonrc.json

  Scenario: workon scan rescans both local and remote roots
    Given local scan roots and remote root "ssh://alice@devbox.corp/home/alice/projects" are both configured
    And the SSH host "devbox.corp" is reachable
    When the user runs: workon scan
    Then the output should display: "Scanning ssh://alice@devbox.corp..."
    And the output should display a summary: "Found N projects on devbox.corp"
    And the cache should be updated with a fresh scannedAt timestamp
    And the CLI should exit with code 0

  Scenario: Removed remote root's projects no longer appear in list or search
    Given a remote root "ssh://alice@devbox.corp/home/alice/projects" is configured
    And the cache contains remote projects: "api-service", "frontend"
    When the user runs: workon config remove-remote-root ssh://alice@devbox.corp/home/alice/projects
    And the CLI should exit with code 0
    When the user runs: workon list
    Then "api-service" should not appear in the output
    And "frontend" should not appear in the output
    And the CLI should exit with code 0

  Scenario: Cached .workonrc.json override is applied at open time with SSH unavailable
    Given a remote project "api-service" has been scanned with .workonrc.json setting name "My API"
    And the cached per-project config has been written to ~/.workon-remote-cache.json
    And the SSH host "devbox.corp" is unreachable
    When the user runs: workon list
    Then the project should be listed as "My API" using the cached override
    And no SSH connection should be attempted
    And the CLI should exit with code 0
