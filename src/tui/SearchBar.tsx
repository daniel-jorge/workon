import React from "react";
import { Text, Box, useInput } from "ink";

interface Props {
  query: string;
  onChange: (value: string) => void;
}

export function SearchBar({ query, onChange }: Props) {
  useInput((input, key) => {
    if (key.backspace || key.delete) {
      onChange(query.slice(0, -1));
      return;
    }
    if (
      !key.escape &&
      !key.upArrow &&
      !key.downArrow &&
      !key.return &&
      !key.ctrl &&
      !key.meta &&
      input
    ) {
      onChange(query + input);
    }
  });

  return (
    <Box>
      <Text bold>{"Search: "}</Text>
      <Text>{query}</Text>
      <Text dimColor>{"█"}</Text>
    </Box>
  );
}
