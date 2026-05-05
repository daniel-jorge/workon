/**
 * FR3 — Remote Project Scanning via SSH
 *
 * Connects to a remote host using the system ssh binary and executes
 * a single find-based shell script to discover projects.
 */
import { execa } from "execa";
import { parseSSHUri } from "./remote-uri.js";
import type { GlobalConfig } from "./config.js";
import type { CachedRemoteProject, RemoteCache } from "./remote-cache.js";
import type { ProjectType } from "@/types.js";

// ─── Marker → ProjectType mapping ───────────────────────────────────────────

const MARKER_TO_TYPE: Record<string, ProjectType> = {
  "package.json": "nodejs",
  "Cargo.toml": "rust",
  "go.mod": "go",
  "requirements.txt": "python",
  "pyproject.toml": "python",
  "setup.py": "python",
  "pom.xml": "java",
  "build.gradle": "java",
  "build.gradle.kts": "java",
};

const ALL_MARKERS = [
  "package.json",
  "Cargo.toml",
  "go.mod",
  "requirements.txt",
  "pyproject.toml",
  "setup.py",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "*.csproj",
  "*.sln",
];

// ─── Remote scan script ──────────────────────────────────────────────────────

/**
 * Builds the shell script to execute on the remote host.
 * The script uses `find` to locate marker files and reads .workonrc.json
 * per project. Each discovered project is emitted as a single JSON line.
 */
export function buildRemoteScanScript(
  rootPath: string,
  maxDepth: number,
  ignorePatterns: string[],
): string {
  // Build prune clauses for ignore patterns
  const pruneClauseParts = ignorePatterns.map((pattern) => {
    // Convert glob pattern like **/node_modules/** to a find -path prune
    const core = pattern.replace(/^\*\*\//, "").replace(/\/\*\*$/, "");
    return `-path '*/${core}*' -prune`;
  });
  const pruneClause =
    pruneClauseParts.length > 0 ? `\\( ${pruneClauseParts.join(" -o ")} \\) -o` : "";

  // Build -name clauses for marker files
  const markerClauses = ALL_MARKERS.map((m) => `-name '${m}'`).join(" -o ");

  return `
set -e
find '${rootPath}' -maxdepth ${maxDepth} ${pruneClause} \\( ${markerClauses} \\) -print 2>/dev/null | while IFS= read -r markerFile; do
  projectDir="$(dirname "$markerFile")"
  markerName="$(basename "$markerFile")"
  rcFile="$projectDir/.workonrc.json"
  if [ -f "$rcFile" ]; then
    rcContent="$(cat "$rcFile" 2>/dev/null || echo '')"
  else
    rcContent=""
  fi
  printf '%s\\n' "$(printf '{"path":"%s","marker":"%s","config":%s}' "$projectDir" "$markerName" "\${rcContent:-null}")"
done
`.trim();
}

// ─── Output parsing ──────────────────────────────────────────────────────────

interface RemoteScanLine {
  path: string;
  marker: string;
  config: string | null;
}

interface WorkonRcJson {
  name?: string;
  description?: string;
  openCommand?: string;
  profile?: string;
  tags?: string[];
}

/**
 * Parses the newline-delimited JSON output from the remote scan script
 * into CachedRemoteProject objects.
 * Malformed .workonrc.json entries produce a warning and use defaults.
 */
export function parseRemoteScanOutput(
  raw: string,
  sshHost: string,
  _rootPath: string,
): { projects: CachedRemoteProject[]; warnings: string[] } {
  const projects: CachedRemoteProject[] = [];
  const warnings: string[] = [];
  // Track seen project paths to avoid duplicates (can happen if multiple markers
  // exist in the same directory)
  const seen = new Set<string>();

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let scanLine: RemoteScanLine;
    try {
      scanLine = JSON.parse(trimmed) as RemoteScanLine;
    } catch {
      // Skip unparseable lines (e.g. SSH banners)
      continue;
    }

    const { path: projectPath, marker, config: configStr } = scanLine;
    if (!projectPath || !marker) continue;

    // Deduplicate by project path
    if (seen.has(projectPath)) continue;
    seen.add(projectPath);

    const projectName = projectPath.split("/").pop() ?? projectPath;
    const type = detectTypeFromMarker(marker);

    let name = projectName;
    let description = "";
    let openCommand = "";
    let profile = "";
    let tags: string[] = [];

    // Parse per-project .workonrc.json if present
    if (configStr !== null && configStr !== "") {
      try {
        const rc = JSON.parse(configStr) as WorkonRcJson;
        name = rc.name ?? projectName;
        description = rc.description ?? "";
        openCommand = rc.openCommand ?? "";
        profile = rc.profile ?? "";
        tags = rc.tags ?? [];
      } catch {
        warnings.push(
          `⚠ Could not parse .workonrc.json for ${projectName} on ${sshHost.split("@")[1] ?? sshHost} — using defaults`,
        );
      }
    }

    projects.push({
      name,
      remotePath: projectPath,
      type,
      tags,
      description,
      openCommand,
      profile,
      sshHost,
    });
  }

  return { projects, warnings };
}

