import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { scanProjects } from "@/core/scanner.js";
import type { GlobalConfig } from "@/core/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCAN_ROOT = join(__dirname, "fixtures", "scan-root");

const baseConfig: GlobalConfig = {
  roots: [SCAN_ROOT],
  maxDepth: 3,
  defaultOpenCommand: "code",
  openCommands: [
    { name: "Visual Studio Code", command: "code" },
    { name: "VS Code Insiders", command: "code-insiders" },
  ],
  defaultProfile: "",
  ignore: ["node_modules", "dist", ".git"],
  pinned: [],
};

describe("scanProjects", () => {
  it("discovers projects with known markers", async () => {
    const projects = await scanProjects(baseConfig);
    const names = projects.map((p) => p.name);
    expect(names).toContain("alpha");
    expect(names).toContain("beta");
    expect(names).toContain("gamma");
  });

  it("ignores node_modules directories", async () => {
    const projects = await scanProjects(baseConfig);
    const paths = projects.map((p) => p.path);
    expect(paths.every((p) => !p.includes("node_modules"))).toBe(true);
  });

  it("sorts projects alphabetically", async () => {
    const projects = await scanProjects(baseConfig);
    const names = projects.map((p) => p.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it("merges .workonrc.json overrides for delta project", async () => {
    const projects = await scanProjects(baseConfig);
    const delta = projects.find((p) => p.name === "Delta Project");
    expect(delta).toBeDefined();
    expect(delta!.openCommand).toBe("code-insiders");
    expect(delta!.profile).toBe("work");
    expect(delta!.hasDevProject).toBe(true);
    expect(delta!.tags).toContain("scan-test");
  });

  it("detects correct project types", async () => {
    const projects = await scanProjects(baseConfig);
    const alpha = projects.find((p) => p.name === "alpha");
    const beta = projects.find((p) => p.name === "beta");
    const gamma = projects.find((p) => p.name === "gamma");
    expect(alpha?.type).toBe("nodejs");
    expect(beta?.type).toBe("rust");
    expect(gamma?.type).toBe("python");
  });

  it("returns empty array when roots is empty", async () => {
    const cfg = { ...baseConfig, roots: [] };
    const projects = await scanProjects(cfg);
    expect(projects).toEqual([]);
  });

  it("skips non-existent roots gracefully", async () => {
    const cfg = { ...baseConfig, roots: ["/nonexistent/path/12345"] };
    const projects = await scanProjects(cfg);
    expect(projects).toEqual([]);
  });

  it("places pinned projects first, then unpinned", async () => {
    // Find the actual project paths from a scan
    const projects = await scanProjects(baseConfig);
    const alpha = projects.find((p) => p.name === "alpha");
    const beta = projects.find((p) => p.name === "beta");

    if (!alpha || !beta) {
      // Skip if projects not found
      expect(alpha).toBeDefined();
      return;
    }

    // Pin beta (which would normally come before alpha alphabetically)
    const cfgWithPin = { ...baseConfig, pinned: [beta.path] };
    const sortedProjects = await scanProjects(cfgWithPin);

    // Find positions
    const alphaPos = sortedProjects.findIndex((p) => p.path === alpha.path);
    const betaPos = sortedProjects.findIndex((p) => p.path === beta.path);

    // Beta should come before alpha because it's pinned
    expect(betaPos).toBeLessThan(alphaPos);
  });

  it("shows missing pinned projects with missing flag", async () => {
    const missingPath = "/nonexistent/missing/project";
    const cfg = { ...baseConfig, pinned: [missingPath] };
    const projects = await scanProjects(cfg);

    const missing = projects.find((p) => p.path === missingPath);
    expect(missing).toBeDefined();
    expect(missing?.missing).toBe(true);
    expect(missing?.description).toBe("(not found)");
  });

  it("maintains alphabetical order within pinned and unpinned groups", async () => {
    const projects = await scanProjects(baseConfig);

    // Get first two projects to pin (should be alpha and beta)
    const toPin = [projects[0], projects[1]];
    if (!toPin[0] || !toPin[1]) {
      expect(toPin[0]).toBeDefined();
      return;
    }

    const cfg = { ...baseConfig, pinned: [toPin[0].path, toPin[1].path] };
    const sorted = await scanProjects(cfg);

    // Extract pinned projects
    const pinnedProjects = sorted.filter((p) => cfg.pinned.includes(p.path));
    const pinnedNames = pinnedProjects.map((p) => p.name);
    const pinnedSorted = [...pinnedNames].sort();

    // Check that pinned projects are in alphabetical order
    expect(pinnedNames).toEqual(pinnedSorted);

    // Extract unpinned projects
    const unpinnedProjects = sorted.filter((p) => !cfg.pinned.includes(p.path) && !p.missing);
    const unpinnedNames = unpinnedProjects.map((p) => p.name);
    const unpinnedSorted = [...unpinnedNames].sort();

    // Check that unpinned projects are in alphabetical order
    expect(unpinnedNames).toEqual(unpinnedSorted);
  });
});
