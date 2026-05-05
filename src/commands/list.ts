import { loadConfig } from "@/core/config.js";
import { scanProjects } from "@/core/scanner.js";
import { isPinned } from "@/core/pinning.js";

// FR6 — Remote display marker
function formatProjectLine(
  project: import("@/types.js").Project,
  config: import("@/core/config.js").GlobalConfig,
): string {
  const pin = isPinned(project.path, config) ? "\uD83D\uDCCC " : "";
  if (project.isRemote) {
    return `${pin}\u2381 ${project.name}  [${project.sshHost}]`;
  }
  return `${pin}${project.name}\t${project.path}`;
}

export async function listCommand(): Promise<void> {
  const config = loadConfig();
  const projects = await scanProjects(config);
  for (const project of projects) {
    console.log(formatProjectLine(project, config));
  }
}
