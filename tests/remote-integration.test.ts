import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("execa");

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "workon-test-"));
  process.env["WORKONRC_PATH"] = join(tmpDir, ".workonrc.json");
  process.env["WORKON_CACHE_PATH"] = join(tmpDir, ".workon-remote-cache.json");
  vi.resetAllMocks();
});

afterEach(() => {
  delete process.env["WORKONRC_PATH"];
  delete process.env["WORKON_CACHE_PATH"];
  rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function writeCacheFile(
  roots: Record<
    string,
    {
      scannedAt: string;
      projects: Array<{
        name: string;
        remotePath: string;
        type: string;
        tags: string[];
        description: string;
        openCommand: string;
        profile: string;
        sshHost: string;
      }>;
    }
  >,
) {
  writeFileSync(join(tmpDir, ".workon-remote-cache.json"), JSON.stringify({ version: 1, roots }));
}

function writeConfigFile(overrides: Record<string, unknown> = {}) {
  writeFileSync(
    join(tmpDir, ".workonrc.json"),
    JSON.stringify({
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code",
      openCommands: [
        { name: "Visual Studio Code", command: "code" },
        { name: "VS Code Insiders", command: "code-insiders" },
      ],
      defaultProfile: "",
      ignore: [],
      pinned: [],
      remoteRoots: [],
      ...overrides,
    }),
  );
}

// ─── Scanner Integration (AC3, AC4) ─────────────────────────────────────────

describe("scanProjects — remote project integration", () => {
  it("loads remote projects from cache without SSH (AC3)", async () => {
    writeConfigFile({
      remoteRoots: ["ssh://alice@devbox.corp/home/alice/projects"],
    });
    writeCacheFile({
      "ssh://alice@devbox.corp/home/alice/projects": {
        scannedAt: "2025-04-28T10:00:00Z",
        projects: [
          {
            name: "api-service",
            remotePath: "/home/alice/projects/api-service",
            type: "nodejs",
            tags: [],
            description: "",
            openCommand: "code",
            profile: "",
            sshHost: "alice@devbox.corp",
          },
        ],
      },
    });

    const { scanProjects } = await import("@/core/scanner.js");
    const { loadConfig } = await import("@/core/config.js");
    const config = loadConfig();
    const projects = await scanProjects(config);
    const remote = projects.find((p) => p.name === "api-service");
    expect(remote).toBeDefined();
    expect(remote?.isRemote).toBe(true);
    expect(remote?.sshHost).toBe("alice@devbox.corp");
  });

  it("remote projects have isRemote=true and sshHost+remotePath set (AC4)", async () => {
    writeConfigFile({
      remoteRoots: ["ssh://alice@devbox.corp/home/alice/projects"],
    });
    writeCacheFile({
      "ssh://alice@devbox.corp/home/alice/projects": {
        scannedAt: "2025-04-28T10:00:00Z",
        projects: [
          {
            name: "frontend",
            remotePath: "/home/alice/projects/frontend",
            type: "nodejs",
            tags: [],
            description: "",
            openCommand: "code",
            profile: "",
            sshHost: "alice@devbox.corp",
          },
        ],
      },
    });

    const { scanProjects } = await import("@/core/scanner.js");
    const { loadConfig } = await import("@/core/config.js");
    const config = loadConfig();
    const projects = await scanProjects(config);
    const remote = projects.find((p) => p.name === "frontend");
    expect(remote?.isRemote).toBe(true);
    expect(remote?.sshHost).toBe("alice@devbox.corp");
    expect(remote?.remotePath).toBe("/home/alice/projects/frontend");
    expect(remote?.path).toBe("ssh://alice@devbox.corp/home/alice/projects/frontend");
  });

  it("missing/corrupted cache results in zero remote projects without error (AC13, EC8)", async () => {
    writeConfigFile({
      remoteRoots: ["ssh://alice@devbox.corp/home/alice/projects"],
    });
    writeFileSync(join(tmpDir, ".workon-remote-cache.json"), "{{invalid json}}");

    const { scanProjects } = await import("@/core/scanner.js");
    const { loadConfig } = await import("@/core/config.js");
    const config = loadConfig();
    const projects = await scanProjects(config);
    const remoteProjects = projects.filter((p) => p.isRemote);
    expect(remoteProjects).toHaveLength(0);
  });

  it("absent cache file results in zero remote projects (AC13)", async () => {
    writeConfigFile({
      remoteRoots: ["ssh://alice@devbox.corp/home/alice/projects"],
    });
    // No cache file written

    const { scanProjects } = await import("@/core/scanner.js");
    const { loadConfig } = await import("@/core/config.js");
    const config = loadConfig();
    const projects = await scanProjects(config);
    const remoteProjects = projects.filter((p) => p.isRemote);
    expect(remoteProjects).toHaveLength(0);
  });

  it("deduplicates overlapping remote roots (AC17, EC9)", async () => {
    writeConfigFile({
      remoteRoots: [
        "ssh://alice@devbox.corp/home/alice",
        "ssh://alice@devbox.corp/home/alice/projects",
      ],
    });
    writeCacheFile({
      "ssh://alice@devbox.corp/home/alice": {
        scannedAt: "2025-04-28T10:00:00Z",
        projects: [
          {
            name: "api-service",
            remotePath: "/home/alice/projects/api-service",
            type: "nodejs",
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
            type: "nodejs",
            tags: [],
            description: "",
            openCommand: "code",
            profile: "",
            sshHost: "alice@devbox.corp",
          },
        ],
      },
    });

    const { scanProjects } = await import("@/core/scanner.js");
    const { loadConfig } = await import("@/core/config.js");
    const config = loadConfig();
    const projects = await scanProjects(config);
    const matches = projects.filter((p) => p.name === "api-service");
    expect(matches).toHaveLength(1);
  });

  it("pinned remote project is NOT marked missing (NFR3, EC4)", async () => {
    const sshUri = "ssh://alice@devbox.corp/home/alice/projects/api-service";
    writeConfigFile({
      remoteRoots: ["ssh://alice@devbox.corp/home/alice/projects"],
      pinned: [sshUri],
    });
    writeCacheFile({
      "ssh://alice@devbox.corp/home/alice/projects": {
        scannedAt: "2025-04-28T10:00:00Z",
        projects: [
          {
            name: "api-service",
            remotePath: "/home/alice/projects/api-service",
            type: "nodejs",
            tags: [],
            description: "",
            openCommand: "code",
            profile: "",
            sshHost: "alice@devbox.corp",
          },
        ],
      },
    });

    const { scanProjects } = await import("@/core/scanner.js");
    const { loadConfig } = await import("@/core/config.js");
    const config = loadConfig();
    const projects = await scanProjects(config);
    const pinned = projects.find((p) => p.path === sshUri);
    expect(pinned).toBeDefined();
    expect(pinned?.missing).toBeFalsy();
  });

  it("local and remote projects with same name both appear (EC6)", async () => {
    const localDir = join(tmpDir, "projects", "shared-lib");
    mkdirSync(localDir, { recursive: true });
    writeFileSync(join(localDir, "package.json"), JSON.stringify({ name: "shared-lib" }));

    writeConfigFile({
      roots: [join(tmpDir, "projects")],
      remoteRoots: ["ssh://alice@devbox.corp/home/alice/projects"],
    });
    writeCacheFile({
      "ssh://alice@devbox.corp/home/alice/projects": {
        scannedAt: "2025-04-28T10:00:00Z",
        projects: [
          {
            name: "shared-lib",
            remotePath: "/home/alice/projects/shared-lib",
            type: "nodejs",
            tags: [],
            description: "",
            openCommand: "code",
            profile: "",
            sshHost: "alice@devbox.corp",
          },
        ],
      },
    });

    const { scanProjects } = await import("@/core/scanner.js");
    const { loadConfig } = await import("@/core/config.js");
    const config = loadConfig();
    const projects = await scanProjects(config);
    const matches = projects.filter((p) => p.name === "shared-lib");
    expect(matches).toHaveLength(2);
    const local = matches.find((p) => !p.isRemote);
    const remote = matches.find((p) => p.isRemote);
    expect(local).toBeDefined();
    expect(remote).toBeDefined();
  });
});

// ─── Launcher — Remote-Aware VS Code Launch (AC5, AC6, FR8) ──────────────────

describe("openProject — remote projects", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("executes code --remote ssh-remote+host /path for a remote project (AC5)", async () => {
    const execaMod = await import("execa");
    vi.mocked(execaMod.execa).mockResolvedValue({ exitCode: 0 } as never);

    const { openProject } = await import("@/core/launcher.js");
    const remoteProject = {
      name: "api-service",
      path: "ssh://alice@devbox.corp/home/alice/projects/api-service",
      type: "nodejs" as const,
      openCommand: "code",
      terminalApp: false,
      profile: "",
      description: "",
      tags: [],
      hasDevProject: false,
      isRemote: true as const,
      sshHost: "alice@devbox.corp",
      remotePath: "/home/alice/projects/api-service",
    };
    await openProject(remoteProject);
    expect(execaMod.execa).toHaveBeenCalledWith(
      "code",
      ["--remote", "ssh-remote+alice@devbox.corp", "/home/alice/projects/api-service"],
      expect.any(Object),
    );
  });

  it("uses code-insiders variant correctly (AC5)", async () => {
    const execaMod = await import("execa");
    vi.mocked(execaMod.execa).mockResolvedValue({ exitCode: 0 } as never);

    const { openProject } = await import("@/core/launcher.js");
    const remoteProject = {
      name: "api-service",
      path: "ssh://alice@devbox.corp/home/alice/projects/api-service",
      type: "nodejs" as const,
      openCommand: "code-insiders",
      terminalApp: false,
      profile: "",
      description: "",
      tags: [],
      hasDevProject: false,
      isRemote: true as const,
      sshHost: "alice@devbox.corp",
      remotePath: "/home/alice/projects/api-service",
    };
    await openProject(remoteProject);
    expect(execaMod.execa).toHaveBeenCalledWith(
      "code-insiders",
      ["--remote", "ssh-remote+alice@devbox.corp", "/home/alice/projects/api-service"],
      expect.any(Object),
    );
  });

  it("throws when remote project has non-VS Code open command (AC6, EC5)", async () => {
    const { openProject } = await import("@/core/launcher.js");
    const remoteProject = {
      name: "nvim-project",
      path: "ssh://alice@devbox.corp/home/alice/projects/nvim-project",
      type: "generic" as const,
      openCommand: "nvim",
      terminalApp: true,
      profile: "",
      description: "",
      tags: [],
      hasDevProject: false,
      isRemote: true as const,
      sshHost: "alice@devbox.corp",
      remotePath: "/home/alice/projects/nvim-project",
    };
    await expect(openProject(remoteProject)).rejects.toThrow(
      "Remote projects can only be opened with VS Code or VS Code Insiders.",
    );
  });
});

// ─── Pinning — SSH URI handling (NFR3) ───────────────────────────────────────

describe("validatePinnedPaths — SSH URIs go into valid bucket", () => {
  it("SSH URIs are valid (not checked against filesystem) (NFR3)", async () => {
    const { validatePinnedPaths } = await import("@/core/pinning.js");
    const paths = [
      "ssh://alice@devbox.corp/home/alice/projects/api-service",
      "/nonexistent/local/path",
    ];
    const { valid, invalid } = validatePinnedPaths(paths);
    expect(valid).toContain("ssh://alice@devbox.corp/home/alice/projects/api-service");
    expect(invalid).toContain("/nonexistent/local/path");
    expect(invalid).not.toContain("ssh://alice@devbox.corp/home/alice/projects/api-service");
  });

  it("multiple SSH URIs are all placed in valid bucket", async () => {
    const { validatePinnedPaths } = await import("@/core/pinning.js");
    const paths = [
      "ssh://alice@devbox.corp/home/alice/projects/api-service",
      "ssh://alice@devbox.corp/home/alice/projects/frontend",
      "ssh://bob@buildbox.internal/home/bob/work/tool",
    ];
    const { valid, invalid } = validatePinnedPaths(paths);
    expect(valid).toHaveLength(3);
    expect(invalid).toHaveLength(0);
  });
});

// ─── Config round-trip — remoteRoots field (FR1, NFR3) ───────────────────────

describe("GlobalConfig — remoteRoots field", () => {
  it("defaults to empty array when not specified", async () => {
    const { loadConfig } = await import("@/core/config.js");
    const config = loadConfig();
    expect(config.remoteRoots).toEqual([]);
  });

  it("persists remoteRoots across save/load", async () => {
    const { loadConfig, saveConfig } = await import("@/core/config.js");
    const config = loadConfig();
    config.remoteRoots = ["ssh://alice@devbox.corp/home/alice/projects"];
    saveConfig(config);
    const reloaded = loadConfig();
    expect(reloaded.remoteRoots).toEqual(["ssh://alice@devbox.corp/home/alice/projects"]);
  });

  it("existing configs without remoteRoots load successfully (NFR3 backward compat)", async () => {
    writeFileSync(
      join(tmpDir, ".workonrc.json"),
      JSON.stringify({
        roots: ["/home/user/projects"],
        maxDepth: 3,
        defaultOpenCommand: "code",
        openCommands: [{ name: "VS Code", command: "code" }],
        defaultProfile: "",
        ignore: [],
        pinned: [],
        // no remoteRoots field
      }),
    );
    const { loadConfig } = await import("@/core/config.js");
    const config = loadConfig();
    expect(config.remoteRoots).toEqual([]);
    expect(config.roots).toEqual(["/home/user/projects"]);
  });
});

// ─── workon scan core logic (AC7, AC8, FR5) ──────────────────────────────────

describe("scanRemoteRoots (full rescan logic)", () => {
  it("updates cache with fresh projects on successful scan (AC7)", async () => {
    const execaMod = await import("execa");
    const projectLine = JSON.stringify({
      path: "/home/alice/projects/new-service",
      marker: "package.json",
      config: null,
    });
    vi.mocked(execaMod.execa).mockResolvedValue({
      stdout: projectLine + "\n",
      stderr: "",
      exitCode: 0,
    } as never);

    writeConfigFile({
      remoteRoots: ["ssh://alice@devbox.corp/home/alice/projects"],
    });

    const { scanRemoteRoots } = await import("@/core/remote-scan.js");
    const { loadConfig } = await import("@/core/config.js");
    const { loadRemoteCache, saveRemoteCache } = await import("@/core/remote-cache.js");
    const config = loadConfig();
    const { cache } = loadRemoteCache();
    const result = await scanRemoteRoots(config, cache);
    saveRemoteCache(result.cache);

    const { cache: updated } = loadRemoteCache();
    const entry = updated.roots["ssh://alice@devbox.corp/home/alice/projects"];
    expect(entry?.projects).toHaveLength(1);
    expect(entry?.projects[0]?.name).toBe("new-service");
    expect(result.errors).toHaveLength(0);
  });

  it("preserves existing cache when host is unreachable (AC8, EC1)", async () => {
    const execaMod = await import("execa");
    vi.mocked(execaMod.execa).mockRejectedValue(new Error("Connection refused"));

    writeConfigFile({
      remoteRoots: ["ssh://alice@devbox.corp/home/alice/projects"],
    });
    writeCacheFile({
      "ssh://alice@devbox.corp/home/alice/projects": {
        scannedAt: "2025-04-28T10:00:00Z",
        projects: [
          {
            name: "api-service",
            remotePath: "/home/alice/projects/api-service",
            type: "nodejs",
            tags: [],
            description: "",
            openCommand: "code",
            profile: "",
            sshHost: "alice@devbox.corp",
          },
        ],
      },
    });

    const { scanRemoteRoots } = await import("@/core/remote-scan.js");
    const { loadConfig } = await import("@/core/config.js");
    const { loadRemoteCache } = await import("@/core/remote-cache.js");
    const config = loadConfig();
    const { cache } = loadRemoteCache();
    const result = await scanRemoteRoots(config, cache);

    // Cache should be preserved for the unreachable host
    const entry = result.cache.roots["ssh://alice@devbox.corp/home/alice/projects"];
    expect(entry?.projects).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("devbox.corp");
  });
});

// ─── Fuzzy search — sshHost searchable (AC10) ────────────────────────────────

describe("fuzzySearch — remote projects searchable by hostname", () => {
  it("finds remote project by hostname fragment (AC10)", async () => {
    const { fuzzySearch } = await import("@/core/search.js");
    const projects = [
      {
        name: "api-service",
        path: "ssh://alice@devbox.corp/home/alice/projects/api-service",
        type: "nodejs" as const,
        openCommand: "code",
        terminalApp: false,
        profile: "",
        description: "",
        tags: [],
        hasDevProject: false,
        isRemote: true as const,
        sshHost: "alice@devbox.corp",
        remotePath: "/home/alice/projects/api-service",
      },
      {
        name: "local-app",
        path: "/home/user/projects/local-app",
        type: "nodejs" as const,
        openCommand: "code",
        terminalApp: false,
        profile: "",
        description: "",
        tags: [],
        hasDevProject: false,
      },
    ];
    const results = fuzzySearch(projects, "devbox");
    expect(results.some((p) => p.name === "api-service")).toBe(true);
  });
});
