import React, { useState, useMemo } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { SearchBar } from "./SearchBar.js";
import { ProjectList } from "./ProjectList.js";
import { HintBar } from "./HintBar.js";
import { fuzzySearch } from "../core/search.js";
import { openProject } from "../core/launcher.js";
import type { Project } from "../types.js";

interface Props {
  projects: Project[];
}

export function App({ projects }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { stdout } = useStdout();

  const filtered = useMemo(() => fuzzySearch(projects, query), [projects, query]);

  // SearchBar (1) + count line (1) + HintBar (1) = 3 rows overhead
  const maxVisible = Math.max(1, (stdout?.rows ?? 24) - 3);

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    setSelectedIndex(0);
  };

  useInput((_input, key) => {
    if (key.escape) {
      if (query) {
        setQuery("");
        setSelectedIndex(0);
      } else {
        process.exit(0);
      }
    } else if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (key.leftArrow) {
      setSelectedIndex((i) => Math.max(0, i - maxVisible));
    } else if (key.rightArrow) {
      setSelectedIndex((i) => Math.min(filtered.length - 1, i + maxVisible));
    } else if (key.return) {
      const project = filtered[selectedIndex];
      if (project) {
        openProject(project);
        process.exit(0);
      }
    }
  });

  return (
    <Box flexDirection="column" height={stdout?.rows}>
      <SearchBar query={query} onChange={handleQueryChange} />
      <Text dimColor>{`${filtered.length} / ${projects.length} projects`}</Text>
      <ProjectList projects={filtered} selectedIndex={selectedIndex} maxVisible={maxVisible} />
      <HintBar />
    </Box>
  );
}
