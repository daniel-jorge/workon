import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { scanProjects } from "../src/core/scanner.js";
import type { GlobalConfig } from "../src/core/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCAN_ROOT = join(__dirname, "fixtures", "scan-root");

const baseConfig: GlobalConfig = {
  roots: [SCAN_ROOT],
  maxDepth: 3,
  defaultIde: "code",
  defaultProfile: "",
  ignore: ["node_modules", "dist", ".git"],
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
    expect(delta!.ide).toBe("code-insiders");
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
});
