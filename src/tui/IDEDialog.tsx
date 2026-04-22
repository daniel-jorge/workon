import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { AVAILABLE_IDES } from "../core/ides.js";

interface IDEDialogProps {
  projectName: string;
  currentIde: string;
  onSelect: (ide: string) => void;
  onCancel: () => void;
}

const IDE_DISPLAY_NAMES: Record<string, string> = {
  code: "Visual Studio Code",
  "code-insiders": "Visual Studio Code Insiders",
};

export function IDEDialog({ projectName, currentIde, onSelect, onCancel }: IDEDialogProps) {
  const [selectedIndex, setSelectedIndex] = useState(
    AVAILABLE_IDES.indexOf(currentIde as any) ?? 0,
  );

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIndex((i) => Math.min(AVAILABLE_IDES.length - 1, i + 1));
    } else if (key.return) {
      onSelect(AVAILABLE_IDES[selectedIndex]);
    } else if (key.escape) {
      onCancel();
      return;
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
        <Text bold={true}>Select IDE for {projectName}</Text>
      </Box>
      {AVAILABLE_IDES.map((ide, index) => {
        const isSelected = index === selectedIndex;
        const displayName = IDE_DISPLAY_NAMES[ide] || ide;
        return (
          <Box key={ide}>
            <Text bold={isSelected} color={isSelected ? "blue" : undefined}>
              {isSelected ? "▸ " : "  "}
              {displayName} ({ide})
            </Text>
          </Box>
        );
      })}
      <Box marginTop={1}>
        <Text dimColor={true}>ENTER: Select | ESC: Cancel</Text>
      </Box>
    </Box>
  );
}
