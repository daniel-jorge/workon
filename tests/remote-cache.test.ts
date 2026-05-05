import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "workon-test-"));
  process.env["WORKON_CACHE_PATH"] = join(tmpDir, ".workon-remote-cache.json");
  process.env["WORKONRC_PATH"] = join(tmpDir, ".workonrc.json");
});

afterEach(() => {
  delete process.env["WORKON_CACHE_PATH"];
  delete process.env["WORKONRC_PATH"];
  rmSync(tmpDir, { recursive: true, force: true });
});

// AC13, EC8 — cache load/save
describe("loadRemoteCache", () => {
  it("returns empty cache with wasCorrupted=false when file does not exist", async () => {
    const { loadRemoteCache } = await import("@/core/remote-cache.js");
    const { cache, wasCorrupted } = loadRemoteCache();
    expect(cache.roots).toEqual({});
    expect(wasCorrupted).toBe(false);
  });

  it("returns empty cache and wasCorrupted=true when file contains invalid JSON (EC8)", async () => {
    const { loadRemoteCache } = await import("@/core/remote-cache.js");
    writeFileSync(join(tmpDir, ".workon-remote-cache.json"), "not valid json {{");
    const { cache, wasCorrupted } = loadRemoteCache();
    expect(cache.roots).toEqual({});
    expect(wasCorrupted).toBe(true);
  });

  it("returns valid cache when file is valid JSON", async () => {
    const { loadRemoteCache, saveRemoteCache } = await import("@/core/remote-cache.js");
    const cache = {
      version: 1,
      roots: {
        "ssh://alice@devbox.corp/home/alice/projects": {
          scannedAt: "2025-04-28T10:00:00Z",
          projects: [
            {
              name: "api-service",
              remotePath: "/home/alice/projects/api-service",
              type: "nodejs" as const,
              tags: [],
              description: "",
              openCommand: "code",
              profile: "",
              sshHost: "alice@devbox.corp",
            },
          ],
        },
      },
    };
    saveRemoteCache(cache);
    const { cache: loaded, wasCorrupted } = loadRemoteCache();
    expect(wasCorrupted).toBe(false);
    expect(loaded.roots["ssh://alice@devbox.corp/home/alice/projects"]?.projects).toHaveLength(1);
    expect(loaded.roots["ssh://alice@devbox.corp/home/alice/projects"]?.projects[0]?.name).toBe(
      "api-service",
    );
  });

  it("treats empty object as valid empty cache", async () => {
    const { loadRemoteCache } = await import("@/core/remote-cache.js");
    writeFileSync(
      join(tmpDir, ".workon-remote-cache.json"),
      JSON.stringify({ version: 1, roots: {} }),
    );
    const { cache, wasCorrupted } = loadRemoteCache();
    expect(cache.roots).toEqual({});
    expect(wasCorrupted).toBe(false);
  });
});

describe("saveRemoteCache", () => {
  it("persists data that can be read back correctly (FR4)", async () => {
    const { loadRemoteCache, saveRemoteCache } = await import("@/core/remote-cache.js");
    const cache = {
      version: 1,
      roots: {
        "ssh://alice@devbox.corp/home": {
          scannedAt: "2025-04-28T10:00:00Z",
          projects: [],
        },
      },
    };
    saveRemoteCache(cache);
    const { cache: loaded } = loadRemoteCache();
    expect(loaded.roots["ssh://alice@devbox.corp/home"]).toBeDefined();
    expect(loaded.roots["ssh://alice@devbox.corp/home"]?.scannedAt).toBe("2025-04-28T10:00:00Z");
  });

  it("overwrites previous cache on subsequent saves", async () => {
    const { loadRemoteCache, saveRemoteCache } = await import("@/core/remote-cache.js");
    saveRemoteCache({
      version: 1,
      roots: { "ssh://a@host/path": { scannedAt: "2025-01-01T00:00:00Z", projects: [] } },
    });
    saveRemoteCache({
      version: 1,
      roots: { "ssh://b@host/path": { scannedAt: "2025-02-01T00:00:00Z", projects: [] } },
    });
    const { cache: loaded } = loadRemoteCache();
    expect(loaded.roots["ssh://a@host/path"]).toBeUndefined();
    expect(loaded.roots["ssh://b@host/path"]).toBeDefined();
  });
});

