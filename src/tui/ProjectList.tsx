import React from "react";
import { Text, Box } from "ink";
import type { Project } from "@/types.js";

interface Props {
  projects: Project[];
  selectedIndex: number;
  maxVisible: number;
}

const TYPE_LABELS: Record<string, string> = {
  nodejs: "Node.js",
  rust: "Rust",
  go: "Go",
  python: "Python",
  java: "Java",
  dotnet: ".NET",
  generic: "Generic",
};

export function ProjectList({ projects, selectedIndex, maxVisible }: Props) {
  if (projects.length === 0) {
    return <Text dimColor>{"No projects found"}</Text>;
  }

  const scrollOffset = Math.min(
    Math.max(0, selectedIndex - maxVisible + 1),
    Math.max(0, projects.length - maxVisible),
  );
  const visible = projects.slice(scrollOffset, scrollOffset + maxVisible);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visible.map((project, index) => {
        const actualIndex = index + scrollOffset;
        const isSelected = actualIndex === selectedIndex;
        return (
          <Box key={project.path} flexDirection="column">
            <Box gap={1}>
              <Text color="grey">{isSelected ? "█" : " "}</Text>
              <Box flexGrow={1}>
                <Text dimColor={!isSelected} bold={isSelected} color="blue" wrap="truncate-middle">
                  {project.name}
                </Text>
              </Box>
              <Text color="cyan" dimColor={!isSelected}>
                {TYPE_LABELS[project.type] ?? project.type}
              </Text>
            </Box>
            <Box gap={1}>
              <Text color="grey">{isSelected ? "█" : " "}</Text>
              <Text dimColor={!isSelected} wrap="truncate-middle">
                {project.path}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
