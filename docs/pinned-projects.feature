Feature: Pinned Projects
  Developers can pin projects for quick access and streamlined navigation.
  Pinned projects are stored in ~/.workonrc.json, auto-sorted to the top of the project list,
  and can be managed through the interactive TUI or CLI commands.

  # ===== HAPPY PATH — Core Functionality =====

  Scenario: User opens a project and selects IDE from Launch Menu
    Given the TUI is displaying a list of projects
    And the project "my-app" is visible in the list
    When the user navigates to "my-app"
    And the user presses Enter to open the Launch Menu
    Then a menu should appear with:
      | option                          | shortcut |
      | [1] Visual Studio Code          | 1        |
      | [2] VS Code Insiders            | 2        |
      | Pin Project                     | ↓+ENTER  |
    And the default IDE should be highlighted
    When the user presses Enter to confirm
    Then "my-app" should launch in the selected IDE
    And the TUI should exit

  Scenario: User quickly selects IDE using number shortcut
    Given the TUI is displaying a list of projects
    And the project "my-app" is visible in the list
    When the user navigates to "my-app"
    And the user presses Enter to open the Launch Menu
    Then the Launch Menu should appear with IDE options and number shortcuts (1, 2)
    When the user presses "2" to quick-select VS Code Insiders
    Then "my-app" should immediately launch in VS Code Insiders
    And the TUI should exit

  Scenario: User pins a project via Launch Menu
    Given the TUI is displaying a list of projects
    And the project "my-app" is visible in the list
    When the user navigates to "my-app"
    And the user presses Enter to open the Launch Menu
    And the user navigates down to "Pin Project" option
    And the user presses Enter
    Then the project "my-app" should be marked with a pin indicator (📌)
    And "my-app" should be moved to the top of the project list
    And the pinned array in ~/.workonrc.json should include the path to "my-app"
    And the Launch Menu should close and TUI should update

  Scenario: User unpins a project via Launch Menu
    Given a project "my-app" is pinned
    And the TUI is displaying the project list with "my-app" at the top (marked with 📌)
    When the user navigates to "my-app"
    And the user presses Enter to open the Launch Menu
    And the user navigates down to "Unpin Project" option
    And the user presses Enter
    Then the pin indicator should disappear from "my-app"
    And "my-app" should move to its regular position in the list (by scan order)
    And the pinned array in ~/.workonrc.json should no longer include the path to "my-app"
    And the Launch Menu should close and TUI should update

  Scenario: Pinned projects appear at the top of the TUI project list
    Given the projects "app-a", "app-b", "app-c" exist
    And "app-b" is marked as pinned
    When the TUI displays the project list
    Then "app-b" should appear first (with 📌 indicator)
    And "app-a" and "app-c" should appear below in their scan order

  Scenario: User opens a pinned project via CLI command
    Given a pinned project "my-app" exists at "/Users/user/projects/my-app"
    When the user runs: workon pin open my-app
    Then the project should be opened in the configured IDE
    And the CLI should exit with code 0

  Scenario: User lists all pinned projects via CLI command
    Given the following projects are pinned:
      | name            | path                           |
      | my-app          | /Users/user/projects/my-app    |
      | legacy-service  | /Users/user/projects/legacy    |
    When the user runs: workon pin list
    Then the output should display:
      """
      [📌] my-app — /Users/user/projects/my-app
      [📌] legacy-service — /Users/user/projects/legacy
      """
    And the CLI should exit with code 0

  Scenario: User toggles pin status via CLI command
    Given a project "my-app" exists in a scan root
    When the user runs: workon pin toggle my-app
    Then the project should be added to pinned projects
    And the output should show: "✓ Pinned my-app"
    And the ~/.workonrc.json should be updated with the new pin

  Scenario: User toggles pin status back off via CLI command
    Given a project "my-app" is marked as pinned
    When the user runs: workon pin toggle my-app
    Then the project should be removed from pinned projects
    And the output should show: "✓ Unpinned my-app"
    And the ~/.workonrc.json should be updated to remove "my-app"

  Scenario: Pins persist across multiple TUI sessions
    Given a project "my-app" is marked as pinned and saved to ~/.workonrc.json
    When the user closes the TUI and reopens it with: workon
    Then "my-app" should still be marked with the 📌 indicator
    And "my-app" should appear at the top of the list

  Scenario: Search results respect pin ordering
    Given the following projects: "my-app", "another-app", "app-legacy"
    And "my-app" is pinned
    When the user runs a search filter (e.g., "app") in the TUI
    Then "my-app" should appear first with 📌 indicator
    And the other matching projects should appear below in scan order

  # ===== EDGE CASES — Boundary Conditions =====

  Scenario: Handle deleted pinned project in TUI
    Given a project "my-app" is pinned at "/Users/user/projects/my-app"
    And the user deletes the directory "/Users/user/projects/my-app"
    When the user launches the TUI: workon
    Then a warning should be displayed: "⚠ Pinned project not found: /Users/user/projects/my-app"
    And the user should have an option to unpin it
    When the user navigates to the warning entry and presses Enter
    Then the Launch Menu should appear with an "Unpin Project" option
    And IDE options should be disabled
    When the user navigates to "Unpin Project" and presses Enter
    Then the entry should be removed from ~/.workonrc.json
    And the TUI should update without the warning

  Scenario: Handle deleted pinned project in CLI
    Given a project "my-app" is pinned at "/Users/user/projects/my-app"
    And the user deletes the directory "/Users/user/projects/my-app"
    When the user runs: workon pin list
    Then the output should show the path with a note: "(path not found)"
    When the user runs: workon config cleanup-pins
    Then the output should show: "✓ Removed 1 missing pin(s)"
    And the ~/.workonrc.json should no longer include the missing path

  Scenario: Pinned projects outside scan roots are stored but not displayed in TUI
    Given the scan roots are: ["/Users/user/projects"]
    And the user adds a pin for "/opt/external-project" (outside scan roots)
    When the user launches the TUI: workon
    Then the external project should not appear in the project list
    But when the user runs: workon pin list
    Then the external project should be listed as pinned
    And the user can run: workon pin open external-project

  Scenario: Duplicate pinned entries are deduplicated on load
    Given ~/.workonrc.json contains duplicate paths in the pinned array
    When the TUI is launched or config is reloaded
    Then a warning should be logged: "Duplicate pinned projects detected and removed"
    And the pinned array should contain only unique paths
    And the config should be written back with the cleaned array

  Scenario: Invalid pinned entries are handled gracefully
    Given ~/.workonrc.json contains a non-string value in the pinned array
    When the TUI is launched or config is reloaded
    Then a warning should be logged: "Invalid pinned entry (not a string)"
    And valid entries should be loaded normally
    And the invalid entry should be preserved (not deleted) for the user to fix manually

  Scenario: Ambiguous project name in CLI is resolved with fuzzy match
    Given the user has pinned: "app", "app-legacy", "application"
    When the user runs: workon pin open app
    Then the exact match "app" should be opened (exact > fuzzy)
    When the user runs: workon pin open app-l
    Then "app-legacy" should be opened (fuzzy match)
    When the user runs: workon pin open ap
    Then the user should be prompted to disambiguate: "Ambiguous. Did you mean: app, app-legacy, application?"

  Scenario: Launch Menu handles narrow terminal widths
    Given the terminal width is < 40 characters
    When the user navigates to a project and presses Enter to open the Launch Menu
    Then the Launch Menu should display with abbreviated labels or single-character shortcuts
    And the pin indicator (📌) should remain visible
    And no layout breakage should occur

  # ===== ERROR HANDLING — Failure Modes =====

  Scenario: User attempts to open a pin that doesn't exist
    Given the pinned array contains "/Users/user/projects/my-app"
    But the project "my-app" is not in any scan root
    When the user runs: workon pin open my-app
    Then the CLI should show an error: "Project 'my-app' not found in pinned projects"
    And the CLI should exit with code 1

  Scenario: User attempts to toggle pin for non-existent project
    Given no project named "nonexistent" exists
    When the user runs: workon pin toggle nonexistent
    Then the CLI should show an error: "Project 'nonexistent' not found"
    And the CLI should exit with code 1

  Scenario: User lists pins when none exist
    Given the pinned array is empty
    When the user runs: workon pin list
    Then the output should show: "No pinned projects. Add one with: workon pin toggle <project-name>"
    And the CLI should exit with code 0

  Scenario: Config write fails and user is notified
    Given the TUI is running
    And ~/.workonrc.json is read-only (permission denied)
    When the user attempts to toggle a pin
    Then the user should see an error message: "Failed to save pins. Please check permissions for ~/.workonrc.json"
    And the pin should not be persisted
    And the TUI should remain responsive

  Scenario: Invalid CLI command syntax
    Given the user runs: workon pin invalid-subcommand
    When the CLI processes the command
    Then the CLI should show an error: "Unknown command: invalid-subcommand"
    And a help message should be displayed with available subcommands: list, open, toggle
    And the CLI should exit with code 1

  # ===== INTEGRATION & INTERACTION =====

  Scenario: Pins do not affect project type detection
    Given a project "my-app" is detected as "nodejs" type
    When the project is marked as pinned
    Then the project type should remain "nodejs"
    And pin status should not interfere with IDE launch or profile selection

  Scenario: Pins work with all project types
    Given projects of types: nodejs, rust, python, go, java, dotnet, generic
    When each project is marked as pinned
    Then all should appear in the pinned list
    And all should be openable via: workon pin open <name>

  Scenario: Pin status is preserved across config reloads
    Given a project "my-app" is marked as pinned
    When the user runs: workon config show
    And the user manually edits ~/.workonrc.json (e.g., add a new root)
    And the TUI is reloaded
    Then "my-app" should still be marked as pinned
    And the pin status should not be lost

  Scenario: Pin indicator is visible in both light and dark terminal themes
    Given the TUI is running in a light terminal theme
    When the user navigates to a pinned project
    Then the 📌 indicator should be clearly visible
    When the user switches to dark theme
    Then the 📌 indicator should remain clearly visible
    And no readability issues should occur
