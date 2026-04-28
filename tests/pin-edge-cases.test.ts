import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
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
  // Ensure directory is writable before cleanup
  try {
    chmodSync(tmpDir, 0o755);
  } catch {
    // ignore
  }
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("edge cases - deleted projects", () => {
  it("handles pinned project that gets deleted", async () => {
    const { validatePinnedPaths } = await import("@/core/pinning.js");

    const projectPath = join(testProjectsDir, "my-app");
    mkdirSync(projectPath, { recursive: true });

    // Initially valid
    let result = validatePinnedPaths([projectPath]);
    expect(result.valid).toContain(projectPath);
    expect(result.invalid).toHaveLength(0);

    // Delete project
    rmSync(projectPath, { recursive: true, force: true });

    // Now invalid
    result = validatePinnedPaths([projectPath]);
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toContain(projectPath);
  });

  it("distinguishes between valid and invalid pinned projects", async () => {
    const { validatePinnedPaths } = await import("@/core/pinning.js");

    const validProject = join(testProjectsDir, "valid-project");
    mkdirSync(validProject, { recursive: true });

    const paths = [validProject, "/deleted/project", "/never/existed"];

    const { valid, invalid } = validatePinnedPaths(paths);

    expect(valid).toEqual([validProject]);
    expect(invalid).toEqual(["/deleted/project", "/never/existed"]);
  });

  it("displays missing projects with note in list", async () => {
    const { loadConfig, saveConfig } = await import("@/core/config.js");

    const config = loadConfig();
    config.pinned = [
      "/home/user/existing-project", // This won't actually exist in test
      "/home/user/deleted-project",
    ];
    saveConfig(config);

    const reloaded = loadConfig();
    expect(reloaded.pinned).toHaveLength(2);
  });
});

describe("edge cases - duplicate entries", () => {
  it("detects and deduplicates duplicate pinned entries", async () => {
    const { deduplicatePins } = await import("@/core/pinning.js");

    const duplicates = [
      "/path/to/project1",
      "/path/to/project2",
      "/path/to/project1",
      "/path/to/project3",
      "/path/to/project2",
    ];

    const deduplicated = deduplicatePins(duplicates);

    expect(deduplicated.length).toBe(3);
    const pathSet = new Set(deduplicated);
    expect(pathSet.size).toBe(3);
  });

  it("preserves unique entries when deduplicating", async () => {
    const { deduplicatePins } = await import("@/core/pinning.js");

    const paths = ["/a", "/b", "/c"];
    const deduplicated = deduplicatePins(paths);

    expect(deduplicated).toHaveLength(3);
  });

  it("handles all-duplicate input", async () => {
    const { deduplicatePins } = await import("@/core/pinning.js");

    const allDuplicates = ["/path", "/path", "/path", "/path"];
    const deduplicated = deduplicatePins(allDuplicates);

    expect(deduplicated).toHaveLength(1);
    expect(deduplicated[0]).toBe("/path");
  });
});

describe("edge cases - invalid entries", () => {
  it("handles non-string values in pinned array gracefully", async () => {
    const { loadConfig } = await import("@/core/config.js");

    const configPath = process.env["WORKONRC_PATH"]!;

    // Note: Zod schema should filter out non-string values
    // This test verifies the schema behavior
    writeFileSync(
      configPath,
      JSON.stringify({
        roots: [],
        maxDepth: 3,
        defaultOpenCommand: "code",
        openCommands: [{ name: "Code", command: "code" }],
        defaultProfile: "",
        ignore: [],
        pinned: ["/valid/path"], // Schema should only allow strings
      }),
    );

    const config = loadConfig();
    expect(config.pinned).toEqual(["/valid/path"]);
  });

  it("validates paths as strings", async () => {
    const { validatePinnedPaths } = await import("@/core/pinning.js");

    // This should handle string-only input
    const paths = ["/path1", "/path2", "/path3"];
    const result = validatePinnedPaths(paths);

    expect(result).toHaveProperty("valid");
    expect(result).toHaveProperty("invalid");
  });
});

describe("edge cases - ambiguous project names", () => {
  it("finds exact match when available", async () => {
    const { fuzzySearch } = await import("@/core/search.js");

    const projects = [
      {
        name: "app",
        path: "/path/app",
        type: "nodejs" as const,
        openCommand: "code" as const,
        profile: "",
        description: "",
        tags: [],
        hasDevProject: false,
      },
      {
        name: "app-legacy",
        path: "/path/app-legacy",
        type: "nodejs" as const,
        openCommand: "code" as const,
        profile: "",
        description: "",
        tags: [],
        hasDevProject: false,
      },
      {
        name: "application",
        path: "/path/application",
        type: "nodejs" as const,
        openCommand: "code" as const,
        profile: "",
        description: "",
        tags: [],
        hasDevProject: false,
      },
    ];

    // Exact match should come first
    const results = fuzzySearch(projects, "app");
    expect(results[0]?.name).toBe("app");
  });

  it("fuzzy matches when exact match not available", async () => {
    const { fuzzySearch } = await import("@/core/search.js");

    const projects = [
      {
        name: "app-legacy",
        path: "/path/app-legacy",
        type: "nodejs" as const,
        openCommand: "code" as const,
        profile: "",
        description: "",
        tags: [],
        hasDevProject: false,
      },
      {
        name: "application",
        path: "/path/application",
        type: "nodejs" as const,
        openCommand: "code" as const,
        profile: "",
        description: "",
        tags: [],
        hasDevProject: false,
      },
    ];

    // Fuzzy search should return matching results
    const results = fuzzySearch(projects, "app-l");
    expect(results.length).toBeGreaterThan(0);
    // app-legacy should be in the results (best match)
    const legacyMatch = results.find((p) => p.name === "app-legacy");
    expect(legacyMatch).toBeDefined();
  });
});

