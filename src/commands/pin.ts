import type { Command } from "commander";
import { loadConfig, saveConfig } from "@/core/config.js";
import { scanProjects } from "@/core/scanner.js";
import { fuzzySearch } from "@/core/search.js";
import { togglePin, isPinned } from "@/core/pinning.js";
import { openProject } from "@/core/launcher.js";

async function listPinned(): Promise<void> {
  const config = loadConfig();
  const projects = await scanProjects(config);

  if (config.pinned.length === 0) {
    console.log("No pinned projects. Add one with: workon pin toggle <project-name>");
    return;
  }

  for (const path of config.pinned) {
    const project = projects.find((p) => p.path === path);
    if (project) {
      console.log(`[📌] ${project.name} — ${project.path}`);
    } else {
      console.log(`[📌] ${path} (not found)`);
    }
  }
}

async function openPinned(name: string): Promise<void> {
  const config = loadConfig();
  const projects = await scanProjects(config);
  const pinnedProjects = projects.filter((p) => isPinned(p.path, config) && !p.missing);

  const results = fuzzySearch(pinnedProjects, name);
  if (results.length === 0) {
    console.error(`Project '${name}' not found in pinned projects`);
    process.exit(1);
  }

  const project = results[0];
  openProject(project);
  process.exit(0);
}

async function togglePinCli(name: string): Promise<void> {
  const config = loadConfig();
  const projects = await scanProjects(config);

  // Filter out missing projects for search
  const searchableProjects = projects.filter((p) => !p.missing);
  const results = fuzzySearch(searchableProjects, name);

  if (results.length === 0) {
    console.error(`Project '${name}' not found`);
    process.exit(1);
  }

  const project = results[0];
  const updated = togglePin(project.path, config);
  await saveConfig(updated);

  if (isPinned(project.path, updated)) {
    console.log(`✓ Pinned: ${project.name}`);
  } else {
    console.log(`✓ Unpinned: ${project.name}`);
  }
}

export function registerPinCommand(program: Command): void {
  const pin = program.command("pin").description("Manage pinned projects");

  pin
    .command("list")
    .description("List all pinned projects")
    .action(() => {
      listPinned().catch((err) => {
        console.error("Error listing pinned projects:", err);
        process.exit(1);
      });
    });

  pin
    .command("open <name>")
    .description("Open a pinned project by name")
    .action((name: string) => {
      openPinned(name).catch((err) => {
        console.error("Error opening pinned project:", err);
        process.exit(1);
      });
    });

  pin
    .command("toggle <name>")
    .description("Toggle pin status for a project")
    .action((name: string) => {
      togglePinCli(name).catch((err) => {
        console.error("Error toggling pin status:", err);
        process.exit(1);
      });
    });
}
