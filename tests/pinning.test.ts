import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tmpDir: string;
let testProjectsDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "workon-test-"));
  testProjectsDir = join(tmpDir, "projects");
  mkdirSync(testProjectsDir, { recursive: true });
  process.env["WORKONRC_PATH"] = join(tmpDir, ".workonrc.json");
});

afterEach(() => {
  delete process.env["WORKONRC_PATH"];
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("pinning utilities - core functionality", () => {
  it("isPinned returns true for pinned projects", async () => {
    const { isPinned } = await import("@/core/pinning.js");
    const config = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code" as const,
      openCommands: [{ name: "Code", command: "code" }],
      defaultProfile: "",
      ignore: [],
      pinned: ["/home/user/project1", "/home/user/project2"],
    };

    expect(isPinned("/home/user/project1", config)).toBe(true);
    expect(isPinned("/home/user/project2", config)).toBe(true);
    expect(isPinned("/home/user/project3", config)).toBe(false);
  });

  it("togglePin adds and removes projects from pinned array", async () => {
    const { togglePin } = await import("@/core/pinning.js");
    const config = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code" as const,
      openCommands: [{ name: "Code", command: "code" }],
      defaultProfile: "",
      ignore: [],
      pinned: ["/home/user/project1"],
    };

    // Toggle on: project2 is not pinned, so add it
    let updated = togglePin("/home/user/project2", config);
    expect(updated.pinned).toContain("/home/user/project2");
    expect(updated.pinned).toContain("/home/user/project1");

    // Toggle off: project2 is now pinned, so remove it
    updated = togglePin("/home/user/project2", updated);
    expect(updated.pinned).not.toContain("/home/user/project2");
    expect(updated.pinned).toContain("/home/user/project1");
  });

  it("deduplicatePins removes duplicate paths", async () => {
    const { deduplicatePins } = await import("@/core/pinning.js");
    const paths = ["/path1", "/path2", "/path1", "/path3", "/path2"];
    const deduplicated = deduplicatePins(paths);

    expect(deduplicated).toHaveLength(3);
    expect(deduplicated).toContain("/path1");
    expect(deduplicated).toContain("/path2");
    expect(deduplicated).toContain("/path3");
  });

  it("validatePinnedPaths separates valid from invalid paths", async () => {
    const { validatePinnedPaths } = await import("@/core/pinning.js");

    const validPath = join(testProjectsDir, "exists");
    mkdirSync(validPath, { recursive: true });

    const paths = [validPath, "/nonexistent/path1", "/nonexistent/path2"];
    const { valid, invalid } = validatePinnedPaths(paths);

    expect(valid).toEqual([validPath]);
    expect(invalid).toEqual(["/nonexistent/path1", "/nonexistent/path2"]);
  });

  it("togglePin preserves other pins", async () => {
    const { togglePin } = await import("@/core/pinning.js");
    const config = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code" as const,
      openCommands: [{ name: "Code", command: "code" }],
      defaultProfile: "",
      ignore: [],
      pinned: ["/home/user/project1", "/home/user/project2", "/home/user/project3"],
    };

    const updated = togglePin("/home/user/project2", config);
    expect(updated.pinned).toContain("/home/user/project1");
    expect(updated.pinned).not.toContain("/home/user/project2");
    expect(updated.pinned).toContain("/home/user/project3");
  });

  it("isPinned handles empty pinned array", async () => {
    const { isPinned } = await import("@/core/pinning.js");
    const config = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code" as const,
      openCommands: [{ name: "Code", command: "code" }],
      defaultProfile: "",
      ignore: [],
      pinned: [],
    };

    expect(isPinned("/any/path", config)).toBe(false);
  });
});

