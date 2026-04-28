import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { OpenCommand } from "@/types.js";

interface OpenMenuProps {
  visible: boolean;
  projectName: string;
  currentOpenCommand: string;
  openCommands: OpenCommand[];
  isPinned: boolean;
  isMissing: boolean;
  onSelectOpenCommand: (command: string) => void;
  onTogglePin: () => void;
  onCancel: () => void;
}

type MenuItem = "command" | "pin";

export function OpenMenu({
  visible,
  projectName,
  currentOpenCommand,
  openCommands,
  isPinned,
  isMissing,
  onSelectOpenCommand,
  onTogglePin,
  onCancel,
}: OpenMenuProps) {
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(
    openCommands.findIndex((cmd) => cmd.command === currentOpenCommand) ?? 0,
  );
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem>(isMissing ? "pin" : "command");

  if (!visible) {
    return null;
  }

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    // Number keys 1–N for quick command selection (only if not missing)
    if (!isMissing && input && /^[1-9]$/.test(input)) {
      const numIndex = parseInt(input, 10) - 1;
      if (numIndex < openCommands.length) {
        onSelectOpenCommand(openCommands[numIndex].command);
      }
      return;
    }

    // P key for quick pin/unpin toggle (works from any menu item)
    if (input === "p" || input === "P") {
      onTogglePin();
      return;
    }

    if (key.upArrow) {
      if (selectedMenuItem === "command") {
        // Navigate between commands or move to pin if at first command
        if (selectedCommandIndex > 0) {
          setSelectedCommandIndex((i) => i - 1);
        } else if (!isMissing) {
          setSelectedMenuItem("pin");
        }
      } else if (selectedMenuItem === "pin" && !isMissing) {
        // Move from pin back to last command
        setSelectedCommandIndex(openCommands.length - 1);
        setSelectedMenuItem("command");
      }
    } else if (key.downArrow) {
      if (selectedMenuItem === "command") {
        // Navigate between commands or move to pin if at last command
        if (selectedCommandIndex < openCommands.length - 1) {
          setSelectedCommandIndex((i) => i + 1);
        } else {
          setSelectedMenuItem("pin");
        }
      } else if (selectedMenuItem === "pin") {
        // Stay on pin (can't go further down)
        return;
      }
    } else if (key.return) {
      if (selectedMenuItem === "command" && !isMissing) {
        onSelectOpenCommand(openCommands[selectedCommandIndex].command);
      } else if (selectedMenuItem === "pin") {
        onTogglePin();
      }
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="blue"
      paddingX={2}
      paddingY={1}
      margin={1}
    >
      <Box marginBottom={1}>
        <Text bold={true}>{projectName}</Text>
      </Box>

      {/* Open Command Options */}
      {!isMissing && (
        <>
          {openCommands.map((cmd, index) => {
            const isSelected = selectedMenuItem === "command" && index === selectedCommandIndex;
            const keyNumber = index + 1;
            return (
              <Box key={cmd.command}>
                <Text
                  bold={isSelected}
                  color={isSelected ? "blue" : undefined}
                  dimColor={!isSelected}
                >
                  {isSelected ? "▸ " : "  "}[{keyNumber}] {cmd.name}
                </Text>
              </Box>
            );
          })}
        </>
      )}

      {/* Pin/Unpin Option */}
      <Box marginTop={!isMissing ? 1 : 0}>
        <Text
          bold={selectedMenuItem === "pin"}
          color={selectedMenuItem === "pin" ? "blue" : undefined}
          dimColor={selectedMenuItem !== "pin"}
        >
          {selectedMenuItem === "pin" ? "▸ " : "  "}
          [P] {isPinned ? "Unpin Project" : "Pin Project"}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor={true}>
          {isMissing
            ? "ENTER: Unpin | P: Toggle | ESC: Cancel"
            : "↑↓: Navigate · ENTER: Select · ESC: Cancel"}
        </Text>
      </Box>
    </Box>
  );
}
