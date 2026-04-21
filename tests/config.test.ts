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
    const { loadConfig } = await import("../src/core/config.js");
    const config = loadConfig();
    expect(config.roots).toEqual([]);
    expect(config.maxDepth).toBe(3);
    expect(config.defaultIde).toBe("code");
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
    config.defaultIde = "code-insiders";
    config.defaultProfile = "personal";
    saveConfig(config);

    const reloaded = loadConfig();
    expect(reloaded.roots).toEqual(["/a", "/b"]);
    expect(reloaded.defaultIde).toBe("code-insiders");
    expect(reloaded.defaultProfile).toBe("personal");
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

  it("rejects invalid ide via Zod validation", async () => {
    const { loadConfig, saveConfig } = await import("../src/core/config.js");
    const config = loadConfig();
    (config as Record<string, unknown>)["defaultIde"] = "vim";
    expect(() => saveConfig(config)).toThrow();
  });
});
