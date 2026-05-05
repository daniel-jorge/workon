import { existsSync } from "node:fs";
import type { GlobalConfig } from "@/core/config.js";

export function isPinned(projectPath: string, config: GlobalConfig): boolean {
  return config.pinned.includes(projectPath);
}

export function togglePin(projectPath: string, config: GlobalConfig): GlobalConfig {
  const pinnedSet = new Set(config.pinned);
  if (pinnedSet.has(projectPath)) {
    pinnedSet.delete(projectPath);
  } else {
    pinnedSet.add(projectPath);
  }
  return {
    ...config,
    pinned: Array.from(pinnedSet),
  };
}

export function deduplicatePins(paths: string[]): string[] {
  return Array.from(new Set(paths));
}

export function validatePinnedPaths(paths: string[]): {
  valid: string[];
  invalid: string[];
} {
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const path of paths) {
    // SSH URIs are always valid — they are managed via the remote cache,
    // not the local filesystem. Do not call existsSync on them. (NFR3)
    if (path.startsWith("ssh://") || existsSync(path)) {
      valid.push(path);
    } else {
      invalid.push(path);
    }
  }

  return { valid, invalid };
}