// EC9, AC17 — deduplication
describe("deduplicateRemoteProjects", () => {
  it("removes projects with duplicate remotePath", async () => {
    const { deduplicateRemoteProjects } = await import("@/core/remote-cache.js");
    const projects = [
      {
        name: "api",
        remotePath: "/home/alice/projects/api",
        type: "nodejs" as const,
        tags: [],
        description: "",
        openCommand: "code",
        profile: "",
        sshHost: "alice@devbox.corp",
      },
      {
        name: "api",
        remotePath: "/home/alice/projects/api",
        type: "nodejs" as const,
        tags: [],
        description: "",
        openCommand: "code",
        profile: "",
        sshHost: "alice@devbox.corp",
      },
      {
        name: "frontend",
        remotePath: "/home/alice/projects/frontend",
        type: "nodejs" as const,
        tags: [],
        description: "",
        openCommand: "code",
        profile: "",
        sshHost: "alice@devbox.corp",
      },
    ];
    const deduped = deduplicateRemoteProjects(projects);
    expect(deduped).toHaveLength(2);
  });

  it("keeps first occurrence when deduplicating", async () => {
    const { deduplicateRemoteProjects } = await import("@/core/remote-cache.js");
    const projects = [
      {
        name: "first",
        remotePath: "/home/alice/projects/api",
        type: "nodejs" as const,
        tags: [],
        description: "first",
        openCommand: "code",
        profile: "",
        sshHost: "alice@devbox.corp",
      },
      {
        name: "second",
        remotePath: "/home/alice/projects/api",
        type: "nodejs" as const,
        tags: [],
        description: "second",
        openCommand: "code",
        profile: "",
        sshHost: "alice@devbox.corp",
      },
    ];
    const deduped = deduplicateRemoteProjects(projects);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.description).toBe("first");
  });

  it("returns unchanged array when no duplicates", async () => {
    const { deduplicateRemoteProjects } = await import("@/core/remote-cache.js");
    const projects = [
      {
        name: "api",
        remotePath: "/projects/api",
        type: "nodejs" as const,
        tags: [],
        description: "",
        openCommand: "code",
        profile: "",
        sshHost: "alice@devbox.corp",
      },
      {
        name: "fe",
        remotePath: "/projects/fe",
        type: "nodejs" as const,
        tags: [],
        description: "",
        openCommand: "code",
        profile: "",
        sshHost: "alice@devbox.corp",
      },
    ];
    expect(deduplicateRemoteProjects(projects)).toHaveLength(2);
  });
});

// FR2 — addRemoteRootToConfig (pure config mutation)
describe("addRemoteRootToConfig", () => {
  it("appends normalised URI to remoteRoots (AC1)", async () => {
    const { addRemoteRootToConfig } = await import("@/core/remote-cache.js");
    const cfg = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code",
      openCommands: [],
      defaultProfile: "",
      ignore: [],
      pinned: [],
      remoteRoots: [],
    };
    const updated = addRemoteRootToConfig(cfg, "ssh://alice@devbox.corp/home/alice/projects");
    expect(updated.remoteRoots).toContain("ssh://alice@devbox.corp/home/alice/projects");
  });

  it("does not mutate original config", async () => {
    const { addRemoteRootToConfig } = await import("@/core/remote-cache.js");
    const cfg = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code",
      openCommands: [],
      defaultProfile: "",
      ignore: [],
      pinned: [],
      remoteRoots: [],
    };
    addRemoteRootToConfig(cfg, "ssh://alice@devbox.corp/home/alice/projects");
    expect(cfg.remoteRoots).toHaveLength(0);
  });

  it("throws 'already configured' when URI is duplicate (AC12, EC3)", async () => {
    const { addRemoteRootToConfig } = await import("@/core/remote-cache.js");
    const cfg = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code",
      openCommands: [],
      defaultProfile: "",
      ignore: [],
      pinned: [],
      remoteRoots: ["ssh://alice@devbox.corp/home/alice/projects"],
    };
    expect(() => addRemoteRootToConfig(cfg, "ssh://alice@devbox.corp/home/alice/projects")).toThrow(
      /already configured/,
    );
  });
});

