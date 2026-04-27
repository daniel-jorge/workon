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

describe("pin CLI commands", () => {
  it("lists all pinned projects with CLI", async () => {
    const { loadConfig, saveConfig } = await import("@/core/config.js");

    const config = loadConfig();
    config.roots = [testProjectsDir];

    // Create test projects
    const project1 = join(testProjectsDir, "my-app");
    const project2 = join(testProjectsDir, "legacy-service");
    mkdirSync(project1, { recursive: true });
    mkdirSync(project2, { recursive: true });

    // Write package.json to make them discoverable
    writeFileSync(join(project1, "package.json"), '{"name": "my-app"}');
    writeFileSync(join(project2, "package.json"), '{"name": "legacy-service"}');

    config.pinned = [project1, project2];
    saveConfig(config);

    const { loadConfig: reloadConfig } = await import("@/core/config.js");
    const reloaded = reloadConfig();
    expect(reloaded.pinned).toContain(project1);
    expect(reloaded.pinned).toContain(project2);
  });

  it("toggles pin status for a project", async () => {
    const { loadConfig } = await import("@/core/config.js");
    const { togglePin } = await import("@/core/pinning.js");

    const config = loadConfig();
    const projectPath = join(testProjectsDir, "my-app");
    mkdirSync(projectPath, { recursive: true });

    // First toggle: should add pin
    let updated = togglePin(projectPath, config);
    expect(updated.pinned).toContain(projectPath);

    // Second toggle: should remove pin
    updated = togglePin(projectPath, updated);
    expect(updated.pinned).not.toContain(projectPath);
  });

  it("handles empty pinned list correctly", async () => {
    const { loadConfig } = await import("@/core/config.js");

    const config = loadConfig();
    expect(config.pinned).toEqual([]);
  });

  it("preserves pin status across config reloads", async () => {
    const { loadConfig, saveConfig } = await import("@/core/config.js");

    let config = loadConfig();
    config.pinned = ["/path/to/project1"];
    saveConfig(config);

    // Simulate another part of the app changing config
    config = loadConfig();
    config.maxDepth = 5;
    saveConfig(config);

    // Pins should still be there
    const reloaded = loadConfig();
    expect(reloaded.pinned).toContain("/path/to/project1");
    expect(reloaded.maxDepth).toBe(5);
  });
});

describe("pin command with project scanning", () => {
  it("finds and pins a project by name", async () => {
    const { loadConfig, saveConfig } = await import("@/core/config.js");
    const { scanProjects } = await import("@/core/scanner.js");
    const { togglePin, isPinned } = await import("@/core/pinning.js");

    const config = loadConfig();
    config.roots = [testProjectsDir];

    // Create a test project
    const projectPath = join(testProjectsDir, "my-app");
    mkdirSync(projectPath, { recursive: true });
    writeFileSync(join(projectPath, "package.json"), '{"name": "my-app"}');
    saveConfig(config);

    // Scan and verify project is found
    const projects = await scanProjects(config);
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("my-app");

    // Pin the project
    let updated = togglePin(projects[0].path, config);
    expect(isPinned(projects[0].path, updated)).toBe(true);
  });

  it("handles multiple projects and pins selectively", async () => {
    const { loadConfig, saveConfig } = await import("@/core/config.js");
    const { scanProjects } = await import("@/core/scanner.js");
    const { togglePin } = await import("@/core/pinning.js");

    const config = loadConfig();
    config.roots = [testProjectsDir];

    // Create multiple test projects
    for (const name of ["app-a", "app-b", "app-c"]) {
      const projectPath = join(testProjectsDir, name);
      mkdirSync(projectPath, { recursive: true });
      writeFileSync(join(projectPath, "package.json"), `{"name": "${name}"}`);
    }
    saveConfig(config);

    // Scan projects
    const projects = await scanProjects(config);
    expect(projects).toHaveLength(3);

    // Pin only app-b
    let updated = config;
    updated = togglePin(projects[1].path, updated);
    expect(updated.pinned).toHaveLength(1);
    expect(updated.pinned[0]).toBe(projects[1].path);
  });

  it("handles missing projects in pinned list", async () => {
    const { loadConfig, saveConfig } = await import("@/core/config.js");
    const { scanProjects } = await import("@/core/scanner.js");

    const config = loadConfig();
    config.roots = [testProjectsDir];

    // Create one project
    const projectPath = join(testProjectsDir, "existing");
    mkdirSync(projectPath, { recursive: true });
    writeFileSync(join(projectPath, "package.json"), '{"name": "existing"}');

    // Add both existing and non-existing project to pinned
    config.pinned = [projectPath, "/nonexistent/project"];
    saveConfig(config);

    // Scan projects
    const projects = await scanProjects(config);

    // Found projects should only include the existing one
    const found = projects.find((p) => p.path === projectPath);
    expect(found).toBeDefined();

    // The pinned array still has both (for user to clean up)
    const reloaded = loadConfig();
    expect(reloaded.pinned).toHaveLength(2);
  });
});

