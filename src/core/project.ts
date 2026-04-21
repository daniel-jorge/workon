import { existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import type { ProjectType, Project } from "../types.js";
import type { GlobalConfig } from "./config.js";
import type { DevProject } from "./devproject.js";

function hasDotnetMarker(dir: string): boolean {
  try {
    return readdirSync(dir).some((f) => f.endsWith(".csproj") || f.endsWith(".sln"));
  } catch {
    return false;
  }
}

export function detectProjectType(dir: string): ProjectType | null {
  if (existsSync(join(dir, "package.json"))) return "nodejs";
  if (existsSync(join(dir, "Cargo.toml"))) return "rust";
  if (existsSync(join(dir, "go.mod"))) return "go";
  if (
    existsSync(join(dir, "pyproject.toml")) ||
    existsSync(join(dir, "setup.py")) ||
    existsSync(join(dir, "requirements.txt"))
  )
    return "python";
  if (existsSync(join(dir, "pom.xml")) || existsSync(join(dir, "build.gradle"))) return "java";
  if (hasDotnetMarker(dir)) return "dotnet";
  if (existsSync(join(dir, ".git"))) return "generic";
  return null;
}

export function mergeProject(
  dir: string,
  globalConfig: GlobalConfig,
  devProject?: DevProject | null,
): Project {
  const type = detectProjectType(dir) ?? "generic";
  return {
    name: devProject?.name ?? basename(dir),
    path: dir,
    type,
    ide: devProject?.ide ?? globalConfig.defaultIde,
    profile: devProject?.profile ?? globalConfig.defaultProfile,
    description: devProject?.description ?? "",
    tags: devProject?.tags ?? [],
    hasDevProject: devProject != null,
  };
}