// FR2 — removeRemoteRootFromConfig
describe("removeRemoteRootFromConfig", () => {
  it("removes URI from remoteRoots and cache entry (AC11)", async () => {
    const { removeRemoteRootFromConfig } = await import("@/core/remote-cache.js");
    const cfg = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code",
      openCommands: [],
      defaultProfile: "",
      ignore: [],
      pinned: [],
      remoteRoots: ["ssh://alice@devbox.corp/home/alice/projects"],
    };
    const cache = {
      version: 1,
      roots: {
        "ssh://alice@devbox.corp/home/alice/projects": {
          scannedAt: "2025-04-28T10:00:00Z",
          projects: [],
        },
      },
    };
    const result = removeRemoteRootFromConfig(
      cfg,
      cache,
      "ssh://alice@devbox.corp/home/alice/projects",
    );
    expect(result.config.remoteRoots).not.toContain("ssh://alice@devbox.corp/home/alice/projects");
    expect(result.cache.roots["ssh://alice@devbox.corp/home/alice/projects"]).toBeUndefined();
    expect(result.removedPinnedCount).toBe(0);
  });

  it("removes pinned remote projects belonging to the removed root (AC11)", async () => {
    const { removeRemoteRootFromConfig } = await import("@/core/remote-cache.js");
    const cfg = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code",
      openCommands: [],
      defaultProfile: "",
      ignore: [],
      pinned: [
        "ssh://alice@devbox.corp/home/alice/projects/api-service",
        "ssh://alice@devbox.corp/home/alice/projects/frontend",
        "/local/project",
      ],
      remoteRoots: ["ssh://alice@devbox.corp/home/alice/projects"],
    };
    const cache = {
      version: 1,
      roots: {
        "ssh://alice@devbox.corp/home/alice/projects": {
          scannedAt: "2025-04-28T10:00:00Z",
          projects: [
            {
              name: "api-service",
              remotePath: "/home/alice/projects/api-service",
              type: "nodejs" as const,
              tags: [],
              description: "",
              openCommand: "code",
              profile: "",
              sshHost: "alice@devbox.corp",
            },
            {
              name: "frontend",
              remotePath: "/home/alice/projects/frontend",
              type: "nodejs" as const,
              tags: [],
              description: "",
              openCommand: "code",
              profile: "",
              sshHost: "alice@devbox.corp",
            },
          ],
        },
      },
    };
    const result = removeRemoteRootFromConfig(
      cfg,
      cache,
      "ssh://alice@devbox.corp/home/alice/projects",
    );
    expect(result.removedPinnedCount).toBe(2);
    expect(result.config.pinned).toContain("/local/project");
    expect(result.config.pinned).not.toContain(
      "ssh://alice@devbox.corp/home/alice/projects/api-service",
    );
    expect(result.config.pinned).not.toContain(
      "ssh://alice@devbox.corp/home/alice/projects/frontend",
    );
  });

  it("throws 'not configured' when URI is absent (AC16, EC10)", async () => {
    const { removeRemoteRootFromConfig } = await import("@/core/remote-cache.js");
    const cfg = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code",
      openCommands: [],
      defaultProfile: "",
      ignore: [],
      pinned: [],
      remoteRoots: [],
    };
    const cache = { version: 1, roots: {} };
    expect(() =>
      removeRemoteRootFromConfig(cfg, cache, "ssh://alice@devbox.corp/home/alice/projects"),
    ).toThrow(/not configured/);
  });

  it("does not mutate the original config or cache", async () => {
    const { removeRemoteRootFromConfig } = await import("@/core/remote-cache.js");
    const cfg = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code",
      openCommands: [],
      defaultProfile: "",
      ignore: [],
      pinned: [],
      remoteRoots: ["ssh://alice@devbox.corp/home/alice/projects"],
    };
    const cache = {
      version: 1,
      roots: {
        "ssh://alice@devbox.corp/home/alice/projects": {
          scannedAt: "2025-04-28T10:00:00Z",
          projects: [],
        },
      },
    };
    removeRemoteRootFromConfig(cfg, cache, "ssh://alice@devbox.corp/home/alice/projects");
    expect(cfg.remoteRoots).toHaveLength(1);
    expect(cache.roots["ssh://alice@devbox.corp/home/alice/projects"]).toBeDefined();
  });
});

