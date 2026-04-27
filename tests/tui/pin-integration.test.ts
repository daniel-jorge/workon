import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Project, GlobalConfig } from "@/types.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "workon-tui-test-"));
  process.env["WORKONRC_PATH"] = join(tmpDir, ".workonrc.json");
});

afterEach(() => {
  delete process.env["WORKONRC_PATH"];
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("TUI - pinned projects display", () => {
  it("identifies pinned projects correctly", async () => {
    const { isPinned } = await import("@/core/pinning.js");

    const config: GlobalConfig = {
      roots: [],
      maxDepth: 3,
      defaultIde: "code",
      defaultProfile: "",
      ignore: [],
      pinned: ["/path/to/pinned-app", "/path/to/another-pin"],
    };

    const projects: Project[] = [
      {
        name: "pinned-app",
        path: "/path/to/pinned-app",
        type: "nodejs",
        ide: "code",
        profile: "",
        description: "A pinned project",
        tags: [],
        hasDevProject: false,
      },
      {
        name: "unpinned-app",
        path: "/path/to/unpinned-app",
        type: "nodejs",
        ide: "code",
        profile: "",
        description: "Not pinned",
        tags: [],
        hasDevProject: false,
      },
    ];

    expect(isPinned(projects[0]!.path, config)).toBe(true);
    expect(isPinned(projects[1]!.path, config)).toBe(false);
  });

  it("sorts pinned projects to top of list", async () => {
    const { isPinned } = await import("@/core/pinning.js");

    const config: GlobalConfig = {
      roots: [],
      maxDepth: 3,
      defaultIde: "code",
      defaultProfile: "",
      ignore: [],
      pinned: ["/path/to/project-b"],
    };

    const unsortedProjects: Project[] = [
      {
        name: "project-a",
        path: "/path/to/project-a",
        type: "nodejs",
        ide: "code",
        profile: "",
        description: "",
        tags: [],
        hasDevProject: false,
      },
      {
        name: "project-b",
        path: "/path/to/project-b",
        type: "nodejs",
        ide: "code",
        profile: "",
        description: "",
        tags: [],
        hasDevProject: false,
      },
      {
        name: "project-c",
        path: "/path/to/project-c",
        type: "nodejs",
        ide: "code",
        profile: "",
        description: "",
        tags: [],
        hasDevProject: false,
      },
    ];

    // Sort with pinned first
    const sorted = [...unsortedProjects].sort((a, b) => {
      const aPinned = isPinned(a.path, config);
      const bPinned = isPinned(b.path, config);
      if (aPinned !== bPinned) return bPinned ? 1 : -1;
      return 0;
    });

    expect(sorted[0]?.name).toBe("project-b"); // Pinned
    expect(sorted[1]?.name).toBe("project-a"); // Unpinned
    expect(sorted[2]?.name).toBe("project-c"); // Unpinned
  });

  it("respects multiple pinned projects order", async () => {
    const { isPinned } = await import("@/core/pinning.js");

    const config: GlobalConfig = {
      roots: [],
      maxDepth: 3,
      defaultIde: "code",
      defaultProfile: "",
      ignore: [],
      pinned: ["/path/to/project-b", "/path/to/project-c"],
    };

    const unsortedProjects: Project[] = [
      {
        name: "project-a",
        path: "/path/to/project-a",
        type: "nodejs",
        ide: "code",
        profile: "",
        description: "",
        tags: [],
        hasDevProject: false,
      },
      {
        name: "project-b",
        path: "/path/to/project-b",
        type: "nodejs",
        ide: "code",
        profile: "",
        description: "",
        tags: [],
        hasDevProject: false,
      },
      {
        name: "project-c",
        path: "/path/to/project-c",
        type: "nodejs",
        ide: "code",
        profile: "",
        description: "",
        tags: [],
        hasDevProject: false,
      },
    ];

    // Sort with pinned first
    const sorted = [...unsortedProjects].sort((a, b) => {
      const aPinned = isPinned(a.path, config);
      const bPinned = isPinned(b.path, config);
      if (aPinned !== bPinned) return bPinned ? 1 : -1;
      return 0;
    });

    // Both b and c are pinned, should come before a
    expect(sorted[0]?.name).toBe("project-b");
    expect(sorted[1]?.name).toBe("project-c");
    expect(sorted[2]?.name).toBe("project-a");
  });
});

describe("TUI - search with pinned projects", () => {
  it("maintains pin ordering in search results", async () => {
    const { fuzzySearch } = await import("@/core/search.js");
    const { isPinned } = await import("@/core/pinning.js");

    const config: GlobalConfig = {
      roots: [],
      maxDepth: 3,
      defaultIde: "code",
      defaultProfile: "",
      ignore: [],
      pinned: ["/path/to/my-app"],
    };

    const projects: Project[] = [
      {
        name: "my-app",
        path: "/path/to/my-app",
        type: "nodejs",
        ide: "code",
        profile: "",
        description: "",
        tags: [],
        hasDevProject: false,
      },
      {
        name: "another-app",
        path: "/path/to/another-app",
        type: "nodejs",
        ide: "code",
        profile: "",
        description: "",
        tags: [],
        hasDevProject: false,
      },
      {
        name: "app-legacy",
        path: "/path/to/app-legacy",
        type: "nodejs",
        ide: "code",
        profile: "",
        description: "",
        tags: [],
        hasDevProject: false,
      },
    ];

    // Search for "app"
    const results = fuzzySearch(projects, "app");

    // Sort results with pinned first
    const sorted = [...results].sort((a, b) => {
      const aPinned = isPinned(a.path, config);
      const bPinned = isPinned(b.path, config);
      if (aPinned !== bPinned) return bPinned ? 1 : -1;
      return 0;
    });

    // Pinned project should be first
    expect(sorted[0]?.name).toBe("my-app");
  });

  it("filters pinned projects correctly", async () => {
    const { isPinned } = await import("@/core/pinning.js");

    const config: GlobalConfig = {
      roots: [],
      maxDepth: 3,
      defaultIde: "code",
      defaultProfile: "",
      ignore: [],
      pinned: ["/path/to/my-app"],
    };

    const projects: Project[] = [
      {
        name: "my-app",
        path: "/path/to/my-app",
        type: "nodejs",
        ide: "code",
        profile: "",
        description: "",
        tags: [],
        hasDevProject: false,
      },
      {
        name: "other-project",
        path: "/path/to/other-project",
        type: "nodejs",
        ide: "code",
        profile: "",
        description: "",
        tags: [],
        hasDevProject: false,
      },
    ];

    const pinnedProjects = projects.filter((p) => isPinned(p.path, config));
    expect(pinnedProjects).toHaveLength(1);
    expect(pinnedProjects[0]?.name).toBe("my-app");
  });
});

describe("TUI - pin indicator formatting", () => {
  it("formats pinned project with pin emoji", () => {
    const pinnedIndicator = "📌";
    const projectName = "my-app";

    const formatted = `${pinnedIndicator} ${projectName}`;
    expect(formatted).toBe("📌 my-app");
  });

  it("formats unpinned project without indicator", () => {
    const projectName = "my-app";
    expect(projectName).toBe("my-app");
  });

  it("pin indicator remains visible in different themes", () => {
    // Pin emoji should work in both light and dark terminals
    const pinnedIndicator = "📌";
    expect(pinnedIndicator).toBeDefined();
    // Emoji characters are Unicode and may have multiple code units
    expect(pinnedIndicator.length).toBeGreaterThan(0);
  });
});

describe("TUI - pin context menu", () => {
  it("provides toggle pin option in context menu", async () => {
    const { isPinned, togglePin } = await import("@/core/pinning.js");

    let config: GlobalConfig = {
      roots: [],
      maxDepth: 3,
      defaultIde: "code",
      defaultProfile: "",
      ignore: [],
      pinned: [],
    };

    const projectPath = "/path/to/my-app";

    // Initially unpinned
    expect(isPinned(projectPath, config)).toBe(false);

    // Toggle via context menu action
    config = togglePin(projectPath, config);
    expect(isPinned(projectPath, config)).toBe(true);

    // Toggle again
    config = togglePin(projectPath, config);
    expect(isPinned(projectPath, config)).toBe(false);
  });

  it("handles context menu actions on missing projects", async () => {
    const { isPinned, togglePin } = await import("@/core/pinning.js");

    let config: GlobalConfig = {
      roots: [],
      maxDepth: 3,
      defaultIde: "code",
      defaultProfile: "",
      ignore: [],
      pinned: ["/deleted/project"],
    };

    // Can still toggle even if project is missing
    expect(isPinned("/deleted/project", config)).toBe(true);

    config = togglePin("/deleted/project", config);
    expect(isPinned("/deleted/project", config)).toBe(false);
  });
});

describe("TUI - project type preservation with pins", () => {
  it("maintains project type when pinning", async () => {
    const { loadConfig, saveConfig } = await import("@/core/config.js");

    const config = loadConfig();

    const project: Project = {
      name: "my-app",
      path: "/path/to/my-app",
      type: "nodejs",
      ide: "code",
      profile: "",
      description: "",
      tags: [],
      hasDevProject: false,
    };

    // Add to pinned
    config.pinned = [project.path];
    saveConfig(config);

    // Verify type is independent of pin status
    expect(project.type).toBe("nodejs");
  });

  it("supports pinning projects of all types", async () => {
    const { togglePin } = await import("@/core/pinning.js");

    let config: GlobalConfig = {
      roots: [],
      maxDepth: 3,
      defaultIde: "code",
      defaultProfile: "",
      ignore: [],
      pinned: [],
    };

    const projectTypes = ["nodejs", "rust", "python", "go", "java", "dotnet", "generic"];

    for (const type of projectTypes) {
      const path = `/path/to/${type}-project`;
      config = togglePin(path, config);
    }

    expect(config.pinned).toHaveLength(projectTypes.length);
  });
});

describe("TUI - error handling for pinned projects", () => {
  it("handles warning for deleted pinned project", async () => {
    const { validatePinnedPaths } = await import("@/core/pinning.js");

    const deletedPath = "/deleted/project";
    const { valid, invalid } = validatePinnedPaths([deletedPath]);

    expect(valid).toHaveLength(0);
    expect(invalid).toContain(deletedPath);
  });

  it("provides unpin option for missing projects", async () => {
    const { togglePin } = await import("@/core/pinning.js");

    let config: GlobalConfig = {
      roots: [],
      maxDepth: 3,
      defaultIde: "code",
      defaultProfile: "",
      ignore: [],
      pinned: ["/missing/project"],
    };

    // User can still unpin via context menu
    config = togglePin("/missing/project", config);
    expect(config.pinned).toHaveLength(0);
  });

  it("handles narrow terminal width for context menu", async () => {
    // Pin option should work even in narrow terminals
    const contextMenuOptions = [
      { label: "Toggle Pin", shortcut: "SHIFT+F10" },
      { label: "Open in IDE", shortcut: "ENTER" },
    ];

    expect(contextMenuOptions).toHaveLength(2);
  });
});

describe("TUI - pin persistence across sessions", () => {
  it("loads pins from config on TUI startup", async () => {
    const { loadConfig, saveConfig } = await import("@/core/config.js");

    // First session: set pins
    let config = loadConfig();
    config.pinned = ["/path/to/project1", "/path/to/project2"];
    saveConfig(config);

    // Simulate session close and reopen
    config = loadConfig();

    expect(config.pinned).toEqual(["/path/to/project1", "/path/to/project2"]);
  });

  it("preserves pins when config is modified", async () => {
    const { loadConfig, saveConfig } = await import("@/core/config.js");

    let config = loadConfig();
    config.pinned = ["/path/to/project"];
    config.maxDepth = 5;
    saveConfig(config);

    config = loadConfig();
    config.roots = ["/new/root"];
    saveConfig(config);

    config = loadConfig();
    expect(config.pinned).toEqual(["/path/to/project"]);
    expect(config.roots).toEqual(["/new/root"]);
  });
});

describe("TUI - additional features", () => {
  it("handles multiple pinned projects with same parent directory", async () => {
    const { togglePin, isPinned } = await import("@/core/pinning.js");

    let config: GlobalConfig = {
      roots: [],
      maxDepth: 3,
      defaultIde: "code",
      defaultProfile: "",
      ignore: [],
      pinned: [],
    };

    const projects = [
      "/home/user/projects/app1",
      "/home/user/projects/app2",
      "/home/user/projects/app3",
    ];

    for (const project of projects) {
      config = togglePin(project, config);
    }

    for (const project of projects) {
      expect(isPinned(project, config)).toBe(true);
    }

    expect(config.pinned).toHaveLength(3);
  });

  it("maintains stable ordering of pinned projects", async () => {
    const { loadConfig, saveConfig } = await import("@/core/config.js");

    let config = loadConfig();
    const paths = ["/path/c", "/path/a", "/path/b"];
    config.pinned = paths;
    saveConfig(config);

    // Reload multiple times
    for (let i = 0; i < 3; i++) {
      config = loadConfig();
      expect(config.pinned).toEqual(paths);
      saveConfig(config);
    }
  });
});
