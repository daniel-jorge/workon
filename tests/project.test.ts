import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { detectProjectType, mergeProject } from "../src/core/project.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES = join(__dirname, "fixtures");

describe("detectProjectType", () => {
  it("detects nodejs from package.json", () => {
    expect(detectProjectType(join(FIXTURES, "nodejs"))).toBe("nodejs");
  });

  it("detects rust from Cargo.toml", () => {
    expect(detectProjectType(join(FIXTURES, "rust"))).toBe("rust");
  });

  it("detects python from requirements.txt", () => {
    expect(detectProjectType(join(FIXTURES, "python"))).toBe("python");
  });

  it("detects generic from .git directory", () => {
    expect(detectProjectType(join(FIXTURES, "generic"))).toBe("generic");
  });

  it("returns null for a directory with no markers", () => {
    expect(detectProjectType(join(FIXTURES, "scan-root"))).toBeNull();
  });

  it("prioritizes nodejs over generic (nodejs has package.json, not .git)", () => {
    expect(detectProjectType(join(FIXTURES, "nodejs"))).toBe("nodejs");
  });
});

describe("mergeProject", () => {
  const baseConfig = {
    roots: [],
    maxDepth: 3,
    defaultIde: "code" as const,
    defaultProfile: "",
    ignore: ["node_modules", "dist", ".git"],
  };

  it("uses folder basename as name when no devproject", () => {
    const project = mergeProject(join(FIXTURES, "nodejs"), baseConfig);
    expect(project.name).toBe("nodejs");
  });

  it("uses devproject name override", () => {
    const project = mergeProject(join(FIXTURES, "configured"), baseConfig, {
      name: "My App",
      tags: [],
    });
    expect(project.name).toBe("My App");
  });

  it("uses global config defaults for ide and profile", () => {
    const project = mergeProject(join(FIXTURES, "nodejs"), baseConfig);
    expect(project.ide).toBe("code");
    expect(project.profile).toBe("");
  });

  it("overrides ide and profile from devproject", () => {
    const project = mergeProject(join(FIXTURES, "configured"), baseConfig, {
      ide: "code-insiders",
      profile: "personal",
      tags: [],
    });
    expect(project.ide).toBe("code-insiders");
    expect(project.profile).toBe("personal");
  });

  it("marks hasDevProject true when devproject is provided", () => {
    const project = mergeProject(join(FIXTURES, "configured"), baseConfig, {
      tags: [],
    });
    expect(project.hasDevProject).toBe(true);
  });

  it("marks hasDevProject false when devproject is absent", () => {
    const project = mergeProject(join(FIXTURES, "nodejs"), baseConfig);
    expect(project.hasDevProject).toBe(false);
  });
});