// FR2 — listRemoteRootStatuses (no SSH)
describe("listRemoteRootStatuses", () => {
  it("returns cached status with ISO date derived from scannedAt", async () => {
    const { listRemoteRootStatuses } = await import("@/core/remote-cache.js");
    const cfg = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code",
      openCommands: [],
      defaultProfile: "",
      ignore: [],
      pinned: [],
      remoteRoots: ["ssh://alice@devbox.corp/home/alice/projects"],
    };
    const cache = {
      version: 1,
      roots: {
        "ssh://alice@devbox.corp/home/alice/projects": {
          scannedAt: "2025-04-28T10:00:00Z",
          projects: [],
        },
      },
    };
    const statuses = listRemoteRootStatuses(cfg, cache);
    expect(statuses).toHaveLength(1);
    expect(statuses[0]?.uri).toBe("ssh://alice@devbox.corp/home/alice/projects");
    expect(statuses[0]?.status).toBe("cached");
    expect(statuses[0]?.lastScanned).toBe("2025-04-28");
  });

  it("returns never-scanned status for roots with no cache entry", async () => {
    const { listRemoteRootStatuses } = await import("@/core/remote-cache.js");
    const cfg = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code",
      openCommands: [],
      defaultProfile: "",
      ignore: [],
      pinned: [],
      remoteRoots: ["ssh://bob@buildbox.internal/home/bob/work"],
    };
    const cache = { version: 1, roots: {} };
    const statuses = listRemoteRootStatuses(cfg, cache);
    expect(statuses[0]?.status).toBe("never-scanned");
    expect(statuses[0]?.lastScanned).toBeNull();
  });

  it("lists multiple roots in configured order", async () => {
    const { listRemoteRootStatuses } = await import("@/core/remote-cache.js");
    const cfg = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code",
      openCommands: [],
      defaultProfile: "",
      ignore: [],
      pinned: [],
      remoteRoots: [
        "ssh://alice@devbox.corp/home/alice/projects",
        "ssh://bob@buildbox.internal/home/bob/work",
      ],
    };
    const cache = {
      version: 1,
      roots: {
        "ssh://alice@devbox.corp/home/alice/projects": {
          scannedAt: "2025-04-28T10:00:00Z",
          projects: [],
        },
      },
    };
    const statuses = listRemoteRootStatuses(cfg, cache);
    expect(statuses).toHaveLength(2);
    expect(statuses[0]?.uri).toBe("ssh://alice@devbox.corp/home/alice/projects");
    expect(statuses[0]?.status).toBe("cached");
    expect(statuses[1]?.uri).toBe("ssh://bob@buildbox.internal/home/bob/work");
    expect(statuses[1]?.status).toBe("never-scanned");
  });
});

