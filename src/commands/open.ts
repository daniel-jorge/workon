import { loadConfig } from "@/core/config.js";
import { scanProjects } from "@/core/scanner.js";
import { fuzzySearch } from "@/core/search.js";
import { openProject } from "@/core/launcher.js";
import type { Project } from "@/types.js";

// AC15 — disambiguation helper shared with pin.ts
export function disambiguate(name: string, results: Project[]): void {
  console.error(`Multiple projects match '${name}'. Please be more specific.`);
  for (const p of results) {
    if (p.isRemote) {
      console.error(`  ${p.name}  ssh://${p.sshHost}${p.remotePath} (remote)`);
    } else {
      console.error(`  ${p.name}  ${p.path} (local)`);
    }
  }
}

export async function openCommand(query: string): Promise<void> {
  const config = loadConfig();
  const projects = await scanProjects(config);
  const results = fuzzySearch(projects, query);
  if (results.length === 0) {
    console.error(`No project found matching '${query}'`);
    process.exit(1);
  }
  // AC15 — if multiple projects share the same name (local + remote), disambiguate
  const exactMatches = results.filter((p) => p.name === results[0]!.name);
  if (exactMatches.length > 1) {
    disambiguate(query, exactMatches);
    process.exit(1);
  }
  try {
    await openProject(results[0]!);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
