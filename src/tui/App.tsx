import React, { useState, useMemo } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { SearchBar } from "@/tui/SearchBar.js";
import { ProjectList } from "@/tui/ProjectList.js";
import { HintBar } from "@/tui/HintBar.js";
import { IDEDialog } from "@/tui/IDEDialog.js";
import { fuzzySearch } from "@/core/search.js";
import { openProject } from "@/core/launcher.js";
import type { Project } from "@/types.js";

interface Props {
  projects: Project[];
}

export function App({ projects }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showIDEDialog, setShowIDEDialog] = useState(false);
  const [selectedDialogIde, setSelectedDialogIde] = useState(
    projects[selectedIndex]?.ide || "code",
  );
  const { stdout } = useStdout();

  const filtered = useMemo(() => fuzzySearch(projects, query), [projects, query]);

  // SearchBar (3) + HintBar (2) = 5 rows overhead
  // Each project item takes 2 lines, so divide available space by 2
  const maxVisible = Math.max(1, Math.floor(((stdout?.rows ?? 24) - 5) / 2));

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    setSelectedIndex(0);
  };

  useInput((input, key) => {
    // Don't process keyboard input while IDE dialog is open
    if (showIDEDialog) {
      return;
    }

    // Check for SHIFT+ENTER via both key object and raw escape sequence
    const isShiftEnter = (key.return && key.shift) || input?.includes(";2;13~");

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
    } else if (isShiftEnter && selectedIndex >= 0) {
      const project = filtered[selectedIndex];
      if (project) {
        setSelectedDialogIde(project.ide);
        setShowIDEDialog(true);
      }
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
      <Box borderStyle="bold" borderLeft={false} borderRight={false} borderDimColor={true} gap={1}>
        <SearchBar query={query} onChange={handleQueryChange} />
        <Text dimColor>{`${filtered.length} / ${projects.length} projects`}</Text>
      </Box>
      {!showIDEDialog && (
        <>
          <ProjectList projects={filtered} selectedIndex={selectedIndex} maxVisible={maxVisible} />
          <Box paddingTop={1}>
            <HintBar />
          </Box>
        </>
      )}
      {showIDEDialog && (
        <Box flexDirection="column" flexGrow={1} justifyContent="center" alignItems="center">
          <IDEDialog
            projectName={filtered[selectedIndex]?.name || "Unknown"}
            currentIde={selectedDialogIde}
            onSelect={(ide) => {
              const project = filtered[selectedIndex];
              if (project) {
                openProject(project, ide);
                process.exit(0);
              }
            }}
            onCancel={() => setShowIDEDialog(false)}
          />
        </Box>
      )}
    </Box>
  );
}
