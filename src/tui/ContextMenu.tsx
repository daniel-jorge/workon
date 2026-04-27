import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface ContextMenuOption {
  label: string;
  key: string;
  action: () => void;
}

interface ContextMenuProps {
  visible: boolean;
  options: ContextMenuOption[];
  onClose: () => void;
}

export function ContextMenu({ visible, options, onClose }: ContextMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((_input, key) => {
    if (!visible) return;

    if (key.escape) {
      onClose();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIndex((i) => Math.min(options.length - 1, i + 1));
    } else if (key.return) {
      const option = options[selectedIndex];
      if (option) {
        option.action();
        onClose();
      }
    } else {
      // Check for single-key shortcuts
      const inputLower = _input?.toLowerCase();
      for (const option of options) {
        if (option.key.toLowerCase() === inputLower) {
          option.action();
          onClose();
          return;
        }
      }
    }
  });

  if (!visible) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="green"
      paddingX={2}
      paddingY={1}
      margin={1}
    >
      {options.map((option, index) => {
        const isSelected = index === selectedIndex;
        return (
          <Box key={option.key}>
            <Text bold={isSelected} color={isSelected ? "green" : undefined}>
              {isSelected ? "▸ " : "  "}
              [{option.key}] {option.label}
            </Text>
          </Box>
        );
      })}
      <Box marginTop={1}>
        <Text dimColor={true}>↑↓: Navigate | ENTER: Select | ESC: Cancel</Text>
      </Box>
    </Box>
  );
}
