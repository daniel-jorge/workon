import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const DevProjectSchema = z.preprocess(
  (raw) => {
    // Migration: if old project has ide, migrate to openCommand
    if (typeof raw === "object" && raw !== null) {
      const obj = raw as Record<string, unknown>;
      if (obj.ide && !obj.openCommand) {
        obj.openCommand = obj.ide;
      }
    }
    return raw;
  },
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    openCommand: z.string().optional(),
    profile: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
);

export type DevProject = z.infer<typeof DevProjectSchema>;

export function loadDevProject(dir: string): DevProject | null {
  const devProjectPath = join(dir, ".workonrc.json");
  if (!existsSync(devProjectPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(devProjectPath, "utf-8")) as unknown;
    return DevProjectSchema.parse(raw);
  } catch {
    return null;
  }
}
