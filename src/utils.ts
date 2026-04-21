import { homedir } from "node:os";

/**
 * Format a path by replacing home directory with ~ and trimming if too long
 * @param path The path to format
 * @param maxLength The maximum length of the returned string (default: 50)
 * @returns The formatted path
 */
export function trimPath(path: string, maxLength: number = 50): string {
  const home = homedir();
  let formatted = path.startsWith(home) ? `~${path.slice(home.length)}` : path;

  if (formatted.length <= maxLength) {
    return formatted;
  }

  const suffix = formatted.slice(-(maxLength - 3)); // -3 for "..."
  return `...${suffix}`;
}
