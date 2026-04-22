import { loadConfig } from "@/core/config.js";
import { scanProjects } from "@/core/scanner.js";
import { fuzzySearch } from "@/core/search.js";
import { openProject } from "@/core/launcher.js";

export async function openCommand(query: string): Promise<void> {
  const config = loadConfig();
  const projects = await scanProjects(config);
  const results = fuzzySearch(projects, query);
  if (results.length === 0) {
    console.error(`No project found matching '${query}'`);
    process.exit(1);
  }
  openProject(results[0]);
}