describe("pin ordering and filtering", () => {
  it("supports filtering pinned projects from scanned list", async () => {
    const { loadConfig, saveConfig } = await import("@/core/config.js");
    const { scanProjects } = await import("@/core/scanner.js");
    const { isPinned } = await import("@/core/pinning.js");

    const config = loadConfig();
    config.roots = [testProjectsDir];

    // Create test projects
    for (const name of ["project-1", "project-2", "project-3"]) {
      const projectPath = join(testProjectsDir, name);
      mkdirSync(projectPath, { recursive: true });
      writeFileSync(join(projectPath, "package.json"), `{"name": "${name}"}`);
    }

    // Pin only project-1
    const projects = await scanProjects(config);
    config.pinned = [projects[0].path];
    saveConfig(config);

    // Filter pinned projects
    const pinnedProjects = projects.filter((p) => isPinned(p.path, config));
    expect(pinnedProjects).toHaveLength(1);
    expect(pinnedProjects[0].name).toBe("project-1");
  });

  it("preserves pinned order independently of scan order", async () => {
    const { loadConfig, saveConfig } = await import("@/core/config.js");

    const config = loadConfig();

    // Create pinned list in specific order
    const paths = ["/path/c", "/path/a", "/path/b"];
    config.pinned = paths;
    saveConfig(config);

    // Reload and verify order is preserved
    const reloaded = loadConfig();
    expect(reloaded.pinned).toEqual(paths);
  });
});

describe("pin state transitions", () => {
  it("transitions from unpinned to pinned to unpinned", async () => {
    const { togglePin, isPinned } = await import("@/core/pinning.js");

    let config = {
      roots: [],
      maxDepth: 3,
      defaultIde: "code" as const,
      defaultProfile: "",
      ignore: [],
      pinned: [],
    };

    const projectPath = "/home/user/my-app";

    // Initial state: unpinned
    expect(isPinned(projectPath, config)).toBe(false);

    // Toggle to pinned
    config = togglePin(projectPath, config);
    expect(isPinned(projectPath, config)).toBe(true);
    expect(config.pinned).toHaveLength(1);

    // Toggle to unpinned
    config = togglePin(projectPath, config);
    expect(isPinned(projectPath, config)).toBe(false);
    expect(config.pinned).toHaveLength(0);
  });

  it("handles rapid toggle operations", async () => {
    const { togglePin, isPinned } = await import("@/core/pinning.js");

    let config = {
      roots: [],
      maxDepth: 3,
      defaultIde: "code" as const,
      defaultProfile: "",
      ignore: [],
      pinned: [],
    };

    const projectPath = "/home/user/project";

    // Rapid toggles
    for (let i = 0; i < 5; i++) {
      config = togglePin(projectPath, config);
    }

    // After odd number of toggles, should be pinned
    expect(isPinned(projectPath, config)).toBe(true);
  });
});