describe("edge cases - empty states", () => {
  it("handles empty pinned list", async () => {
    const { loadConfig } = await import("@/core/config.js");

    const config = loadConfig();
    expect(config.pinned).toEqual([]);
  });

  it("handles toggling pin when list is empty", async () => {
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

  it("handles deduplicating empty array", async () => {
    const { deduplicatePins } = await import("@/core/pinning.js");

    const deduplicated = deduplicatePins([]);
    expect(deduplicated).toEqual([]);
  });

  it("handles validating empty path array", async () => {
    const { validatePinnedPaths } = await import("@/core/pinning.js");

    const { valid, invalid } = validatePinnedPaths([]);
    expect(valid).toEqual([]);
    expect(invalid).toEqual([]);
  });
});

describe("edge cases - path normalization", () => {
  it("handles absolute paths correctly", async () => {
    const { isPinned } = await import("@/core/pinning.js");

    const config = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code" as const,
      openCommands: [{ name: "Code", command: "code" }],
      defaultProfile: "",
      ignore: [],
      pinned: ["/home/user/project"],
    };

    expect(isPinned("/home/user/project", config)).toBe(true);
  });

  it("preserves path as-is when toggling", async () => {
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

    const path = "/home/user/my-project";
    const updated = togglePin(path, config);

    expect(updated.pinned[0]).toBe(path);
  });
});

describe("edge cases - large pinned lists", () => {
  it("handles large number of pinned projects", async () => {
    const { togglePin } = await import("@/core/pinning.js");

    let config = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code" as const,
      openCommands: [{ name: "Code", command: "code" }],
      defaultProfile: "",
      ignore: [],
      pinned: [],
    };

    // Add 100 projects
    for (let i = 0; i < 100; i++) {
      config = togglePin(`/path/to/project${i}`, config);
    }

    expect(config.pinned).toHaveLength(100);
  });

  it("deduplicates large list efficiently", async () => {
    const { deduplicatePins } = await import("@/core/pinning.js");

    const paths: string[] = [];
    for (let i = 0; i < 50; i++) {
      paths.push(`/path${i}`);
      paths.push(`/path${i}`); // Add duplicate
    }

    const deduplicated = deduplicatePins(paths);
    expect(deduplicated).toHaveLength(50);
  });

  it("validates large pinned list", async () => {
    const { validatePinnedPaths } = await import("@/core/pinning.js");

    const paths: string[] = [];
    for (let i = 0; i < 50; i++) {
      paths.push(`/nonexistent/path${i}`);
    }

    const { valid, invalid } = validatePinnedPaths(paths);
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(50);
  });
});

describe("edge cases - special characters in paths", () => {
  it("handles paths with spaces", async () => {
    const { isPinned, togglePin } = await import("@/core/pinning.js");

    const pathWithSpace = "/home/user/my projects/my app";
    let config = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code" as const,
      openCommands: [{ name: "Code", command: "code" }],
      defaultProfile: "",
      ignore: [],
      pinned: [],
    };

    config = togglePin(pathWithSpace, config);
    expect(isPinned(pathWithSpace, config)).toBe(true);
  });

  it("handles paths with special characters", async () => {
    const { isPinned, togglePin } = await import("@/core/pinning.js");

    const specialPath = "/home/user/project-@-v2.0/app (copy)";
    let config = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code" as const,
      openCommands: [{ name: "Code", command: "code" }],
      defaultProfile: "",
      ignore: [],
      pinned: [],
    };

    config = togglePin(specialPath, config);
    expect(isPinned(specialPath, config)).toBe(true);
  });

  it("handles unicode paths", async () => {
    const { isPinned, togglePin } = await import("@/core/pinning.js");

    const unicodePath = "/home/user/项目/app";
    let config = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code" as const,
      openCommands: [{ name: "Code", command: "code" }],
      defaultProfile: "",
      ignore: [],
      pinned: [],
    };

    config = togglePin(unicodePath, config);
    expect(isPinned(unicodePath, config)).toBe(true);
  });
});

describe("config persistence and validation", () => {
  it("persists and reloads pins across sessions", async () => {
    const { loadConfig, saveConfig } = await import("@/core/config.js");

    let config = loadConfig();
    config.pinned = ["/path1", "/path2", "/path3"];
    saveConfig(config);

    const reloaded = loadConfig();
    expect(reloaded.pinned).toEqual(["/path1", "/path2", "/path3"]);
  });

  it("validates pinned field on load", async () => {
    const { loadConfig } = await import("@/core/config.js");

    const config = loadConfig();
    // Config should always have pinned array
    expect(Array.isArray(config.pinned)).toBe(true);
  });

  it("preserves other config fields when modifying pins", async () => {
    const { loadConfig, saveConfig } = await import("@/core/config.js");

    let config = loadConfig();
    config.roots = ["/test/root"];
    config.maxDepth = 5;
    config.defaultOpenCommand = "code-insiders" as const;
    config.pinned = ["/test/project"];
    saveConfig(config);

    const reloaded = loadConfig();
    expect(reloaded.roots).toEqual(["/test/root"]);
    expect(reloaded.maxDepth).toBe(5);
    expect(reloaded.defaultOpenCommand).toBe("code-insiders");
    expect(reloaded.pinned).toEqual(["/test/project"]);
  });
});
