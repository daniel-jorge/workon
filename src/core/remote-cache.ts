/**
 * FR4 — Local Scan Cache for Remote Projects
 *
 * Cache file: ~/.workon-remote-cache.json (or WORKON_CACHE_PATH env var)
 */
import { z } from "zod";
import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { GlobalConfig } from "./config.js";
import type { Project, ProjectType } from "@/types.js";

// ─── Schemas ────────────────────────────────────────────────────────────────

const CachedRemoteProjectSchema = z.object({
  name: z.string(),
  remotePath: z.string(),
  type: z.enum(["nodejs", "rust", "go", "python", "java", "dotnet", "generic"]),
  tags: z.array(z.string()).default([]),
  description: z.string().default(""),
  openCommand: z.string().default(""),
  profile: z.string().default(""),
  sshHost: z.string(),
});

const RemoteCacheEntrySchema = z.object({
  scannedAt: z.string(),
  projects: z.array(CachedRemoteProjectSchema),
});

const RemoteCacheSchema = z.object({
  version: z.number().default(1),
  roots: z.record(z.string(), RemoteCacheEntrySchema).default({}),
});

export type CachedRemoteProject = z.infer<typeof CachedRemoteProjectSchema>;
export type RemoteCacheEntry = z.infer<typeof RemoteCacheEntrySchema>;
export type RemoteCache = z.infer<typeof RemoteCacheSchema>;

export type RemoteRootStatus = {
  uri: string;
  status: "cached" | "never-scanned";
  lastScanned: string | null;
};

// ─── Cache path ─────────────────────────────────────────────────────────────

export function getCachePath(): string {
  return process.env["WORKON_CACHE_PATH"] ?? join(homedir(), ".workon-remote-cache.json");
}

// ─── Cache I/O ──────────────────────────────────────────────────────────────

const EMPTY_CACHE: RemoteCache = { version: 1, roots: {} };

/**
 * Loads the remote cache from disk.
 * Returns empty cache if the file is missing (wasCorrupted=false).
 * Returns empty cache with wasCorrupted=true if the file is invalid.
 */
export function loadRemoteCache(): { cache: RemoteCache; wasCorrupted: boolean } {
  const cachePath = getCachePath();
  if (!existsSync(cachePath)) {
    return { cache: { ...EMPTY_CACHE, roots: {} }, wasCorrupted: false };
  }
  try {
    const raw = JSON.parse(readFileSync(cachePath, "utf-8")) as unknown;
    const cache = RemoteCacheSchema.parse(raw);
    return { cache, wasCorrupted: false };
  } catch {
    return { cache: { ...EMPTY_CACHE, roots: {} }, wasCorrupted: true };
  }
}

/**
 * Saves the remote cache to disk atomically (write tmp → rename).
 */
