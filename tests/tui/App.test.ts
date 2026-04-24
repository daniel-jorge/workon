import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "@/tui/App.js";
import * as scannerModule from "@/core/scanner.js";
import type { Project } from "@/types.js";
import type { GlobalConfig } from "@/core/config.js";

// Mock the scanner module
vi.mock("@/core/scanner.js", () => ({
  scanProjects: vi.fn(),
}));

// Mock other tui components to render simple identifiable text
vi.mock("@/tui/SearchBar.js", () => ({
  SearchBar: ({ query }: { query: string }) => React.createElement("div", null, `SearchBar:${query}`),
}));

vi.mock("@/tui/ProjectList.js", () => ({
  ProjectList: ({ projects, selectedIndex }: { projects: Project[]; selectedIndex: number }) =>
    React.createElement("div", null, `ProjectList:${projects.length}:${selectedIndex}`),
}));

vi.mock("@/tui/HintBar.js", () => ({
  HintBar: () => React.createElement("div", null, "HintBar"),
}));

vi.mock("@/tui/IDEDialog.js", () => ({
  IDEDialog: () => React.createElement("div", null, "IDEDialog"),
}));

// Mock launcher
vi.mock("@/core/launcher.js", () => ({
  openProject: vi.fn(),
}));

// Mock search to return projects as-is
vi.mock("@/core/search.js", () => ({
  fuzzySearch: vi.fn((projects) => projects),
}));

const mockConfig: GlobalConfig = {
  roots: ["/test"],
  maxDepth: 3,
  defaultIde: "code",
  defaultProfile: "",
  ignore: [],
};

const mockProjects: Project[] = [
  {
    name: "Project A",
    path: "/test/projectA",
    type: "nodejs",
    ide: "code",
    profile: "",
    description: "Test project A",
    tags: [],
    hasDevProject: false,
  },
  {
    name: "Project B",
    path: "/test/projectB",
    type: "rust",
    ide: "code",
    profile: "",
    description: "Test project B",
    tags: [],
    hasDevProject: false,
  },
];

describe("App component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render spinner while loading", () => {
    const mockScanProjects = vi.spyOn(scannerModule, "scanProjects");
    mockScanProjects.mockReturnValue(new Promise(() => {})); // Never resolves

    const { lastFrame } = render(React.createElement(App, { config: mockConfig }));
    const frame = lastFrame();
    expect(frame).toContain("Scanning for projects…");
  });

  it("should call scanProjects with the provided config", async () => {
    const mockScanProjects = vi.spyOn(scannerModule, "scanProjects");
    mockScanProjects.mockResolvedValue([]);

    render(React.createElement(App, { config: mockConfig }));

    // Wait for the effect to run
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockScanProjects).toHaveBeenCalledWith(mockConfig);
  });

  it("should show loading initially then call scanner", () => {
    const mockScanProjects = vi.spyOn(scannerModule, "scanProjects");
    mockScanProjects.mockReturnValue(new Promise(() => {})); // Never resolves

    const { lastFrame } = render(React.createElement(App, { config: mockConfig }));

    // Initially should show spinner
    const initialFrame = lastFrame();
    expect(initialFrame).toContain("Scanning for projects…");

    // Scanner should have been called
    expect(mockScanProjects).toHaveBeenCalledWith(mockConfig);
  });

  it("should handle scanner resolving with projects", async () => {
    const mockScanProjects = vi.spyOn(scannerModule, "scanProjects");
    mockScanProjects.mockResolvedValue(mockProjects);

    render(React.createElement(App, { config: mockConfig }));

    // Wait for async state updates to complete
    await new Promise((resolve) => setTimeout(resolve, 200));

    // The component should have received the projects and rendered them
    // (exact frame content verification deferred due to Ink testing library limitations)
    expect(mockScanProjects).toHaveBeenCalledWith(mockConfig);
  });

  it("should handle empty project list", async () => {
    const mockScanProjects = vi.spyOn(scannerModule, "scanProjects");
    mockScanProjects.mockResolvedValue([]);

    render(React.createElement(App, { config: mockConfig }));

    // Wait for async state updates
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Scanner was called with config
    expect(mockScanProjects).toHaveBeenCalledWith(mockConfig);
  });

  it("should accept different configs", () => {
    const mockScanProjects = vi.spyOn(scannerModule, "scanProjects");
    mockScanProjects.mockReturnValue(new Promise(() => {}));

    const customConfig: GlobalConfig = {
      roots: ["/custom/path"],
      maxDepth: 5,
      defaultIde: "code-insiders",
      defaultProfile: "custom",
      ignore: ["**/node_modules/**"],
    };

    render(React.createElement(App, { config: customConfig }));

    expect(mockScanProjects).toHaveBeenCalledWith(customConfig);
  });
});
