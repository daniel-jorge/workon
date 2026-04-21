import fg from "fast-glob";
import { detectProjectType, mergeProject } from "./project.js";
import { loadDevProject } from "./devproject.js";
import type { GlobalConfig } from "./config.js";
import type { Project } from "../types.js";

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

  return projects.sort((a, b) => a.name.localeCompare(b.name));
}