// FR4, AC3, AC4 — loadRemoteProjects
describe("loadRemoteProjects", () => {
  const baseCfg = {
    roots: [] as string[],
    maxDepth: 3,
    defaultOpenCommand: "code",
    openCommands: [{ name: "Visual Studio Code", command: "code" }],
    defaultProfile: "",
    ignore: [] as string[],
    pinned: [] as string[],
    remoteRoots: ["ssh://alice@devbox.corp/home/alice/projects"],
  };

  it("converts cached projects to Project objects with isRemote=true (AC4)", async () => {
    const { loadRemoteProjects } = await import("@/core/remote-cache.js");
    const cache = {
      version: 1,
      roots: {
        "ssh://alice@devbox.corp/home/alice/projects": {
          scannedAt: "2025-04-28T10:00:00Z",
          projects: [
            {
              name: "api-service",
              remotePath: "/home/alice/projects/api-service",
              type: "nodejs" as const,
              tags: [],
              description: "",
              openCommand: "code",
              profile: "",
              sshHost: "alice@devbox.corp",
            },
          ],
        },
      },
    };
    const projects = loadRemoteProjects(baseCfg, cache);
    expect(projects).toHaveLength(1);
    expect(projects[0]?.isRemote).toBe(true);
    expect(projects[0]?.sshHost).toBe("alice@devbox.corp");
    expect(projects[0]?.remotePath).toBe("/home/alice/projects/api-service");
    expect(projects[0]?.path).toBe("ssh://alice@devbox.corp/home/alice/projects/api-service");
    expect(projects[0]?.name).toBe("api-service");
  });

  it("uses per-project openCommand from cache (AC14)", async () => {
    const { loadRemoteProjects } = await import("@/core/remote-cache.js");
    const cache = {
      version: 1,
      roots: {
        "ssh://alice@devbox.corp/home/alice/projects": {
          scannedAt: "2025-04-28T10:00:00Z",
          projects: [
            {
              name: "api-service",
              remotePath: "/home/alice/projects/api-service",
              type: "nodejs" as const,
              tags: ["backend"],
              description: "Core API",
              openCommand: "code-insiders",
              profile: "",
              sshHost: "alice@devbox.corp",
            },
          ],
        },
      },
    };
    const projects = loadRemoteProjects(baseCfg, cache);
    expect(projects[0]?.openCommand).toBe("code-insiders");
    expect(projects[0]?.description).toBe("Core API");
    expect(projects[0]?.tags).toEqual(["backend"]);
  });

  it("returns empty array when config has no remoteRoots", async () => {
    const { loadRemoteProjects } = await import("@/core/remote-cache.js");
    const cfg = { ...baseCfg, remoteRoots: [] };
    const cache = { version: 1, roots: {} };
    expect(loadRemoteProjects(cfg, cache)).toHaveLength(0);
  });

  it("deduplicates projects from overlapping roots (EC9, AC17)", async () => {
    const { loadRemoteProjects } = await import("@/core/remote-cache.js");
    const cfg = {
      ...baseCfg,
      remoteRoots: [
        "ssh://alice@devbox.corp/home/alice",
        "ssh://alice@devbox.corp/home/alice/projects",
      ],
    };
    const cache = {
      version: 1,
      roots: {
        "ssh://alice@devbox.corp/home/alice": {
          scannedAt: "2025-04-28T10:00:00Z",
          projects: [
            {
              name: "api-service",
              remotePath: "/home/alice/projects/api-service",
              type: "nodejs" as const,
              tags: [],
              description: "",
              openCommand: "code",
              profile: "",
              sshHost: "alice@devbox.corp",
            },
          ],
        },
        "ssh://alice@devbox.corp/home/alice/projects": {
          scannedAt: "2025-04-28T10:00:00Z",
          projects: [
            {
              name: "api-service",
              remotePath: "/home/alice/projects/api-service",
              type: "nodejs" as const,
              tags: [],
              description: "",
              openCommand: "code",
              profile: "",
              sshHost: "alice@devbox.corp",
            },
          ],
        },
      },
    };
    const projects = loadRemoteProjects(cfg, cache);
    expect(projects).toHaveLength(1);
    expect(projects[0]?.name).toBe("api-service");
  });

  it("returns empty array when remoteRoot has no cache entry", async () => {
    const { loadRemoteProjects } = await import("@/core/remote-cache.js");
    const cache = { version: 1, roots: {} };
    expect(loadRemoteProjects(baseCfg, cache)).toHaveLength(0);
  });

  it("sets hasDevProject=true when cached project has non-empty openCommand or description", async () => {
    const { loadRemoteProjects } = await import("@/core/remote-cache.js");
    const cache = {
      version: 1,
      roots: {
        "ssh://alice@devbox.corp/home/alice/projects": {
          scannedAt: "2025-04-28T10:00:00Z",
          projects: [
            {
              name: "has-rc",
              remotePath: "/home/alice/projects/has-rc",
              type: "nodejs" as const,
              tags: [],
              description: "My project",
              openCommand: "code",
              profile: "",
              sshHost: "alice@devbox.corp",
            },
            {
              name: "no-rc",
              remotePath: "/home/alice/projects/no-rc",
              type: "nodejs" as const,
              tags: [],
              description: "",
              openCommand: "",
              profile: "",
              sshHost: "alice@devbox.corp",
            },
          ],
        },
      },
    };
    const projects = loadRemoteProjects(baseCfg, cache);
    const hasRc = projects.find((p) => p.name === "has-rc");
    const noRc = projects.find((p) => p.name === "no-rc");
    expect(hasRc?.hasDevProject).toBe(true);
    expect(noRc?.hasDevProject).toBe(false);
  });
});