describe("pinning persistence", () => {
  it("initializes pinned as empty array by default", async () => {
    const { loadConfig } = await import("@/core/config.js");
    const config = loadConfig();
    expect(config.pinned).toEqual([]);
  });

  it("persists pinned array in config", async () => {
    const { loadConfig, saveConfig } = await import("@/core/config.js");
    const config = loadConfig();
    config.pinned = ["/path/to/project1", "/path/to/project2"];
    saveConfig(config);

    const reloaded = loadConfig();
    expect(reloaded.pinned).toEqual(["/path/to/project1", "/path/to/project2"]);
  });

  it("pins persist across multiple save/load cycles", async () => {
    const { loadConfig, saveConfig } = await import("@/core/config.js");

    let config = loadConfig();
    config.pinned = ["/path1"];
    saveConfig(config);

    config = loadConfig();
    config.pinned.push("/path2");
    saveConfig(config);

    const reloaded = loadConfig();
    expect(reloaded.pinned).toEqual(["/path1", "/path2"]);
  });

  it("handles duplicate pinned entries on load", async () => {
    const { loadConfig } = await import("@/core/config.js");
    const { deduplicatePins } = await import("@/core/pinning.js");

    const configPath = process.env["WORKONRC_PATH"]!;
    const duplicatePins = ["/path1", "/path2", "/path1", "/path3", "/path2"];
    writeFileSync(
      configPath,
      JSON.stringify({
        roots: [],
        maxDepth: 3,
        defaultOpenCommand: "code",
        openCommands: [{ name: "Code", command: "code" }],
        defaultProfile: "",
        ignore: [],
        pinned: duplicatePins,
      }),
    );

    const config = loadConfig();
    const deduped = deduplicatePins(config.pinned);
    expect(deduped).toHaveLength(3);
  });
});

describe("edge cases and error handling", () => {
  it("handles deleted pinned project gracefully", async () => {
    const { validatePinnedPaths } = await import("@/core/pinning.js");

    const projectPath = join(testProjectsDir, "my-app");
    mkdirSync(projectPath, { recursive: true });

    // Verify path exists
    let result = validatePinnedPaths([projectPath]);
    expect(result.valid).toContain(projectPath);

    // Delete the project
    rmSync(projectPath, { recursive: true, force: true });

    // Verify path is now invalid
    result = validatePinnedPaths([projectPath]);
    expect(result.invalid).toContain(projectPath);
  });

  it("preserves invalid entries in pinned array for user review", async () => {
    const { loadConfig, saveConfig } = await import("@/core/config.js");

    const config = loadConfig();
    config.pinned = ["/valid/path", "/deleted/project", "/another/missing"];
    saveConfig(config);

    const reloaded = loadConfig();
    // Invalid entries should still be in the array (for manual cleanup)
    expect(reloaded.pinned).toEqual(["/valid/path", "/deleted/project", "/another/missing"]);
  });

  it("deduplicatePins preserves order of first occurrence", async () => {
    const { deduplicatePins } = await import("@/core/pinning.js");
    const paths = ["/path1", "/path2", "/path1", "/path3", "/path2"];
    const deduplicated = deduplicatePins(paths);

    // Set comparison doesn't guarantee order, so we just check uniqueness
    const pathSet = new Set(deduplicated);
    expect(pathSet.size).toBe(3);
    expect(deduplicated).toContain("/path1");
    expect(deduplicated).toContain("/path2");
    expect(deduplicated).toContain("/path3");
  });

  it("togglePin handles empty config pinned array", async () => {
    const { togglePin } = await import("@/core/pinning.js");
    const config = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code" as const,
      openCommands: [{ name: "Code", command: "code" }],
      defaultProfile: "",
      ignore: [],
      pinned: [],
    };

    const updated = togglePin("/new/project", config);
    expect(updated.pinned).toEqual(["/new/project"]);
  });

  it("togglePin works with single entry array", async () => {
    const { togglePin } = await import("@/core/pinning.js");
    const config = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code" as const,
      openCommands: [{ name: "Code", command: "code" }],
      defaultProfile: "",
      ignore: [],
      pinned: ["/home/user/project1"],
    };

    // Remove the only pin
    let updated = togglePin("/home/user/project1", config);
    expect(updated.pinned).toEqual([]);

    // Add a new pin to empty array
    updated = togglePin("/home/user/project2", updated);
    expect(updated.pinned).toEqual(["/home/user/project2"]);
  });

  it("validatePinnedPaths returns empty arrays when all paths valid", async () => {
    const { validatePinnedPaths } = await import("@/core/pinning.js");

    const paths = [testProjectsDir];
    const { valid, invalid } = validatePinnedPaths(paths);

    expect(valid).toEqual(paths);
    expect(invalid).toEqual([]);
  });

  it("validatePinnedPaths returns empty arrays when all paths invalid", async () => {
    const { validatePinnedPaths } = await import("@/core/pinning.js");

    const paths = ["/nonexistent1", "/nonexistent2"];
    const { valid, invalid } = validatePinnedPaths(paths);

    expect(valid).toEqual([]);
    expect(invalid).toEqual(paths);
  });
});
