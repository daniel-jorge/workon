import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "workon-test-"));
  process.env["WORKONRC_PATH"] = join(tmpDir, ".workonrc.json");
});

afterEach(() => {
  delete process.env["WORKONRC_PATH"];
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("creates defaults when file is missing", async () => {
    const { loadConfig } = await import("@/core/config.js");
    const config = loadConfig();
    expect(config.roots).toEqual([]);
    expect(config.maxDepth).toBe(3);
    expect(config.defaultOpenCommand).toBe("code");
    expect(config.openCommands).toEqual([
      { name: "Visual Studio Code", command: "code" },
      { name: "VS Code Insiders", command: "code-insiders" },
    ]);
    expect(config.defaultProfile).toBe("");
    expect(config.ignore).toEqual([
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.git/**",
      "**/.venv/**",
    ]);
    expect(existsSync(join(tmpDir, ".workonrc.json"))).toBe(true);
  });

  it("reads an existing config file", async () => {
    const { loadConfig, saveConfig } = await import("../src/core/config.js");
    const initial = loadConfig();
    initial.roots = ["/home/user/projects"];
    initial.maxDepth = 5;
    saveConfig(initial);

    const loaded = loadConfig();
    expect(loaded.roots).toEqual(["/home/user/projects"]);
    expect(loaded.maxDepth).toBe(5);
  });

  it("round-trips read/write correctly", async () => {
    const { loadConfig, saveConfig } = await import("../src/core/config.js");
    const config = loadConfig();
    config.roots = ["/a", "/b"];
    config.defaultOpenCommand = "code-insiders";
    config.openCommands = [
      { name: "Custom", command: "custom-editor" },
      { name: "Code Insiders", command: "code-insiders" },
    ];
    config.defaultProfile = "personal";
    saveConfig(config);

    const reloaded = loadConfig();
    expect(reloaded.roots).toEqual(["/a", "/b"]);
    expect(reloaded.defaultOpenCommand).toBe("code-insiders");
    expect(reloaded.defaultProfile).toBe("personal");
  });

  it("migrates legacy defaultIde to defaultOpenCommand", async () => {
    const { loadConfig } = await import("@/core/config.js");
    const configPath = join(tmpDir, ".workonrc.json");
    // Write legacy config with "defaultIde"
    const legacyConfig = {
      roots: [],
      maxDepth: 3,
      defaultIde: "code-insiders",
      defaultProfile: "",
      ignore: ["**/node_modules/**"],
      pinned: [],
    };
    require("node:fs").writeFileSync(configPath, JSON.stringify(legacyConfig));

    const config = loadConfig();
    expect(config.defaultOpenCommand).toBe("code-insiders");
  });
});

describe("saveConfig", () => {
  it("writes valid JSON to the config path", async () => {
    const { loadConfig, saveConfig } = await import("../src/core/config.js");
    const config = loadConfig();
    config.roots = ["/test/root"];
    saveConfig(config);

    const raw = JSON.parse(readFileSync(join(tmpDir, ".workonrc.json"), "utf-8")) as {
      roots: string[];
    };
    expect(raw.roots).toEqual(["/test/root"]);
  });

  it("rejects invalid maxDepth via Zod validation", async () => {
    const { loadConfig, saveConfig } = await import("../src/core/config.js");
    const config = loadConfig();
    (config as Record<string, unknown>)["maxDepth"] = 0;
    expect(() => saveConfig(config)).toThrow();
  });

  it("validates openCommands structure", async () => {
    const { loadConfig, saveConfig } = await import("../src/core/config.js");
    const config = loadConfig();
    (config as Record<string, unknown>)["openCommands"] = [
      { name: "Valid" }, // missing 'command' field
    ];
    expect(() => saveConfig(config)).toThrow();
  });

  it("(atomic) leaves original file intact when write fails", async () => {
    const { loadConfig, saveConfig } = await import("../src/core/config.js");
    const { chmodSync, readFileSync } = await import("node:fs");

    const cfg = loadConfig();
    cfg.roots = ["/original-root"];
    saveConfig(cfg);

    // Make the directory non-writable to force a write failure
    chmodSync(tmpDir, 0o555);

    cfg.roots = ["/changed-root"];
    try {
      expect(() => saveConfig(cfg)).toThrow(
        /Failed to save config.*Your config has NOT been changed/,
      );
    } finally {
      chmodSync(tmpDir, 0o755);
    }

    const raw = JSON.parse(readFileSync(join(tmpDir, ".workonrc.json"), "utf-8")) as {
      roots: string[];
    };
    expect(raw.roots).toEqual(["/original-root"]);
  });
});

describe("open command management", () => {
  it("addOpenCommand appends entry to openCommands array", async () => {
    const { addOpenCommand, loadConfig } = await import("@/core/config.js");
    const cfg = loadConfig();
    const updated = addOpenCommand(cfg, "Cursor", "cursor");
    expect(updated.openCommands).toContainEqual({ name: "Cursor", command: "cursor" });
    expect(updated.openCommands.length).toBe(cfg.openCommands.length + 1);
  });

  it("addOpenCommand does not mutate original config", async () => {
    const { addOpenCommand, loadConfig } = await import("@/core/config.js");
    const cfg = loadConfig();
    const original = cfg.openCommands.length;
    addOpenCommand(cfg, "Cursor", "cursor");
    expect(cfg.openCommands.length).toBe(original);
  });

  it("addOpenCommand throws on duplicate display name", async () => {
    const { addOpenCommand, loadConfig } = await import("@/core/config.js");
    const cfg = loadConfig();
    expect(() => addOpenCommand(cfg, "Visual Studio Code", "vscode2")).toThrow(
      "Error: A command with display name 'Visual Studio Code' already exists. Use 'workon config remove-command <executable>' first to replace it.",
    );
  });

  it("addOpenCommand throws on duplicate executable", async () => {
    const { addOpenCommand, loadConfig } = await import("@/core/config.js");
    const cfg = loadConfig();
    expect(() => addOpenCommand(cfg, "VS Code Copy", "code")).toThrow(
      "Error: The executable 'code' is already configured under display name 'Visual Studio Code'. Each executable must be unique.",
    );
  });

  it("removeOpenCommand removes the named entry", async () => {
    const { removeOpenCommand, loadConfig } = await import("@/core/config.js");
    const cfg = loadConfig();
    const { config: updated } = removeOpenCommand(cfg, "code-insiders");
    expect(updated.openCommands).not.toContainEqual(
      expect.objectContaining({ command: "code-insiders" }),
    );
    expect(updated.openCommands).toContainEqual(expect.objectContaining({ command: "code" }));
  });

  it("removeOpenCommand returns promotedTo null when non-default is removed", async () => {
    const { removeOpenCommand, loadConfig } = await import("@/core/config.js");
    const cfg = loadConfig(); // defaultOpenCommand defaults to "code"
    const result = removeOpenCommand(cfg, "code-insiders");
    expect(result.promotedTo).toBeNull();
    expect(result.wasLast).toBe(false);
    expect(result.config.defaultOpenCommand).toBe("code");
  });

  it("removeOpenCommand auto-promotes default to first remaining command", async () => {
    const { removeOpenCommand, loadConfig } = await import("@/core/config.js");
    const cfg = loadConfig(); // defaultOpenCommand is "code" (Visual Studio Code)
    const result = removeOpenCommand(cfg, "code");
    expect(result.promotedTo).toBe("code-insiders");
    expect(result.config.defaultOpenCommand).toBe("code-insiders");
  });

  it("removeOpenCommand sets defaultOpenCommand to empty string when last command removed", async () => {
    const { removeOpenCommand, GlobalConfigSchema } = await import("@/core/config.js");
    const singleCfg = GlobalConfigSchema.parse({
      openCommands: [{ name: "Only One", command: "only" }],
      defaultOpenCommand: "only",
    });
    const result = removeOpenCommand(singleCfg, "only");
    expect(result.wasLast).toBe(true);
    expect(result.config.defaultOpenCommand).toBe("");
    expect(result.config.openCommands).toEqual([]);
  });

  it("removeOpenCommand throws when executable not found", async () => {
    const { removeOpenCommand, loadConfig } = await import("@/core/config.js");
    const cfg = loadConfig();
    expect(() => removeOpenCommand(cfg, "nonexistent")).toThrow(
      "Error: No executable 'nonexistent' found. Available:",
    );
  });

  it("removeOpenCommand error lists available executables", async () => {
    const { removeOpenCommand, loadConfig } = await import("@/core/config.js");
    const cfg = loadConfig();
    expect(() => removeOpenCommand(cfg, "ghost")).toThrow(/code/);
  });

  it("setDefaultOpenCommand updates defaultOpenCommand field", async () => {
    const { setDefaultOpenCommand, loadConfig } = await import("@/core/config.js");
    const cfg = loadConfig();
    const updated = setDefaultOpenCommand(cfg, "code-insiders");
    expect(updated.defaultOpenCommand).toBe("code-insiders");
  });

  it("setDefaultOpenCommand does not alter openCommands array", async () => {
    const { setDefaultOpenCommand, loadConfig } = await import("@/core/config.js");
    const cfg = loadConfig();
    const updated = setDefaultOpenCommand(cfg, "code-insiders");
    expect(updated.openCommands).toEqual(cfg.openCommands);
  });

  it("setDefaultOpenCommand throws when executable not in openCommands", async () => {
    const { setDefaultOpenCommand, loadConfig } = await import("@/core/config.js");
    const cfg = loadConfig();
    expect(() => setDefaultOpenCommand(cfg, "cursor")).toThrow(
      "Error: No executable 'cursor' found. Available:",
    );
  });

  it("setDefaultOpenCommand error lists available executables", async () => {
    const { setDefaultOpenCommand, loadConfig } = await import("@/core/config.js");
    const cfg = loadConfig();
    expect(() => setDefaultOpenCommand(cfg, "zed")).toThrow(/code/);
  });

  it("listOpenCommands returns isDefault true only for the current default", async () => {
    const { listOpenCommands, loadConfig } = await import("@/core/config.js");
    const cfg = loadConfig(); // defaultOpenCommand is "code"
    const list = listOpenCommands(cfg);
    const vscode = list.find((e) => e.command === "code");
    const insiders = list.find((e) => e.command === "code-insiders");
    expect(vscode?.isDefault).toBe(true);
    expect(insiders?.isDefault).toBe(false);
  });

  it("listOpenCommands returns all commands with name and command fields", async () => {
    const { listOpenCommands, loadConfig } = await import("@/core/config.js");
    const cfg = loadConfig();
    const list = listOpenCommands(cfg);
    expect(list.length).toBe(2);
    expect(list[0]).toMatchObject({ name: "Visual Studio Code", command: "code" });
    expect(list[1]).toMatchObject({ name: "VS Code Insiders", command: "code-insiders" });
  });

  it("listOpenCommands preserves insertion order", async () => {
    const { listOpenCommands, addOpenCommand, loadConfig } = await import("@/core/config.js");
    const cfg = loadConfig();
    const updated = addOpenCommand(addOpenCommand(cfg, "Cursor", "cursor"), "Zed", "zed");
    const list = listOpenCommands(updated);
    expect(list.map((e) => e.command)).toEqual(["code", "code-insiders", "cursor", "zed"]);
  });
});
