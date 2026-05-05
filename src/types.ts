export type ProjectType = "nodejs" | "rust" | "go" | "python" | "java" | "dotnet" | "generic";

export interface OpenCommand {
  name: string;
  command: string;
  terminal?: boolean;
}

export interface Project {
  name: string;
  path: string;
  type: ProjectType;
  openCommand: string;
  terminalApp: boolean;
  profile: string;
  description: string;
  tags: string[];
  hasDevProject: boolean;
  missing?: boolean;
  isRemote?: true;
  sshHost?: string;
  remotePath?: string;
}
