import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import type { ProjectType } from "../types.js";

export interface ProjectMetadata {
  name?: string;
  description?: string;
}

/**
 * Parse Node.js package.json for name and description
 */
function parseNodejsMetadata(projectPath: string): ProjectMetadata | null {
  try {
    const packageJsonPath = join(projectPath, "package.json");
    if (!existsSync(packageJsonPath)) return null;
    const content = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    return {
      name: content.name,
      description: content.description,
    };
  } catch {
    return null;
  }
}

/**
 * Parse Rust Cargo.toml for name and description
 */
function parseRustMetadata(projectPath: string): ProjectMetadata | null {
  try {
    const cargoTomlPath = join(projectPath, "Cargo.toml");
    if (!existsSync(cargoTomlPath)) return null;

    const content = readFileSync(cargoTomlPath, "utf-8");
    const nameMatch = content.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
    const descriptionMatch = content.match(/^\s*description\s*=\s*["']([^"']+)["']/m);

    return {
      name: nameMatch?.[1],
      description: descriptionMatch?.[1],
    };
  } catch {
    return null;
  }
}

/**
 * Parse Python pyproject.toml or setup.py for name and description
 */
function parsePythonMetadata(projectPath: string): ProjectMetadata | null {
  try {
    // Try pyproject.toml first
    const pyprojectPath = join(projectPath, "pyproject.toml");
    if (existsSync(pyprojectPath)) {
      const content = readFileSync(pyprojectPath, "utf-8");
      // Try to parse as TOML - look for [project] section
      const nameMatch = content.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
      const descriptionMatch = content.match(/^\s*description\s*=\s*["']([^"']+)["']/m);
      if (nameMatch || descriptionMatch) {
        return {
          name: nameMatch?.[1],
          description: descriptionMatch?.[1],
        };
      }
    }

    // Try setup.py
    const setupPyPath = join(projectPath, "setup.py");
    if (existsSync(setupPyPath)) {
      const content = readFileSync(setupPyPath, "utf-8");
      const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
      const descriptionMatch = content.match(/description\s*=\s*["']([^"']+)["']/);
      if (nameMatch || descriptionMatch) {
        return {
          name: nameMatch?.[1],
          description: descriptionMatch?.[1],
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Parse Go go.mod for module name
 */
function parseGoMetadata(projectPath: string): ProjectMetadata | null {
  try {
    const goModPath = join(projectPath, "go.mod");
    if (!existsSync(goModPath)) return null;

    const content = readFileSync(goModPath, "utf-8");
    const moduleMatch = content.match(/^module\s+(.+)$/m);

    return {
      name: moduleMatch?.[1],
    };
  } catch {
    return null;
  }
}

/**
 * Parse Java pom.xml for artifactId and description
 */
function parseJavaMetadata(projectPath: string): ProjectMetadata | null {
  try {
    const pomPath = join(projectPath, "pom.xml");
    if (!existsSync(pomPath)) return null;

    const content = readFileSync(pomPath, "utf-8");
    const nameMatch = content.match(/<artifactId>([^<]+)<\/artifactId>/);
    const descriptionMatch = content.match(/<description>([^<]+)<\/description>/);

    return {
      name: nameMatch?.[1],
      description: descriptionMatch?.[1],
    };
  } catch {
    return null;
  }
}

/**
 * Parse .NET .csproj for AssemblyName and AssemblyDescription
 */
function parseDotnetMetadata(projectPath: string): ProjectMetadata | null {
  try {
    // Find the first .csproj file
    const files = readdirSync(projectPath);
    const csprojFile = files.find((f) => f.endsWith(".csproj"));
    if (!csprojFile) return null;

    const csprojPath = join(projectPath, csprojFile);
    const content = readFileSync(csprojPath, "utf-8");
    const nameMatch = content.match(/<AssemblyName>([^<]+)<\/AssemblyName>/);
    const descriptionMatch = content.match(/<AssemblyDescription>([^<]+)<\/AssemblyDescription>/);

    return {
      name: nameMatch?.[1],
      description: descriptionMatch?.[1],
    };
  } catch {
    return null;
  }
}

/**
 * Extract first non-empty line from README.md, truncated to 100 chars
 */
export function extractReadmeFirstLine(projectPath: string): string | null {
  try {
    const readmePath = join(projectPath, "README.md");
    if (!existsSync(readmePath)) return null;

    const content = readFileSync(readmePath, "utf-8");
    const lines = content.split("\n");

    for (const line of lines) {
      // Clean up markdown headers and whitespace
      let cleanedLine = line.replace(/^#+\s*/, "").trim();
      if (cleanedLine.length === 0) continue;

      // Truncate to 100 chars at word boundary
      if (cleanedLine.length > 100) {
        cleanedLine = cleanedLine.substring(0, 100);
        // Try to truncate at word boundary
        const lastSpace = cleanedLine.lastIndexOf(" ");
        if (lastSpace > 50) {
          cleanedLine = cleanedLine.substring(0, lastSpace);
        }
        cleanedLine += "…";
      }

      return cleanedLine;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Guess project metadata from manifest files and README
 */
export function guessProjectMetadata(
  projectPath: string,
  projectType: ProjectType,
): ProjectMetadata {
  let metadata: ProjectMetadata | null = null;

  // Parse manifest based on project type
  switch (projectType) {
    case "nodejs":
      metadata = parseNodejsMetadata(projectPath);
      break;
    case "rust":
      metadata = parseRustMetadata(projectPath);
      break;
    case "python":
      metadata = parsePythonMetadata(projectPath);
      break;
    case "go":
      metadata = parseGoMetadata(projectPath);
      break;
    case "java":
      metadata = parseJavaMetadata(projectPath);
      break;
    case "dotnet":
      metadata = parseDotnetMetadata(projectPath);
      break;
    case "generic":
      metadata = null;
      break;
  }

  if (!metadata) {
    metadata = {};
  }

  // Fallback to README first line for description if not found in manifest
  if (!metadata.description) {
    const readmeDesc = extractReadmeFirstLine(projectPath);
    if (readmeDesc) {
      metadata.description = readmeDesc;
    }
  }

  // Fallback to directory basename for name if not found in manifest
  if (!metadata.name) {
    metadata.name = basename(projectPath);
  }

  return metadata;
}
