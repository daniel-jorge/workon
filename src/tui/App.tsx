import React, { useState, useMemo, useEffect } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { SearchBar } from "@/tui/SearchBar.js";
import { ProjectList } from "@/tui/ProjectList.js";
import { HintBar } from "@/tui/HintBar.js";
import { OpenMenu } from "@/tui/OpenMenu.js";
import { ContextMenu } from "@/tui/ContextMenu.js";
import { Spinner } from "@/tui/Spinner.js";
import { fuzzySearch } from "@/core/search.js";
import { openProject } from "@/core/launcher.js";
import { scanProjects } from "@/core/scanner.js";
import { saveConfig } from "@/core/config.js";
import { togglePin, isPinned } from "@/core/pinning.js";
import type { Project } from "@/types.js";
import type { GlobalConfig } from "@/core/config.js";

interface Props {
  config: GlobalConfig;
}

export function App({ config }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showOpenMenu, setShowOpenMenu] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [currentConfig, setCurrentConfig] = useState(config);
  const { stdout } = useStdout();

  // Scan projects on component mount
  useEffect(() => {
    scanProjects(currentConfig).then((scannedProjects) => {
      setProjects(scannedProjects);
      setIsLoading(false);
    });
  }, [currentConfig]);

  const filtered = useMemo(() => fuzzySearch(projects, query), [projects, query]);

  // SearchBar (3) + HintBar (2) = 5 rows overhead
  // Each project item takes 2 lines, so divide available space by 2
  const maxVisible = Math.max(1, Math.floor(((stdout?.rows ?? 24) - 5) / 2));

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    setSelectedIndex(0);
  };

  useInput((input, key) => {
    // Exit immediately if Escape is pressed during loading
    if (isLoading && key.escape) {
      process.exit(0);
    }

    // Don't process keyboard input while Open menu is open
    if (showOpenMenu) {
      return;
    }

    // If context menu is open, useInput from ContextMenu handles input
    if (showContextMenu) {
      return;
    }

    const isMetaM = key.meta && input === "m";

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
    } else if (isMetaM && selectedIndex >= 0) {
      // Open context menu with META+M
      if (selectedIndex >= 0 && filtered[selectedIndex]) {
        setShowContextMenu(true);
      }
    } else if (key.return && selectedIndex >= 0) {
      // Open Open Menu on Enter
      const project = filtered[selectedIndex];
      if (project) {
        setShowOpenMenu(true);
      }
    }
  });

  return (
    <Box flexDirection="column" height={stdout?.rows}>
      {isLoading ? (
        <Spinner status="Scanning for projects…" />
      ) : (
        <>
          {!showOpenMenu && (
            <Box
              borderStyle="bold"
              borderLeft={false}
              borderRight={false}
              borderDimColor={true}
              gap={1}
            >
              <SearchBar query={query} onChange={handleQueryChange} />
              <Text dimColor>{`${filtered.length} / ${projects.length} projects`}</Text>
            </Box>
          )}
          {!showOpenMenu && (
            <>
              <ProjectList
                projects={filtered}
                selectedIndex={selectedIndex}
                maxVisible={maxVisible}
                config={currentConfig}
              />
              <Box paddingTop={1}>
                <HintBar />
              </Box>
            </>
          )}
          {showOpenMenu && (
            <Box flexDirection="column" flexGrow={1} justifyContent="center" alignItems="center">
              {filtered[selectedIndex] && (
                <OpenMenu
                  visible={showOpenMenu}
                  projectName={filtered[selectedIndex].name}
                  currentOpenCommand={filtered[selectedIndex].openCommand}
                  openCommands={currentConfig.openCommands}
                  isPinned={isPinned(filtered[selectedIndex].path, currentConfig)}
                  isMissing={filtered[selectedIndex].missing === true}
                  onSelectOpenCommand={async (command) => {
                    const project = filtered[selectedIndex];
                    if (project) {
                      await openProject(project, command);
                      setShowOpenMenu(false);
                    }
                  }}
                  onTogglePin={async () => {
                    const project = filtered[selectedIndex];
                    if (project) {
                      const updated = togglePin(project.path, currentConfig);
                      await saveConfig(updated);
                      setCurrentConfig(updated);
                      setShowOpenMenu(false);
                    }
                  }}
                  onCancel={() => setShowOpenMenu(false)}
                />
              )}
            </Box>
          )}
          {showContextMenu && (
            <Box flexDirection="column" flexGrow={1} justifyContent="center" alignItems="center">
              <ContextMenu
                visible={showContextMenu}
                options={[
                  {
                    label: "Pin",
                    key: "P",
                    action: async () => {
                      const project = filtered[selectedIndex];
                      if (project && !project.missing) {
                        const updated = togglePin(project.path, currentConfig);
                        await saveConfig(updated);
                        setCurrentConfig(updated);
                      }
                    },
                  },
                ]}
                onClose={() => setShowContextMenu(false)}
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
