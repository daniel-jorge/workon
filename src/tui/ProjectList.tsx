import React from "react";
import { Text, Box } from "ink";
import type { Project } from "../types.js";
import { trimPath } from "../utils.js";

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
          <Box key={project.path}>
            <Text
              bold={isSelected}
              backgroundColor={isSelected ? "blue" : undefined}
              color={isSelected ? "black" : undefined}
            >
              {` ${project.name.padEnd(30)} `}
            </Text>
            <Text dimColor={!isSelected}>{`${trimPath(project.path, 50).padEnd(50)} `}</Text>
            <Text color="cyan">{`${TYPE_LABELS[project.type] ?? project.type} `}</Text>
            <Text color="yellow">{`${project.ide} `}</Text>
            {project.profile ? <Text color="green">{`${project.profile} `}</Text> : null}
            {project.hasDevProject ? <Text color="magenta">{"●"}</Text> : null}
          </Box>
        );
      })}
    </Box>
  );
}
