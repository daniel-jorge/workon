import fg from "fast-glob";
import { detectProjectType, mergeProject } from "./project.js";
import { loadDevProject } from "./devproject.js";
import { isPinned } from "./pinning.js";
import { loadRemoteCache, loadRemoteProjects } from "./remote-cache.js";
import type { GlobalConfig } from "./config.js";
import type { Project } from "@/types.js";

export async function scanProjects(config: GlobalConfig): Promise<Project[]> {
  const projects: Project[] = [];

  for (const root of config.roots) {
    let dirs: string[];
    try {
      dirs = await fg("**", {
        cwd: root,
        onlyDirectories: true,
        deep: config.maxDepth,
        ignore: config.ignore,
        absolute: true,
        followSymbolicLinks: false,
      });
    } catch {
      continue;
    }

    for (const dir of dirs) {
      if (detectProjectType(dir) === null) continue;
      const devProject = loadDevProject(dir);
      projects.push(mergeProject(dir, config, devProject));
    }
  }

  // Merge remote projects from cache (AC3, AC4)
  if ((config.remoteRoots?.length ?? 0) > 0) {
    const { cache, wasCorrupted } = loadRemoteCache();
    if (wasCorrupted) {
      process.stderr.write(
        "⚠ Remote project cache is empty or corrupted. Run 'workon scan --remote' to rebuild.\n",
      );
    }
    const remoteProjects = loadRemoteProjects(config, cache);
    projects.push(...remoteProjects);
  }

  // Sort alphabetically
  projects.sort((a, b) => a.name.localeCompare(b.name));

  // Build the set of found paths for missing-pin detection.
  // Remote project paths (SSH URIs) are present in projects if cached.
  const foundPaths = new Set(projects.map((p) => p.path));

  // Add placeholder projects for missing pinned paths.
  // SSH URIs that are pinned but not in the cache are shown as missing.
  // SSH URIs that ARE in the cache are not missing (EC4, NFR3).
  for (const pinnedPath of config.pinned) {
    if (!foundPaths.has(pinnedPath)) {
      projects.push({
        name: pinnedPath,
        path: pinnedPath,
        type: "generic",
        openCommand: config.defaultOpenCommand,
        profile: config.defaultProfile,
        description: "(not found)",
        tags: [],
        hasDevProject: false,
        missing: true,
      });
    }
  }

  // Split into pinned and unpinned, maintaining alphabetical order within each group
  const pinned: Project[] = [];
  const unpinned: Project[] = [];

  for (const project of projects) {
    if (isPinned(project.path, config)) {
      pinned.push(project);
    } else {
      unpinned.push(project);
    }
  }

  // Keep alphabetical order within each group
  pinned.sort((a, b) => a.name.localeCompare(b.name));
  unpinned.sort((a, b) => a.name.localeCompare(b.name));

  return [...pinned, ...unpinned];
}
