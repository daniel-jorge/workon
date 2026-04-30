import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Command } from "commander";

// Mock execa so isExecutableInPath doesn't require real binaries on the test machine
vi.mock("execa", () => ({
  execa: vi.fn(),
}));

let tmpDir: string;

beforeEach(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "workon-test-"));
  process.env["WORKONRC_PATH"] = join(tmpDir, ".workonrc.json");
  // Initialise the config file so every test starts with a clean default state
  const { loadConfig } = await import("@/core/config.js");
  loadConfig();
});

afterEach(() => {
  delete process.env["WORKONRC_PATH"];
  rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readConfig() {
  return JSON.parse(readFileSync(join(tmpDir, ".workonrc.json"), "utf-8")) as {
    openCommands: Array<{ name: string; command: string }>;
    defaultOpenCommand: string;
  };
}

class ProcessExitError extends Error {
  constructor(public readonly code: number) {
    super(`process.exit(${code})`);
    this.name = "ProcessExitError";
  }
}

type RunResult = {
  exitCode: number;
  logs: string[];
  errors: string[];
  warnings: string[];
};

/**
 * Creates a fresh Commander program, registers all config subcommands, captures
 * console output and process.exit calls, then parses the supplied arguments.
 */
async function runConfigCommand(...args: string[]): Promise<RunResult> {
  const { registerConfigCommand } = await import("@/commands/config.js");

  const program = new Command();
  // Throw instead of calling process.exit on Commander-level errors (e.g. missing required option)
  program.exitOverride();
  registerConfigCommand(program);

  const logs: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let exitCode = 0;

  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => {
    logs.push(String(a[0]));
  });
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
    errors.push(String(a[0]));
  });
  vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => {
    warnings.push(String(a[0]));
  });
  vi.spyOn(process, "exit").mockImplementation((code?: number) => {
    exitCode = code ?? 0;
    throw new ProcessExitError(code ?? 0);
  });

  try {
    await program.parseAsync(["node", "workon", "config", ...args]);
  } catch (e) {
    if (e instanceof ProcessExitError) {
      // exit code already captured
    } else if (
      e instanceof Error &&
      "code" in e &&
      typeof (e as { code: unknown }).code === "string" &&
      (e as { code: string }).code.startsWith("commander.")
    ) {
      // Commander parse error (e.g. missing required option)
      exitCode = 1;
    } else {
      throw e;
    }
  }

  return { exitCode, logs, errors, warnings };
}

// ---------------------------------------------------------------------------
// add-command
// ---------------------------------------------------------------------------

