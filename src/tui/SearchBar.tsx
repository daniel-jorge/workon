import React from "react";
import { Text, Box, useInput } from "ink";

interface Props {
  query: string;
  onChange: (value: string) => void;
}

export function SearchBar({ query, onChange }: Props) {
  useInput((input, key) => {
    // Filter out SHIFT+ENTER escape sequences before processing
    if (input?.includes(";2;13~")) {
      return; // Don't process SHIFT+ENTER in search
    }
    if (key.return && key.shift) {
      return; // Let SHIFT+ENTER pass through to parent
    }
    if (key.backspace || key.delete) {
      onChange(query.slice(0, -1));
      return;
    }
    // Ignore other escape sequences and control characters
    // oxlint-disable-next-line no-control-regex
    if (input && /^\x1b|^\[/.test(input)) {
      return;
    }
    if (
      !key.escape &&
      !key.upArrow &&
      !key.downArrow &&
      !key.return &&
      !key.ctrl &&
      !key.meta &&
      !key.shift &&
      input
    ) {
      onChange(query + input);
    }
  });

  return (
    <Box flexGrow={1}>
      <Text bold color="yellow">
        {"Search: "}
      </Text>
      <Text>{query}</Text>
      <Text dimColor>{"█"}</Text>
    </Box>
  );
}
