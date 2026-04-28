import { z } from "zod";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const OpenCommandSchema = z.object({
  name: z.string(),
  command: z.string(),
});

const DEFAULT_OPEN_COMMANDS = [
  { name: "Visual Studio Code", command: "code" },
  { name: "VS Code Insiders", command: "code-insiders" },
];

export const GlobalConfigSchema = z.preprocess(
  (raw) => {
    // Migration: if old config has defaultIde but not defaultOpenCommand, copy it
    if (typeof raw === "object" && raw !== null) {
      const obj = raw as Record<string, unknown>;
      if (obj.defaultIde && !obj.defaultOpenCommand) {
        obj.defaultOpenCommand = obj.defaultIde;
      }
    }
    return raw;
  },
  z.object({
    roots: z.array(z.string()).default([]),
    maxDepth: z.number().int().min(1).default(3),
    defaultOpenCommand: z.string().default("code"),
    openCommands: z.array(OpenCommandSchema).default(DEFAULT_OPEN_COMMANDS),
    defaultProfile: z.string().default(""),
    ignore: z
      .array(z.string())
      .default(["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**", "**/.venv/**"]),
    pinned: z.array(z.string()).default([]),
  }),
);

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
