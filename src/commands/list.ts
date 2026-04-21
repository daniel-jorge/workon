import { loadConfig } from "../core/config.js";
import { scanProjects } from "../core/scanner.js";

export async function listCommand(): Promise<void> {
  const config = loadConfig();
  const projects = await scanProjects(config);
  for (const project of projects) {
    console.log(`${project.name}\t${project.path}`);
  }
}
