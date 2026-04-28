/**
 * @deprecated Open commands are now configurable via GlobalConfig.openCommands.
 * This file is maintained for reference only and will be removed in a future version.
 *
 * Previously, IDE selection was limited to:
 * - "code" (Visual Studio Code)
 * - "code-insiders" (VS Code Insiders)
 *
 * Users can now define any custom open commands in their .workonrc.json config file.
 */

// Legacy type - kept for reference
export type IDE = "code" | "code-insiders";
