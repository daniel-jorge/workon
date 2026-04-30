import { z } from "zod";
import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execa } from "execa";

const OpenCommandSchema = z.object({
  name: z.string(),
  command: z.string(),
  terminal: z.boolean().optional(),
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
  const configPath = getConfigPath();
  const tmpPath = `${configPath}.tmp`;
  try {
    writeFileSync(tmpPath, JSON.stringify(validated, null, 2), "utf-8");
    renameSync(tmpPath, configPath);
  } catch (err) {
    try {
      unlinkSync(tmpPath);
    } catch {
      // ignore cleanup error
    }
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to save config: ${reason}. Your config has NOT been changed.`);
  }
}

export function addOpenCommand(
  cfg: GlobalConfig,
  name: string,
  command: string,
  terminal = false,
): GlobalConfig {
  const dupName = cfg.openCommands.find((c) => c.name === name);
  if (dupName) {
    throw new Error(
      `Error: A command with display name '${name}' already exists. Use 'workon config remove-command <executable>' first to replace it.`,
    );
  }
  const dupCmd = cfg.openCommands.find((c) => c.command === command);
  if (dupCmd) {
    throw new Error(
      `Error: The executable '${command}' is already configured under display name '${dupCmd.name}'. Each executable must be unique.`,
    );
  }
  return {
    ...cfg,
    openCommands: [
      ...cfg.openCommands,
      { name, command, ...(terminal ? { terminal } : {}), ...(terminal ? { terminal } : {}) },
    ],
  };
}

export function removeOpenCommand(
  cfg: GlobalConfig,
  command: string,
): { config: GlobalConfig; promotedTo: string | null; wasLast: boolean } {
  const idx = cfg.openCommands.findIndex((c) => c.command === command);
  if (idx === -1) {
    const available = cfg.openCommands.map((c) => c.command).join(", ");
    throw new Error(`Error: No executable '${command}' found. Available: ${available}`);
  }

  const removed = cfg.openCommands[idx]!;
  const remaining = cfg.openCommands.filter((_, i) => i !== idx);

  if (remaining.length === 0) {
    return {
      config: { ...cfg, openCommands: [], defaultOpenCommand: "" },
      promotedTo: null,
      wasLast: true,
    };
  }

  const wasDefault = removed.command === cfg.defaultOpenCommand;
  const promotedTo = wasDefault ? remaining[0]!.command : null;
  const newDefault = wasDefault ? promotedTo! : cfg.defaultOpenCommand;

  return {
    config: { ...cfg, openCommands: remaining, defaultOpenCommand: newDefault },
    promotedTo,
    wasLast: false,
  };
}

export function setDefaultOpenCommand(cfg: GlobalConfig, executable: string): GlobalConfig {
  const exists = cfg.openCommands.some((c) => c.command === executable);
  if (!exists) {
    const available = cfg.openCommands.map((c) => c.command).join(", ");
    throw new Error(`Error: No executable '${executable}' found. Available: ${available}`);
  }
  return { ...cfg, defaultOpenCommand: executable };
}

export function listOpenCommands(
  cfg: GlobalConfig,
): Array<{ name: string; command: string; terminal: boolean; isDefault: boolean }> {
  return cfg.openCommands.map((c) => ({
    name: c.name,
    command: c.command,
    terminal: c.terminal ?? false,
    isDefault: c.command === cfg.defaultOpenCommand,
  }));
}

export async function isExecutableInPath(executable: string): Promise<boolean> {
  try {
    await execa("which", [executable]);
    return true;
  } catch {
    return false;
  }
}