describe("config add-command", () => {
  it("happy path: persists new entry and prints success message", async () => {
    const { execa } = await import("execa");
    vi.mocked(execa).mockResolvedValue({ exitCode: 0 } as never);

    const result = await runConfigCommand("add-command", "--name", "Cursor", "--command", "cursor");

    expect(result.exitCode).toBe(0);
    expect(result.logs.join("\n")).toContain("Added open command: Cursor (cursor)");
    const cfg = readConfig();
    expect(cfg.openCommands).toContainEqual({ name: "Cursor", command: "cursor" });
  });

  it("added command is immediately visible in list-commands", async () => {
    const { execa } = await import("execa");
    vi.mocked(execa).mockResolvedValue({ exitCode: 0 } as never);

    await runConfigCommand("add-command", "--name", "Cursor", "--command", "cursor");
    const { logs } = await runConfigCommand("list-commands");

    expect(logs.join("\n")).toContain("Cursor");
    expect(logs.join("\n")).toContain("cursor");
  });

  it("multiple adds maintain insertion order", async () => {
    const { execa } = await import("execa");
    vi.mocked(execa).mockResolvedValue({ exitCode: 0 } as never);

    await runConfigCommand("add-command", "--name", "Cursor", "--command", "cursor");
    await runConfigCommand("add-command", "--name", "Zed", "--command", "zed");

    const cfg = readConfig();
    const commands = cfg.openCommands.map((c) => c.command);
    expect(commands.indexOf("cursor")).toBeLessThan(commands.indexOf("zed"));
  });

  it("duplicate display name: exits 1 and does not modify config", async () => {
    const { execa } = await import("execa");
    vi.mocked(execa).mockResolvedValue({ exitCode: 0 } as never);

    const before = readConfig();
    const result = await runConfigCommand(
      "add-command",
      "--name",
      "Visual Studio Code",
      "--command",
      "vscode2",
    );

    expect(result.exitCode).toBe(1);
    expect(result.errors.join("\n")).toContain("Visual Studio Code");
    expect(readConfig().openCommands).toEqual(before.openCommands);
  });

  it("duplicate executable: exits 1 and does not modify config", async () => {
    const { execa } = await import("execa");
    vi.mocked(execa).mockResolvedValue({ exitCode: 0 } as never);

    const before = readConfig();
    const result = await runConfigCommand(
      "add-command",
      "--name",
      "VS Code Duplicate",
      "--command",
      "code",
    );

    expect(result.exitCode).toBe(1);
    expect(result.errors.join("\n")).toContain("code");
    expect(readConfig().openCommands).toEqual(before.openCommands);
  });

  it("unknown executable: prints warning but still adds and exits 0", async () => {
    const { execa } = await import("execa");
    vi.mocked(execa).mockRejectedValue(new Error("not found"));

    const result = await runConfigCommand(
      "add-command",
      "--name",
      "My Script",
      "--command",
      "my-custom-script",
    );

    expect(result.exitCode).toBe(0);
    expect(result.warnings.join("\n")).toContain(
      "Warning: executable 'my-custom-script' not found in $PATH (but will be added anyway)",
    );
    expect(result.logs.join("\n")).toContain("Added open command: My Script (my-custom-script)");
    expect(readConfig().openCommands).toContainEqual({
      name: "My Script",
      command: "my-custom-script",
    });
  });

  it("known executable: no warning is printed", async () => {
    const { execa } = await import("execa");
    vi.mocked(execa).mockResolvedValue({ exitCode: 0 } as never);

    const result = await runConfigCommand("add-command", "--name", "Cursor", "--command", "cursor");

    expect(result.exitCode).toBe(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("missing --name: exits 1 with usage hint", async () => {
    const result = await runConfigCommand("add-command", "--command", "cursor");

    expect(result.exitCode).toBe(1);
  });

  it("missing --command: exits 1 with usage hint", async () => {
    const result = await runConfigCommand("add-command", "--name", "Cursor");

    expect(result.exitCode).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// remove-command
// ---------------------------------------------------------------------------

describe("config remove-command", () => {
  it("happy path: removes entry and prints success message", async () => {
    const result = await runConfigCommand("remove-command", "code-insiders");

    expect(result.exitCode).toBe(0);
    expect(result.logs.join("\n")).toContain("Removed open command: code-insiders");
    expect(readConfig().openCommands).not.toContainEqual(
      expect.objectContaining({ command: "code-insiders" }),
    );
  });

  it("removing non-default preserves defaultOpenCommand", async () => {
    await runConfigCommand("remove-command", "code-insiders");

    expect(readConfig().defaultOpenCommand).toBe("code");
  });

  it("removing default command prints promotion message and updates config", async () => {
    const result = await runConfigCommand("remove-command", "code");

    const output = result.logs.join("\n");
    expect(output).toContain("Removed open command: code");
    expect(output).toContain("Default promoted to: code-insiders");
    expect(readConfig().defaultOpenCommand).toBe("code-insiders");
  });

  it("removing last command prints warning and clears defaultOpenCommand", async () => {
    // Remove all but one first
    await runConfigCommand("remove-command", "code-insiders");

    const result = await runConfigCommand("remove-command", "code");

    const output = result.logs.join("\n");
    expect(output).toContain("Removed open command: code");
    expect(output).toContain("Warning: No commands remain in config");
    expect(readConfig().defaultOpenCommand).toBe("");
    expect(readConfig().openCommands).toHaveLength(0);
  });

  it("non-existent executable: exits 1 and does not modify config", async () => {
    const before = readConfig();
    const result = await runConfigCommand("remove-command", "ghost");

    expect(result.exitCode).toBe(1);
    expect(result.errors.join("\n")).toContain("ghost");
    expect(readConfig().openCommands).toEqual(before.openCommands);
  });

  it("missing argument: exits 1", async () => {
    const result = await runConfigCommand("remove-command");

    expect(result.exitCode).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// list-commands
// ---------------------------------------------------------------------------

describe("config list-commands", () => {
  it("displays all commands with Display Name, Executable, and Default columns", async () => {
    const { logs } = await runConfigCommand("list-commands");
    const output = logs.join("\n");

    expect(output).toContain("Visual Studio Code");
    expect(output).toContain("code");
    expect(output).toContain("VS Code Insiders");
    expect(output).toContain("code-insiders");
  });

  it("marks the default command with Y and others with N", async () => {
    const { logs } = await runConfigCommand("list-commands");
    const output = logs.join("\n");

    // The default ("code") row should have a Y; the other row an N
    expect(output).toContain("Y");
    expect(output).toContain("N");
  });

  it("contains a header row with column labels", async () => {
    const { logs } = await runConfigCommand("list-commands");
    const output = logs.join("\n");

    expect(output).toMatch(/Display Name/i);
    expect(output).toMatch(/Executable/i);
    expect(output).toMatch(/Default/i);
  });

  it("reflects newly added command after add-command", async () => {
    const { execa } = await import("execa");
    vi.mocked(execa).mockResolvedValue({ exitCode: 0 } as never);

    await runConfigCommand("add-command", "--name", "Zed", "--command", "zed");
    const { logs } = await runConfigCommand("list-commands");
    const output = logs.join("\n");

    expect(output).toContain("Zed");
    expect(output).toContain("zed");
  });
});

// ---------------------------------------------------------------------------
// set-default-command
// ---------------------------------------------------------------------------

describe("config set-default-command", () => {
  it("happy path: updates defaultOpenCommand and prints success", async () => {
    const result = await runConfigCommand("set-default-command", "code-insiders");

    expect(result.exitCode).toBe(0);
    expect(result.logs.join("\n")).toContain("Set default open command to: code-insiders");
    expect(readConfig().defaultOpenCommand).toBe("code-insiders");
  });

  it("non-existent executable: exits 1 with available list", async () => {
    const result = await runConfigCommand("set-default-command", "cursor");

    expect(result.exitCode).toBe(1);
    // Error should mention the bad executable and show what's available
    const output = result.errors.join("\n");
    expect(output).toContain("cursor");
    expect(output).toMatch(/code/); // at least one available executable listed
  });

  it("missing argument: exits 1 with usage hint and example", async () => {
    const result = await runConfigCommand("set-default-command");

    expect(result.exitCode).toBe(1);
    // Should mention the required argument or provide an example
    const allOutput = [...result.errors, ...result.logs].join("\n");
    expect(allOutput).toMatch(/set-default-command/i);
  });

  it("does not alter openCommands array", async () => {
    const before = readConfig();
    await runConfigCommand("set-default-command", "code-insiders");

    expect(readConfig().openCommands).toEqual(before.openCommands);
  });
});
