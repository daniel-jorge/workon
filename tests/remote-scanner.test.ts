import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("execa");

describe("parseRemoteScanOutput", () => {
  it("parses a single NDJSON line into a CachedRemoteProject", async () => {
    const { parseRemoteScanOutput } = await import("@/core/remote-scan.js");
    const line = JSON.stringify({
      path: "/home/alice/projects/api-service",
      marker: "package.json",
      config: null,
    });
    const { projects, warnings } = parseRemoteScanOutput(
      line + "\n",
      "alice@devbox.corp",
      "/home/alice/projects",
    );
    expect(projects).toHaveLength(1);
    expect(projects[0]?.name).toBe("api-service");
    expect(projects[0]?.remotePath).toBe("/home/alice/projects/api-service");
    expect(projects[0]?.type).toBe("nodejs");
    expect(projects[0]?.sshHost).toBe("alice@devbox.corp");
    expect(warnings).toHaveLength(0);
  });

  it("parses multiple project lines", async () => {
    const { parseRemoteScanOutput } = await import("@/core/remote-scan.js");
    const lines = [
      JSON.stringify({ path: "/projects/api", marker: "package.json", config: null }),
      JSON.stringify({ path: "/projects/frontend", marker: "package.json", config: null }),
    ].join("\n");
    const { projects } = parseRemoteScanOutput(lines, "alice@devbox.corp", "/projects");
    expect(projects).toHaveLength(2);
  });

  it("applies .workonrc.json overrides from remote config field (AC14)", async () => {
    const { parseRemoteScanOutput } = await import("@/core/remote-scan.js");
    const workonrc = JSON.stringify({
      name: "API Service",
      description: "Core API layer",
      openCommand: "code-insiders",
      tags: ["backend", "api"],
    });
    const line = JSON.stringify({
      path: "/home/alice/projects/api-service",
      marker: "package.json",
      config: workonrc,
    });
    const { projects, warnings } = parseRemoteScanOutput(
      line + "\n",
      "alice@devbox.corp",
      "/home/alice/projects",
    );
    expect(projects[0]?.name).toBe("API Service");
    expect(projects[0]?.description).toBe("Core API layer");
    expect(projects[0]?.openCommand).toBe("code-insiders");
    expect(projects[0]?.tags).toEqual(["backend", "api"]);
    expect(warnings).toHaveLength(0);
  });

  it("includes project with defaults and emits warning for malformed .workonrc.json (EC7)", async () => {
    const { parseRemoteScanOutput } = await import("@/core/remote-scan.js");
    const line = JSON.stringify({
      path: "/home/alice/projects/bad-config-app",
      marker: "package.json",
      config: "not-valid-json{{{",
    });
    const { projects, warnings } = parseRemoteScanOutput(
      line + "\n",
      "alice@devbox.corp",
      "/home/alice/projects",
    );
    expect(projects).toHaveLength(1);
    expect(projects[0]?.name).toBe("bad-config-app");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("bad-config-app");
    expect(warnings[0]).toContain("devbox.corp");
    expect(warnings[0]).toContain("defaults");
  });

  it("returns empty arrays for empty output", async () => {
    const { parseRemoteScanOutput } = await import("@/core/remote-scan.js");
    const { projects, warnings } = parseRemoteScanOutput(
      "",
      "alice@devbox.corp",
      "/home/alice/projects",
    );
    expect(projects).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it("skips blank lines gracefully", async () => {
    const { parseRemoteScanOutput } = await import("@/core/remote-scan.js");
    const output =
      "\n" +
      JSON.stringify({ path: "/projects/api", marker: "package.json", config: null }) +
      "\n\n";
    const { projects } = parseRemoteScanOutput(output, "alice@devbox.corp", "/projects");
    expect(projects).toHaveLength(1);
  });

  it.each([
    ["Cargo.toml", "rust"],
    ["go.mod", "go"],
    ["requirements.txt", "python"],
    ["pom.xml", "java"],
    ["package.json", "nodejs"],
    ["build.gradle", "java"],
  ] as const)("detects project type %s → %s", async (marker, expectedType) => {
    const { parseRemoteScanOutput } = await import("@/core/remote-scan.js");
    const line = JSON.stringify({
      path: "/home/alice/projects/proj",
      marker,
      config: null,
    });
    const { projects } = parseRemoteScanOutput(line, "alice@devbox.corp", "/home/alice/projects");
    expect(projects[0]?.type).toBe(expectedType);
  });
});

describe("buildRemoteScanScript", () => {
  it("includes root path and maxdepth in the find command", async () => {
    const { buildRemoteScanScript } = await import("@/core/remote-scan.js");
    const script = buildRemoteScanScript("/home/alice/projects", 3, []);
    expect(script).toContain("/home/alice/projects");
    expect(script).toContain("3");
    expect(script).toContain("find");
  });

  it("includes prune clauses for ignore patterns", async () => {
    const { buildRemoteScanScript } = await import("@/core/remote-scan.js");
    const script = buildRemoteScanScript("/home/alice/projects", 3, ["**/node_modules/**"]);
    expect(script).toContain("node_modules");
    expect(script).toContain("prune");
  });

  it("includes all marker file names", async () => {
    const { buildRemoteScanScript } = await import("@/core/remote-scan.js");
    const script = buildRemoteScanScript("/home/alice/projects", 3, []);
    expect(script).toContain("package.json");
    expect(script).toContain("Cargo.toml");
    expect(script).toContain("go.mod");
    expect(script).toContain("requirements.txt");
  });

  it("includes .workonrc.json read logic", async () => {
    const { buildRemoteScanScript } = await import("@/core/remote-scan.js");
    const script = buildRemoteScanScript("/home/alice/projects", 3, []);
    expect(script).toContain(".workonrc.json");
  });
});

// FR3, AC7, AC8 — scanRemoteRoot (SSH mocked)
describe("scanRemoteRoot", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns parsed projects on successful SSH execution (AC7)", async () => {
    const execaMod = await import("execa");
    const projectLine = JSON.stringify({
      path: "/home/alice/projects/api-service",
      marker: "package.json",
      config: null,
    });
    vi.mocked(execaMod.execa).mockResolvedValue({
      stdout: projectLine + "\n",
      stderr: "",
      exitCode: 0,
    } as never);

    const { scanRemoteRoot } = await import("@/core/remote-scan.js");
    const config = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code",
      openCommands: [],
      defaultProfile: "",
      ignore: [],
      pinned: [],
      remoteRoots: [],
    };
    const result = await scanRemoteRoot("ssh://alice@devbox.corp/home/alice/projects", config);
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]?.name).toBe("api-service");
    expect(result.error).toBeUndefined();
  });

  it("returns error string when SSH connection fails (EC1)", async () => {
    const execaMod = await import("execa");
    vi.mocked(execaMod.execa).mockRejectedValue(new Error("Connection refused"));

    const { scanRemoteRoot } = await import("@/core/remote-scan.js");
    const config = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code",
      openCommands: [],
      defaultProfile: "",
      ignore: [],
      pinned: [],
      remoteRoots: [],
    };
    const result = await scanRemoteRoot("ssh://alice@devbox.corp/home/alice/projects", config);
    expect(result.projects).toHaveLength(0);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/Connection refused/i);
  });

  it("calls ssh with the correct host (alice@devbox.corp)", async () => {
    const execaMod = await import("execa");
    vi.mocked(execaMod.execa).mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
    } as never);

    const { scanRemoteRoot } = await import("@/core/remote-scan.js");
    const config = {
      roots: [],
      maxDepth: 3,
      defaultOpenCommand: "code",
      openCommands: [],
      defaultProfile: "",
      ignore: [],
      pinned: [],
      remoteRoots: [],
    };
    await scanRemoteRoot("ssh://alice@devbox.corp/home/alice/projects", config);
    expect(execaMod.execa).toHaveBeenCalledWith(
      "ssh",
      expect.arrayContaining(["alice@devbox.corp"]),
      expect.any(Object),
    );
  });
});
