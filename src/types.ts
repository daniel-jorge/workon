export type ProjectType = "nodejs" | "rust" | "go" | "python" | "java" | "dotnet" | "generic";

export interface Project {
  name: string;
  path: string;
  type: ProjectType;
  ide: "code" | "code-insiders";
  profile: string;
  description: string;
  tags: string[];
  hasDevProject: boolean;
}