export function saveRemoteCache(cache: RemoteCache): void {
  const cachePath = getCachePath();
  const tmpPath = `${cachePath}.tmp`;
  try {
    writeFileSync(tmpPath, JSON.stringify(cache, null, 2), "utf-8");
    renameSync(tmpPath, cachePath);
  } catch (err) {
    try {
      unlinkSync(tmpPath);
    } catch {
      // ignore cleanup error
    }
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to save remote cache: ${reason}`);
  }
}

// ─── Deduplication ──────────────────────────────────────────────────────────

/**
 * Deduplicates projects by remotePath, keeping the first occurrence.
 */
export function deduplicateRemoteProjects(projects: CachedRemoteProject[]): CachedRemoteProject[] {
  const seen = new Set<string>();
  return projects.filter((p) => {
    if (seen.has(p.remotePath)) return false;
    seen.add(p.remotePath);
    return true;
  });
}

// ─── Config-level remote root management ────────────────────────────────────

/**
 * Adds a normalised SSH URI to the remoteRoots array.
 * Throws if the URI is already configured.
 * Does NOT mutate the input config.
 */
export function addRemoteRootToConfig(config: GlobalConfig, normalizedUri: string): GlobalConfig {
  if (config.remoteRoots.includes(normalizedUri)) {
    throw new Error(`Remote root ${normalizedUri} is already configured.`);
  }
  return { ...config, remoteRoots: [...config.remoteRoots, normalizedUri] };
}

/**
 * Removes a normalised SSH URI from remoteRoots, deletes its cache entry,
 * and removes any pinned paths that belong to that remote root.
 * Throws if the URI is not currently configured.
 * Does NOT mutate the input config or cache.
 */
export function removeRemoteRootFromConfig(
  config: GlobalConfig,
  cache: RemoteCache,
  normalizedUri: string,
): { config: GlobalConfig; cache: RemoteCache; removedPinnedCount: number } {
  if (!config.remoteRoots.includes(normalizedUri)) {
    throw new Error(`Remote root ${normalizedUri} is not configured.`);
  }

  // Find all project paths under this remote root from the cache
  const cacheEntry = cache.roots[normalizedUri];
  const remoteProjectPaths = new Set<string>(
    (cacheEntry?.projects ?? []).map((p) => `ssh://${p.sshHost}${p.remotePath}`),
  );

  // Remove pins belonging to this root
  const remainingPins = config.pinned.filter((p) => !remoteProjectPaths.has(p));
  const removedPinnedCount = config.pinned.length - remainingPins.length;

  // Build updated cache without this root's entry
  const updatedRoots = { ...cache.roots };
  delete updatedRoots[normalizedUri];

  const updatedConfig: GlobalConfig = {
    ...config,
    remoteRoots: config.remoteRoots.filter((r) => r !== normalizedUri),
    pinned: remainingPins,
  };

  const updatedCache: RemoteCache = { ...cache, roots: updatedRoots };

  return { config: updatedConfig, cache: updatedCache, removedPinnedCount };
}

/**
 * Returns the status of each configured remote root derived from cache metadata.
 * Makes no SSH connections.
 */
export function listRemoteRootStatuses(
  config: GlobalConfig,
  cache: RemoteCache,
): RemoteRootStatus[] {
  return config.remoteRoots.map((uri) => {
    const entry = cache.roots[uri];
    if (entry) {
      // Extract YYYY-MM-DD from ISO timestamp
      const lastScanned = entry.scannedAt.slice(0, 10);
      return { uri, status: "cached" as const, lastScanned };
    }
    return { uri, status: "never-scanned" as const, lastScanned: null };
  });
}

// ─── Remote project loading ──────────────────────────────────────────────────

/**
 * Converts all cached remote projects for the configured remoteRoots into
 * Project objects. Deduplicates by SSH URI path.
 */
export function loadRemoteProjects(config: GlobalConfig, cache: RemoteCache): Project[] {
  const allProjects: CachedRemoteProject[] = [];

  for (const uri of config.remoteRoots) {
    const entry = cache.roots[uri];
    if (!entry) continue;
    allProjects.push(...entry.projects);
  }

  // Deduplicate across overlapping roots by remotePath (EC9, AC17)
  const deduped = deduplicateRemoteProjects(allProjects);

  return deduped.map((cp) => cachedProjectToProject(cp, config));
}

function cachedProjectToProject(cp: CachedRemoteProject, config: GlobalConfig): Project {
  const openCommand = cp.openCommand || config.defaultOpenCommand;
  const openCommandConfig = config.openCommands.find((c) => c.command === openCommand);
  const terminalApp = openCommandConfig?.terminal ?? false;
  const hasDevProject = Boolean(cp.description || cp.openCommand || cp.tags.length > 0);
  const path = `ssh://${cp.sshHost}${cp.remotePath}`;

  return {
    name: cp.name,
    path,
    type: cp.type as ProjectType,
    openCommand,
    terminalApp,
    profile: cp.profile,
    description: cp.description,
    tags: cp.tags,
    hasDevProject,
    isRemote: true,
    sshHost: cp.sshHost,
    remotePath: cp.remotePath,
  };
}
