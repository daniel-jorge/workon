import { describe, it, expect, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { guessProjectMetadata, extractReadmeFirstLine } from "../src/core/metadata.js";

const tempDir = join(process.cwd(), ".test-temp");

function createTempDir(name: string): string {
  const dir = join(tempDir, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(): void {
  try {
    rmSync(tempDir, { recursive: true });
  } catch {
    // Ignore
  }
}

describe("metadata - Node.js parser", () => {
  afterEach(cleanup);

  it("should parse package.json with name and description", () => {
    const dir = createTempDir("nodejs-full");
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "my-project",
        description: "A great project",
      }),
    );

    const metadata = guessProjectMetadata(dir, "nodejs");
    expect(metadata.name).toBe("my-project");
    expect(metadata.description).toBe("A great project");
  });

  it("should parse package.json with only name", () => {
    const dir = createTempDir("nodejs-name-only");
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "my-project",
      }),
    );

    const metadata = guessProjectMetadata(dir, "nodejs");
    expect(metadata.name).toBe("my-project");
    expect(metadata.description).toBeUndefined();
  });

  it("should fallback to README if description missing", () => {
    const dir = createTempDir("nodejs-readme-fallback");
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "my-project",
      }),
    );
    writeFileSync(join(dir, "README.md"), "This is my project\n\nMore details here");

    const metadata = guessProjectMetadata(dir, "nodejs");
    expect(metadata.name).toBe("my-project");
    expect(metadata.description).toBe("This is my project");
  });

  it("should fallback to basename if name missing", () => {
    const dir = createTempDir("nodejs-basename");
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        description: "A great project",
      }),
    );

    const metadata = guessProjectMetadata(dir, "nodejs");
    expect(metadata.name).toBe("nodejs-basename");
    expect(metadata.description).toBe("A great project");
  });
});

describe("metadata - Rust parser", () => {
  afterEach(cleanup);

  it("should parse Cargo.toml with name and description", () => {
    const dir = createTempDir("rust-full");
    writeFileSync(
      join(dir, "Cargo.toml"),
      `[package]
name = "my-rust-project"
description = "A Rust library"
`,
    );

    const metadata = guessProjectMetadata(dir, "rust");
    expect(metadata.name).toBe("my-rust-project");
    expect(metadata.description).toBe("A Rust library");
  });

  it("should parse Cargo.toml with only name", () => {
    const dir = createTempDir("rust-name-only");
    writeFileSync(
      join(dir, "Cargo.toml"),
      `[package]
name = "my-rust-project"
`,
    );

    const metadata = guessProjectMetadata(dir, "rust");
    expect(metadata.name).toBe("my-rust-project");
    expect(metadata.description).toBeUndefined();
  });

  it("should handle single quotes in Cargo.toml", () => {
    const dir = createTempDir("rust-single-quotes");
    writeFileSync(
      join(dir, "Cargo.toml"),
      `[package]
name = 'my-rust-project'
description = 'A Rust library'
`,
    );

    const metadata = guessProjectMetadata(dir, "rust");
    expect(metadata.name).toBe("my-rust-project");
    expect(metadata.description).toBe("A Rust library");
  });
});

describe("metadata - Python parser", () => {
  afterEach(cleanup);

  it("should parse pyproject.toml with name and description", () => {
    const dir = createTempDir("python-pyproject");
    writeFileSync(
      join(dir, "pyproject.toml"),
      `[project]
name = "my-python-project"
description = "A Python package"
`,
    );

    const metadata = guessProjectMetadata(dir, "python");
    expect(metadata.name).toBe("my-python-project");
    expect(metadata.description).toBe("A Python package");
  });

  it("should parse setup.py with name and description", () => {
    const dir = createTempDir("python-setup");
    writeFileSync(
      join(dir, "setup.py"),
      `setup(
    name="my-python-project",
    description="A Python package",
)`,
    );

    const metadata = guessProjectMetadata(dir, "python");
    expect(metadata.name).toBe("my-python-project");
    expect(metadata.description).toBe("A Python package");
  });

  it("should prefer pyproject.toml over setup.py", () => {
    const dir = createTempDir("python-both");
    writeFileSync(
      join(dir, "pyproject.toml"),
      `[project]
name = "from-pyproject"
`,
    );
    writeFileSync(
      join(dir, "setup.py"),
      `setup(
    name="from-setup",
)`,
    );

    const metadata = guessProjectMetadata(dir, "python");
    expect(metadata.name).toBe("from-pyproject");
  });
});