function detectTypeFromMarker(marker: string): ProjectType {
  // Handle exact matches first
  const exact = MARKER_TO_TYPE[marker];
  if (exact) return exact;
  // Handle glob-like patterns (*.csproj, *.sln)
  if (marker.endsWith(".csproj") || marker.endsWith(".sln")) return "dotnet";
  return "generic";
}

// ─── Single-root SSH scan ────────────────────────────────────────────────────

/**
 * Scans a single remote root over SSH.
 * Returns projects on success, or an error string on failure.
 * The remote host is not contacted if the URI is invalid.
 */
export async function scanRemoteRoot(
  uri: string,
  config: GlobalConfig,
): Promise<{ projects: CachedRemoteProject[]; error?: string }> {
  let parsed;
  try {
    const { parseSSHUri: p } = await import("./remote-uri.js");
    parsed = p(uri);
  } catch (err) {
    return {
      projects: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const script = buildRemoteScanScript(parsed.path, config.maxDepth, config.ignore);

  try {
    const result = await execa("ssh", [parsed.sshHost, "bash", "-s"], {
      input: script,
      timeout: 30_000,
      reject: false,
    });

    if (result.exitCode !== 0 && !result.stdout) {
      return {
        projects: [],
        error: result.stderr || `ssh exited with code ${result.exitCode}`,
      };
    }

    const { projects, warnings } = parseRemoteScanOutput(
      result.stdout,
      parsed.sshHost,
      parsed.path,
    );

    // Warnings are logged but don't prevent returning results
    for (const w of warnings) {
      process.stderr.write(w + "\n");
    }

    return { projects };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { projects: [], error: message };
  }
}

// ─── Multi-root scan (FR5, AC7, AC8) ────────────────────────────────────────

/**
 * Rescans all remote roots in config.remoteRoots.
 * On success for a root: updates cache entry.
 * On failure: preserves existing cache entry and records error.
 * Returns updated cache and list of error messages.
 */
export async function scanRemoteRoots(
  config: GlobalConfig,
  cache: RemoteCache,
): Promise<{ cache: RemoteCache; errors: string[] }> {
  const updatedRoots = { ...cache.roots };
  const errors: string[] = [];

  for (const uri of config.remoteRoots) {
    const result = await scanRemoteRoot(uri, config);

    if (result.error) {
      // Preserve existing cache entry if available
      errors.push(`⚠ ${uri} unreachable — ${result.error}`);
      // updatedRoots[uri] already preserved from the spread above
    } else {
      updatedRoots[uri] = {
        scannedAt: new Date().toISOString(),
        projects: result.projects,
      };
    }
  }

  return {
    cache: { ...cache, roots: updatedRoots },
    errors,
  };
}
