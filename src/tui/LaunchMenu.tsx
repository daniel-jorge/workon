import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { AVAILABLE_IDES } from "@/core/ides.js";

interface LaunchMenuProps {
  visible: boolean;
  projectName: string;
  currentIde: string;
  isPinned: boolean;
  isMissing: boolean;
  onSelectIde: (ide: string) => void;
  onTogglePin: () => void;
  onCancel: () => void;
}

const IDE_DISPLAY_NAMES: Record<string, string> = {
  code: "Visual Studio Code",
  "code-insiders": "Visual Studio Code Insiders",
};

type MenuItem = "ide" | "pin";

export function LaunchMenu({
  visible,
  projectName,
  currentIde,
  isPinned,
  isMissing,
  onSelectIde,
  onTogglePin,
  onCancel,
}: LaunchMenuProps) {
  const [selectedIdeIndex, setSelectedIdeIndex] = useState(
    AVAILABLE_IDES.indexOf(currentIde as any) ?? 0,
  );
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem>(isMissing ? "pin" : "ide");

  if (!visible) {
    return null;
  }

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    // Number keys 1–N for quick IDE selection (only if not missing)
    if (!isMissing && input && /^[1-9]$/.test(input)) {
      const numIndex = parseInt(input, 10) - 1;
      if (numIndex < AVAILABLE_IDES.length) {
        onSelectIde(AVAILABLE_IDES[numIndex]);
      }
      return;
    }

    // P key for quick pin/unpin toggle (works from any menu item)
    if (input === "p" || input === "P") {
      onTogglePin();
      return;
    }

    if (key.upArrow) {
      if (selectedMenuItem === "ide") {
        // Navigate between IDEs or move to pin if at first IDE
        if (selectedIdeIndex > 0) {
          setSelectedIdeIndex((i) => i - 1);
        } else if (!isMissing) {
          setSelectedMenuItem("pin");
        }
      } else if (selectedMenuItem === "pin" && !isMissing) {
        // Move from pin back to last IDE
        setSelectedIdeIndex(AVAILABLE_IDES.length - 1);
        setSelectedMenuItem("ide");
      }
    } else if (key.downArrow) {
      if (selectedMenuItem === "ide") {
        // Navigate between IDEs or move to pin if at last IDE
        if (selectedIdeIndex < AVAILABLE_IDES.length - 1) {
          setSelectedIdeIndex((i) => i + 1);
        } else {
          setSelectedMenuItem("pin");
        }
      } else if (selectedMenuItem === "pin") {
        // Stay on pin (can't go further down)
        return;
      }
    } else if (key.return) {
      if (selectedMenuItem === "ide" && !isMissing) {
        onSelectIde(AVAILABLE_IDES[selectedIdeIndex]);
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

      {/* IDE Options */}
      {!isMissing && (
        <>
          {AVAILABLE_IDES.map((ide, index) => {
            const isSelected = selectedMenuItem === "ide" && index === selectedIdeIndex;
            const displayName = IDE_DISPLAY_NAMES[ide] || ide;
            const keyNumber = index + 1;
            return (
              <Box key={ide}>
                <Text
                  bold={isSelected}
                  color={isSelected ? "blue" : undefined}
                  dimColor={!isSelected}
                >
                  {isSelected ? "▸ " : "  "}[{keyNumber}] {displayName}
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
