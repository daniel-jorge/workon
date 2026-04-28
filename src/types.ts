export type ProjectType = "nodejs" | "rust" | "go" | "python" | "java" | "dotnet" | "generic";

export interface OpenCommand {
  name: string;
  command: string;
}

export interface Project {
  name: string;
  path: string;
  type: ProjectType;
  openCommand: string;
  profile: string;
  description: string;
  tags: string[];
  hasDevProject: boolean;
  missing?: boolean;
}
