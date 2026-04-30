Feature: Configurable Open Commands CLI Management
  As a developer
  I want to manage open commands through CLI commands
  So that I can configure my editors without manually editing .workonrc.json

  # ==============================================================================
  # HAPPY PATH: Core functionality working as expected
  # ==============================================================================

  Scenario: Add a new open command successfully
    # Covers AC1: Add command works
    Given a fresh workonrc.json config file with open commands:
      | Display Name         | Executable     |
      | Visual Studio Code   | code           |
      | VS Code Insiders     | code-insiders  |
    When the user runs: workon config add-command --name "Cursor" --command "cursor"
    Then the system displays: "Added open command: Cursor (cursor)"
    And the CLI should exit with code 0

  Scenario: Newly added command appears immediately in list
    # Covers AC2: Immediately appears in list
    Given a workonrc.json config file with open commands:
      | Display Name         | Executable     | Default |
      | Visual Studio Code   | code           | Y       |
    When the user runs: workon config add-command --name "Cursor" --command "cursor"
    And the user runs: workon config list-commands
    Then the output displays a table with rows:
      | Display Name         | Executable     | Default |
      | Visual Studio Code   | code           | Y       |
      | Cursor               | cursor         | N       |
    And the CLI should exit with code 0

  Scenario: List all open commands in table format with default marker
    # Covers AC5: List-commands table format with default marker
    Given a workonrc.json config file with open commands:
      | Display Name         | Executable     | Default |
      | Visual Studio Code   | code           | Y       |
      | VS Code Insiders     | code-insiders  | N       |
      | Cursor               | cursor         | N       |
    When the user runs: workon config list-commands
    Then the output displays a table with columns: "Display Name", "Executable", "Default"
    And the row for "Visual Studio Code" shows "Y" in the Default column
    And the rows for "VS Code Insiders" and "Cursor" show "N" in the Default column
    And the CLI should exit with code 0

  Scenario: Set default open command to an existing executable
    # Covers AC9: Set default command works
    Given a workonrc.json config file with open commands:
      | Display Name         | Executable     | Default |
      | Visual Studio Code   | code           | Y       |
      | Cursor               | cursor         | N       |
    When the user runs: workon config set-default-command "cursor"
    Then the system displays: "Set default open command to: cursor"
    And the ~/.workonrc.json file contains "defaultOpenCommand": "cursor"
    And the CLI should exit with code 0

  Scenario: List commands shows updated default after set-default-command
    Given a workonrc.json config file with open commands:
      | Display Name         | Executable     | Default |
      | Visual Studio Code   | code           | Y       |
      | Cursor               | cursor         | N       |
    When the user runs: workon config set-default-command "cursor"
    And the user runs: workon config list-commands
    Then the row for "Cursor" shows "Y" in the Default column
    And the row for "Visual Studio Code" shows "N" in the Default column
    And the CLI should exit with code 0

  # ==============================================================================
  # EDGE CASES: Duplicate detection, auto-promotion, boundary conditions
  # ==============================================================================

  Scenario: Reject duplicate display name
    # Covers AC3: Duplicate name rejection
    Given a workonrc.json config file with open commands:
      | Display Name         | Executable     |
      | Visual Studio Code   | code           |
      | Cursor               | cursor         |
    When the user runs: workon config add-command --name "Cursor" --command "nova"
    Then the system displays an error: "Error: A command with display name 'Cursor' already exists"
    And the ~/.workonrc.json file is unchanged
    And the CLI should exit with code 1

  Scenario: Reject duplicate executable
    # Covers AC4: Duplicate executable rejection
    Given a workonrc.json config file with open commands:
      | Display Name         | Executable     |
      | Visual Studio Code   | code           |
      | Cursor               | cursor         |
    When the user runs: workon config add-command --name "VS Code Legacy" --command "code"
    Then the system displays an error: "Error: The executable 'code' is already configured under display name 'Visual Studio Code'"
    And the ~/.workonrc.json file is unchanged
    And the CLI should exit with code 1

  Scenario: Remove open command successfully
    # Covers AC6: Remove command
    Given a workonrc.json config file with open commands:
      | Display Name         | Executable     | Default |
      | Visual Studio Code   | code           | Y       |
      | Cursor               | cursor         | N       |
    When the user runs: workon config remove-command --name "Cursor"
    Then the system displays: "Removed open command: Cursor"
    And the ~/.workonrc.json file contains only Visual Studio Code in open commands
    And the CLI should exit with code 0

  Scenario: Remove default command triggers auto-promotion to first remaining
    # Covers AC7: Remove command, auto-promote default if removed
    Given a workonrc.json config file with open commands:
      | Display Name         | Executable     | Default |
      | Visual Studio Code   | code           | Y       |
      | Cursor               | cursor         | N       |
      | Zed                  | zed            | N       |
    When the user runs: workon config remove-command --name "Visual Studio Code"
    Then the system displays: "Removed open command: Visual Studio Code"
    And the system displays: "Default promoted to: cursor"
    And the ~/.workonrc.json contains "defaultOpenCommand": "cursor"
    And the CLI should exit with code 0

  Scenario: Remove default when it is the last remaining command
    # Covers EC5b: Remove last command
    Given a workonrc.json config file with open commands:
      | Display Name         | Executable     | Default |
      | Visual Studio Code   | code           | Y       |
    When the user runs: workon config remove-command --name "Visual Studio Code"
    Then the system displays: "Removed open command: Visual Studio Code"
    And the system displays: "Warning: No commands remain in config"
    And the ~/.workonrc.json contains "defaultOpenCommand": ""
    And the CLI should exit with code 0

  Scenario: Warn when adding executable not found in PATH but proceed anyway
    # Covers AC11: Warning on missing executable (part 1)
    # Covers EC7: Executable not in $PATH (Warning, Not Blocking)
    Given a fresh workonrc.json config file with open commands:
      | Display Name         | Executable     |
      | Visual Studio Code   | code           |
    And the executable "my-unknown-editor" is not available in $PATH
    When the user runs: workon config add-command --name "Unknown Editor" --command "my-unknown-editor"
    Then the system displays: "Warning: executable 'my-unknown-editor' not found in $PATH (but will be added anyway)"
    And the system displays: "Added open command: Unknown Editor (my-unknown-editor)"
    And the ~/.workonrc.json contains a command with name "Unknown Editor" and executable "my-unknown-editor"
    And the CLI should exit with code 0

  Scenario: No warning when adding executable found in PATH
    # Covers AC12: When adding an executable found in $PATH, no warning is displayed
    Given a fresh workonrc.json config file with open commands:
      | Display Name         | Executable     |
      | Visual Studio Code   | code           |
    And the executable "code" is available in $PATH
    When the user runs: workon config add-command --name "More VS Code" --command "code-new"
    Then the system does not display: "Warning"
    And the system displays: "Added open command: More VS Code (code-new)"
    And the CLI should exit with code 0

  # ==============================================================================
  # ERROR HANDLING: Invalid inputs, missing resources, validation failures
  # ==============================================================================

  Scenario: Error when removing non-existent command
    # Covers AC8: Remove non-existent shows error
    Given a workonrc.json config file with open commands:
      | Display Name         | Executable     |
      | Visual Studio Code   | code           |
      | Cursor               | cursor         |
    When the user runs: workon config remove-command --name "NotAnEditor"
    Then the system displays an error: "Error: No command found with display name 'NotAnEditor'"
    And the system displays available commands in the error message
    And the ~/.workonrc.json file is unchanged
    And the CLI should exit with code 1

  Scenario: Error when setting default to non-existent executable
    # Covers AC10: Set default command validation
    Given a workonrc.json config file with open commands:
      | Display Name         | Executable     |
      | Visual Studio Code   | code           |
      | Cursor               | cursor         |
    When the user runs: workon config set-default-command "nonexistent"
    Then the system displays an error: "Error: No executable 'nonexistent' found"
    And the system displays available executables: "code, cursor"
    And the ~/.workonrc.json file is unchanged
    And the CLI should exit with code 1

  Scenario: Error on missing required --name argument for add-command
    # Covers AC14: Invalid input shows usage error
    When the user runs: workon config add-command --command "cursor"
    Then the system displays an error with usage information
    And the error includes: "--name is required"
    And the error includes an example: "workon config add-command --name \"Cursor\" --command \"cursor\""
    And the CLI should exit with code 1

  Scenario: Error on missing required --command argument for add-command
    # Covers AC14: Invalid input shows usage error (continued)
    When the user runs: workon config add-command --name "Cursor"
    Then the system displays an error with usage information
    And the error includes: "--command is required"
    And the CLI should exit with code 1

  Scenario: Error on missing required argument for set-default-command
    # Covers AC14: Invalid input shows usage error (continued)
    When the user runs: workon config set-default-command
    Then the system displays an error with usage information
    And the error includes: "executable name is required"
    And the error includes an example: "workon config set-default-command cursor"
    And the CLI should exit with code 1

  Scenario: Error on missing required --name argument for remove-command
    # Covers AC14: Invalid input shows usage error (continued)
    When the user runs: workon config remove-command
    Then the system displays an error with usage information
    And the error includes: "--name is required"
    And the CLI should exit with code 1

  Scenario: Preserve original config if write fails
    # Covers EC6: Config file corruption / permission denied
    Given a workonrc.json config file with open commands:
      | Display Name         | Executable     |
      | Visual Studio Code   | code           |
    And the ~/.workonrc.json file is read-only (permission denied)
    When the user runs: workon config add-command --name "Cursor" --command "cursor"
    Then the system displays an error: "Error: Failed to save config"
    And the error includes: "Your config has NOT been changed"
    And the ~/.workonrc.json file still contains only Visual Studio Code in open commands
    And the CLI should exit with code 1

  # ==============================================================================
  # PERSISTENCE & INTEGRATION: Config survives restarts, cross-command consistency
  # ==============================================================================

  Scenario: Changes persist to ~/.workonrc.json across process restarts
    # Covers AC13: Persistence across restarts
    Given a fresh workonrc.json config file with open commands:
      | Display Name         | Executable     |
      | Visual Studio Code   | code           |
    When the user runs: workon config add-command --name "Cursor" --command "cursor"
    Then the ~/.workonrc.json file is written to disk
    And the user closes and restarts the workon process
    And the user runs: workon config list-commands
    Then the output shows "Cursor" in the list
    And "Cursor" persists with executable "cursor"
    And the CLI should exit with code 0

  Scenario: Multiple add operations maintain order and consistency
    Given a fresh workonrc.json config file with open commands:
      | Display Name         | Executable     |
      | Visual Studio Code   | code           |
    When the user runs: workon config add-command --name "Cursor" --command "cursor"
    And the user runs: workon config add-command --name "Zed" --command "zed"
    And the user runs: workon config list-commands
    Then the output displays commands in order:
      | Display Name         | Executable     |
      | Visual Studio Code   | code           |
      | Cursor               | cursor         |
      | Zed                  | zed            |
    And the CLI should exit with code 0

  Scenario: Remove and add operations maintain default consistency
    Given a workonrc.json config file with open commands:
      | Display Name         | Executable     | Default |
      | Visual Studio Code   | code           | Y       |
      | Cursor               | cursor         | N       |
    When the user runs: workon config remove-command --name "Visual Studio Code"
    And the user runs: workon config add-command --name "Zed" --command "zed"
    And the user runs: workon config list-commands
    Then the default is marked on "Cursor" (promoted after removal)
    And "Zed" is shown with Default "N"
    And the CLI should exit with code 0

  # ==============================================================================
  # HELP & DOCUMENTATION: --help text with examples
  # ==============================================================================

  Scenario: add-command has --help with usage examples
    # Covers AC15: All commands have --help with examples
    When the user runs: workon config add-command --help
    Then the output displays help text including:
      | Description                                                    |
      | "Add a new open command to the global config"                 |
      | "--name <display-name>"                                       |
      | "--command <executable>"                                      |
    And the output includes at least one usage example:
      | "workon config add-command --name \"Cursor\" --command \"cursor\"" |
    And the CLI should exit with code 0

  Scenario: remove-command has --help with usage examples
    # Covers AC15: All commands have --help with examples (continued)
    When the user runs: workon config remove-command --help
    Then the output displays help text including:
      | Description                                        |
      | "Remove an open command from the global config"   |
      | "--name <display-name>"                          |
    And the output includes at least one usage example:
      | "workon config remove-command --name \"Cursor\"" |
    And the CLI should exit with code 0

  Scenario: list-commands has --help with usage examples
    # Covers AC15: All commands have --help with examples (continued)
    When the user runs: workon config list-commands --help
    Then the output displays help text including:
      | Description                                    |
      | "Display all configured open commands"        |
      | "Shows display name, executable, and default" |
    And the output includes at least one usage example:
      | "workon config list-commands" |
    And the CLI should exit with code 0

  Scenario: set-default-command has --help with usage examples
    # Covers AC15: All commands have --help with examples (continued)
    When the user runs: workon config set-default-command --help
    Then the output displays help text including:
      | Description                                          |
      | "Set the default open command for launching projects" |
      | "EXECUTABLE must exist in the configured commands"   |
    And the output includes at least one usage example:
      | "workon config set-default-command cursor" |
    And the CLI should exit with code 0

  # ==============================================================================
  # PARAMETRIC: Testing multiple editors and edge cases
  # ==============================================================================

  Scenario Outline: Add multiple editors and verify each appears in list
    # Covers AC1, AC2, AC5 with parameter variation
    Given a fresh workonrc.json config file with open commands:
      | Display Name         | Executable     |
      | Visual Studio Code   | code           |
    When the user runs: workon config add-command --name "<display_name>" --command "<executable>"
    And the user runs: workon config list-commands
    Then the output shows a row with Display Name "<display_name>" and Executable "<executable>"
    And the CLI should exit with code 0

    Examples:
      | display_name    | executable |
      | Cursor          | cursor     |
      | Zed             | zed        |
      | Neovim          | nvim       |
      | Sublime Text    | subl       |

  Scenario Outline: Reject duplicate display names with different executables
    # Covers AC3 with parameter variation
    Given a workonrc.json config file with open commands:
      | Display Name         | Executable     |
      | Visual Studio Code   | code           |
    When the user runs: workon config add-command --name "Visual Studio Code" --command "<new_executable>"
    Then the system displays an error mentioning duplicate display name
    And the CLI should exit with code 1

    Examples:
      | new_executable |
      | vscode         |
      | code-beta      |
      | codium         |

  Scenario Outline: Reject duplicate executables with different display names
    # Covers AC4 with parameter variation
    Given a workonrc.json config file with open commands:
      | Display Name         | Executable     |
      | Visual Studio Code   | code           |
    When the user runs: workon config add-command --name "<new_display_name>" --command "code"
    Then the system displays an error mentioning duplicate executable
    And the CLI should exit with code 1

    Examples:
      | new_display_name        |
      | VS Code Terminal        |
      | VS Code (Alternative)   |
      | Code Editor             |

  Scenario Outline: Set default to various existing executables
    # Covers AC9 with parameter variation
    Given a workonrc.json config file with open commands:
      | Display Name         | Executable     | Default |
      | Visual Studio Code   | code           | Y       |
      | Cursor               | cursor         | N       |
      | Zed                  | zed            | N       |
      | Neovim               | nvim           | N       |
    When the user runs: workon config set-default-command "<executable>"
    Then the ~/.workonrc.json contains "defaultOpenCommand": "<executable>"
    And the CLI should exit with code 0

    Examples:
      | executable |
      | cursor     |
      | zed        |
      | nvim       |
