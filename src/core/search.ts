import Fuse from "fuse.js";
import type { Project } from "@/types.js";

export function fuzzySearch(projects: Project[], query: string): Project[] {
  if (!query) return projects;
  const fuse = new Fuse(projects, {
    keys: ["name", "path", "tags"],
    threshold: 0.4,
    includeScore: true,
  });
  return fuse.search(query).map((r) => r.item);
}
