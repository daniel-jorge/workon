import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const FRAME_INTERVAL = 100; // milliseconds
const ASCII_FALLBACK = "[…]";

interface Props {
  status?: string;
}

export function Spinner({ status = "Scanning for projects…" }: Props) {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % BRAILLE_FRAMES.length);
    }, FRAME_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  const useColor = !process.env.NO_COLOR;
  const spinner = useColor ? BRAILLE_FRAMES[frameIndex] : ASCII_FALLBACK;

  return (
    <Box flexDirection="column" flexGrow={1} justifyContent="center" alignItems="center">
      <Text>{spinner}</Text>
      <Text>{status}</Text>
    </Box>
  );
}
