import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "@/core/config.js";
import { detectProjectType } from "@/core/project.js";
import { guessProjectMetadata } from "@/core/metadata.js";

export function initCommand(): void {
  const cwd = process.cwd();
  const devProjectPath = join(cwd, ".workonrc.json");
  if (existsSync(devProjectPath)) {
    console.error(".workonrc.json already exists in this directory.");
    process.exit(1);
  }

  const config = loadConfig();
  const type = detectProjectType(cwd) ?? "generic";
  const guessedMetadata = guessProjectMetadata(cwd, type);

  const devProject = {
    name: guessedMetadata.name ?? "",
    description: guessedMetadata.description ?? "",
    ide: config.defaultIde,
    profile: config.defaultProfile,
    tags: [] as string[],
  };

  writeFileSync(devProjectPath, JSON.stringify(devProject, null, 2), "utf-8");
  console.log(
    `.workonrc.json created (type detected: ${type}). Edit it to customize your project settings.`,
  );
}