describe("metadata - Go parser", () => {
  afterEach(cleanup);

  it("should parse go.mod for module name", () => {
    const dir = createTempDir("go-project");
    writeFileSync(
      join(dir, "go.mod"),
      `module github.com/user/my-go-project

go 1.18
`,
    );

    const metadata = guessProjectMetadata(dir, "go");
    expect(metadata.name).toBe("github.com/user/my-go-project");
    expect(metadata.description).toBeUndefined();
  });

  it("should handle go.mod with version", () => {
    const dir = createTempDir("go-project-v2");
    writeFileSync(
      join(dir, "go.mod"),
      `module github.com/user/my-go-project/v2

go 1.18
`,
    );

    const metadata = guessProjectMetadata(dir, "go");
    expect(metadata.name).toBe("github.com/user/my-go-project/v2");
  });
});

describe("metadata - Java parser", () => {
  afterEach(cleanup);

  it("should parse pom.xml for artifactId and description", () => {
    const dir = createTempDir("java-project");
    writeFileSync(
      join(dir, "pom.xml"),
      `<project>
  <artifactId>my-java-project</artifactId>
  <description>A Java project</description>
</project>
`,
    );

    const metadata = guessProjectMetadata(dir, "java");
    expect(metadata.name).toBe("my-java-project");
    expect(metadata.description).toBe("A Java project");
  });

  it("should handle pom.xml without description", () => {
    const dir = createTempDir("java-project-no-desc");
    writeFileSync(
      join(dir, "pom.xml"),
      `<project>
  <artifactId>my-java-project</artifactId>
</project>
`,
    );

    const metadata = guessProjectMetadata(dir, "java");
    expect(metadata.name).toBe("my-java-project");
    expect(metadata.description).toBeUndefined();
  });
});

describe("metadata - .NET parser", () => {
  afterEach(cleanup);

  it("should parse .csproj for AssemblyName and AssemblyDescription", () => {
    const dir = createTempDir("dotnet-project");
    writeFileSync(
      join(dir, "MyProject.csproj"),
      `<Project>
  <PropertyGroup>
    <AssemblyName>my-dotnet-project</AssemblyName>
    <AssemblyDescription>A .NET project</AssemblyDescription>
  </PropertyGroup>
</Project>
`,
    );

    const metadata = guessProjectMetadata(dir, "dotnet");
    expect(metadata.name).toBe("my-dotnet-project");
    expect(metadata.description).toBe("A .NET project");
  });

  it("should handle .csproj without description", () => {
    const dir = createTempDir("dotnet-project-no-desc");
    writeFileSync(
      join(dir, "MyProject.csproj"),
      `<Project>
  <PropertyGroup>
    <AssemblyName>my-dotnet-project</AssemblyName>
  </PropertyGroup>
</Project>
`,
    );

    const metadata = guessProjectMetadata(dir, "dotnet");
    expect(metadata.name).toBe("my-dotnet-project");
    expect(metadata.description).toBeUndefined();
  });
});

