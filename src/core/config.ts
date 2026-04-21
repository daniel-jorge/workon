import { z } from "zod";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export const GlobalConfigSchema = z.object({
  roots: z.array(z.string()).default([]),
  maxDepth: z.number().int().min(1).default(3),
  defaultIde: z.enum(["code", "code-insiders"]).default("code"),
  defaultProfile: z.string().default(""),
  ignore: z
    .array(z.string())
    .default(["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**", "**/.venv/**"]),
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;

function getConfigPath(): string {
  return process.env["WORKONRC_PATH"] ?? join(homedir(), ".workonrc.json");
}

export function loadConfig(): GlobalConfig {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    const defaults = GlobalConfigSchema.parse({});
    saveConfig(defaults);
    return defaults;
  }
  const raw = JSON.parse(readFileSync(configPath, "utf-8")) as unknown;
  return GlobalConfigSchema.parse(raw);
}

export function saveConfig(config: GlobalConfig): void {
  const validated = GlobalConfigSchema.parse(config);
  writeFileSync(getConfigPath(), JSON.stringify(validated, null, 2), "utf-8");
}
