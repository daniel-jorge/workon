import { describe, it, expect } from "vitest";

// FR1 — URI validation and normalization
describe("validateAndNormalizeSSHUri", () => {
  it("accepts a valid SSH URI unchanged", async () => {
    const { validateAndNormalizeSSHUri } = await import("@/core/remote-uri.js");
    expect(validateAndNormalizeSSHUri("ssh://alice@devbox.corp/home/alice/projects")).toBe(
      "ssh://alice@devbox.corp/home/alice/projects",
    );
  });

  it("normalises hostname to lowercase (AC Scenario: URI hostname normalised)", async () => {
    const { validateAndNormalizeSSHUri } = await import("@/core/remote-uri.js");
    expect(validateAndNormalizeSSHUri("ssh://alice@DevBox.Corp/home/alice/projects")).toBe(
      "ssh://alice@devbox.corp/home/alice/projects",
    );
  });

  it("strips trailing slash from path component", async () => {
    const { validateAndNormalizeSSHUri } = await import("@/core/remote-uri.js");
    expect(validateAndNormalizeSSHUri("ssh://alice@devbox.corp/home/alice/projects/")).toBe(
      "ssh://alice@devbox.corp/home/alice/projects",
    );
  });

  it("normalises hostname AND strips trailing slash together (EC3)", async () => {
    const { validateAndNormalizeSSHUri } = await import("@/core/remote-uri.js");
    expect(validateAndNormalizeSSHUri("ssh://alice@DevBox.Corp/home/alice/projects/")).toBe(
      "ssh://alice@devbox.corp/home/alice/projects",
    );
  });

  it("accepts path with multiple segments", async () => {
    const { validateAndNormalizeSSHUri } = await import("@/core/remote-uri.js");
    expect(validateAndNormalizeSSHUri("ssh://bob@buildbox.internal/home/bob/work/projects")).toBe(
      "ssh://bob@buildbox.internal/home/bob/work/projects",
    );
  });

  // AC2 — invalid URI cases
  it.each([
    ["http://alice@devbox.corp/home/alice/projects", "wrong scheme (not ssh://)"],
    ["ssh://devbox.corp/home/alice/projects", "missing user component"],
    ["ssh://alice@devbox.corp/", "path is only a bare slash (no real path)"],
    ["ssh://alice@/home/alice/projects", "missing hostname"],
    ["not-a-uri", "not a URI at all"],
  ] as const)("rejects invalid URI %s (%s) with exit code 1 behavior", async (uri) => {
    const { validateAndNormalizeSSHUri } = await import("@/core/remote-uri.js");
    expect(() => validateAndNormalizeSSHUri(uri)).toThrow();
  });

  it("error message for wrong scheme mentions scheme", async () => {
    const { validateAndNormalizeSSHUri } = await import("@/core/remote-uri.js");
    expect(() =>
      validateAndNormalizeSSHUri("http://alice@devbox.corp/home/alice/projects"),
    ).toThrow(/ssh/i);
  });

  it("error message for missing user mentions user", async () => {
    const { validateAndNormalizeSSHUri } = await import("@/core/remote-uri.js");
    expect(() => validateAndNormalizeSSHUri("ssh://devbox.corp/home/alice/projects")).toThrow(
      /user/i,
    );
  });

  it("error message for path-only-slash mentions path", async () => {
    const { validateAndNormalizeSSHUri } = await import("@/core/remote-uri.js");
    expect(() => validateAndNormalizeSSHUri("ssh://alice@devbox.corp/")).toThrow(/path/i);
  });
});

// FR1 — URI parsing
describe("parseSSHUri", () => {
  it("returns parsed components for a valid URI", async () => {
    const { parseSSHUri } = await import("@/core/remote-uri.js");
    const result = parseSSHUri("ssh://alice@devbox.corp/home/alice/projects");
    expect(result).toMatchObject({
      user: "alice",
      hostname: "devbox.corp",
      path: "/home/alice/projects",
      sshHost: "alice@devbox.corp",
      normalizedUri: "ssh://alice@devbox.corp/home/alice/projects",
    });
  });

  it("lowercases hostname in normalizedUri and sshHost", async () => {
    const { parseSSHUri } = await import("@/core/remote-uri.js");
    const result = parseSSHUri("ssh://alice@DevBox.Corp/home/alice/projects");
    expect(result.hostname).toBe("devbox.corp");
    expect(result.sshHost).toBe("alice@devbox.corp");
    expect(result.normalizedUri).toBe("ssh://alice@devbox.corp/home/alice/projects");
  });

  it("strips trailing slash from path in parsed result", async () => {
    const { parseSSHUri } = await import("@/core/remote-uri.js");
    const result = parseSSHUri("ssh://alice@devbox.corp/home/alice/projects/");
    expect(result.path).toBe("/home/alice/projects");
  });

  it("constructs normalizedUri from user@host/path", async () => {
    const { parseSSHUri } = await import("@/core/remote-uri.js");
    const result = parseSSHUri("ssh://bob@buildbox.internal/home/bob/work");
    expect(result.normalizedUri).toBe("ssh://bob@buildbox.internal/home/bob/work");
    expect(result.sshHost).toBe("bob@buildbox.internal");
  });
});