describe("metadata - README extraction", () => {
  afterEach(cleanup);

  it("should extract first non-empty line from README", () => {
    const dir = createTempDir("readme-normal");
    writeFileSync(
      join(dir, "README.md"),
      `# My Project

This is a great project.`,
    );

    const result = extractReadmeFirstLine(dir);
    expect(result).toBe("My Project");
  });

  it("should skip empty lines and extract first content", () => {
    const dir = createTempDir("readme-empty-lines");
    writeFileSync(
      join(dir, "README.md"),
      `

# My Project

This is a great project.`,
    );

    const result = extractReadmeFirstLine(dir);
    expect(result).toBe("My Project");
  });

  it("should truncate long lines at 100 chars with ellipsis", () => {
    const dir = createTempDir("readme-long");
    const longLine = "A".repeat(150);
    writeFileSync(join(dir, "README.md"), longLine);

    const result = extractReadmeFirstLine(dir);
    expect(result).toBeDefined();
    expect(result!.length).toBeLessThanOrEqual(101); // 100 chars + ellipsis
    expect(result).toContain("…");
  });

  it("should truncate at word boundary before 100 chars", () => {
    const dir = createTempDir("readme-word-boundary");
    // Create a line that's definitely longer than 100 chars with clear word boundary
    const line = "A".repeat(60) + " " + "B".repeat(60);
    writeFileSync(join(dir, "README.md"), line);

    const result = extractReadmeFirstLine(dir);
    expect(result).toBeDefined();
    expect(result!.endsWith("…")).toBe(true);
    // Should be truncated at the space between A's and B's, not in the middle
    expect(result!).not.toContain("B");
  });

  it("should return null if README doesn't exist", () => {
    const dir = createTempDir("no-readme");
    const result = extractReadmeFirstLine(dir);
    expect(result).toBeNull();
  });

  it("should return null if README is empty", () => {
    const dir = createTempDir("empty-readme");
    writeFileSync(join(dir, "README.md"), "");
    const result = extractReadmeFirstLine(dir);
    expect(result).toBeNull();
  });

  it("should return null if README has only whitespace", () => {
    const dir = createTempDir("whitespace-readme");
    writeFileSync(join(dir, "README.md"), "\n\n   \n");
    const result = extractReadmeFirstLine(dir);
    expect(result).toBeNull();
  });

  it("should strip leading markdown headers", () => {
    const dir = createTempDir("readme-headers");
    writeFileSync(
      join(dir, "README.md"),
      `### My Cool Project

Description here`,
    );

    const result = extractReadmeFirstLine(dir);
    expect(result).toBe("My Cool Project");
  });
});

describe("metadata - Integration tests", () => {
  afterEach(cleanup);

  it("should use fixture directory structure", () => {
    const dir = createTempDir("integration-full");
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "integration-test",
        description: "Full test",
      }),
    );
    writeFileSync(join(dir, "README.md"), "Backup description");

    const metadata = guessProjectMetadata(dir, "nodejs");
    expect(metadata.name).toBe("integration-test");
    expect(metadata.description).toBe("Full test");
  });

  it("should use README as fallback when manifest lacks description", () => {
    const dir = createTempDir("integration-readme-fallback");
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "integration-test",
      }),
    );
    writeFileSync(join(dir, "README.md"), "README description here");

    const metadata = guessProjectMetadata(dir, "nodejs");
    expect(metadata.name).toBe("integration-test");
    expect(metadata.description).toBe("README description here");
  });

  it("should use basename when all else fails", () => {
    const dir = createTempDir("integration-basename");
    writeFileSync(join(dir, "package.json"), JSON.stringify({}));

    const metadata = guessProjectMetadata(dir, "nodejs");
    expect(metadata.name).toBe("integration-basename");
    expect(metadata.description).toBeUndefined();
  });

  it("should handle generic projects", () => {
    const dir = createTempDir("integration-generic");
    writeFileSync(join(dir, "README.md"), "Generic project");

    const metadata = guessProjectMetadata(dir, "generic");
    expect(metadata.name).toBe("integration-generic");
    expect(metadata.description).toBe("Generic project");
  });

  it("should handle missing manifest gracefully", () => {
    const dir = createTempDir("integration-no-manifest");

    const metadata = guessProjectMetadata(dir, "nodejs");
    expect(metadata.name).toBe("integration-no-manifest");
    expect(metadata.description).toBeUndefined();
  });
});
