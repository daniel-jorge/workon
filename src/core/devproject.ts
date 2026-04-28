import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const DevProjectSchema = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    openCommand: z.string().optional(),
    profile: z.string().optional(),
    tags: z.array(z.string()).default([]),
  })
  .transform((project) => {
    // Migration: if old project has ide, migrate to openCommand
    const raw = project as Record<string, unknown>;
    if (!raw.openCommand && raw.ide) {
      project.openCommand = raw.ide as string;
    }
    return project;
  });

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
