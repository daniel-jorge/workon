import { execa } from "execa";
import type { Project } from "@/types.js";

const VSCODE_COMMANDS = new Set(["code", "code-insiders"]);

export async function openProject(project: Project, overrideOpenCommand?: string): Promise<void> {
  const openCommand = overrideOpenCommand ?? project.openCommand;

  // FR8 — Remote-aware VS Code launch
  if (project.isRemote) {
    if (!VSCODE_COMMANDS.has(openCommand)) {
      throw new Error("Remote projects can only be opened with VS Code or VS Code Insiders.");
    }
    const args = ["--remote", `ssh-remote+${project.sshHost!}`, project.remotePath!];
    await execa(openCommand, args, { detached: true, stdio: "ignore" });
    return;
  }

  const args = project.profile ? ["--profile", project.profile, project.path] : [project.path];
  if (project.terminalApp) {
    await execa(openCommand, args, { stdio: "inherit" });
  } else {
    await execa(openCommand, args, { detached: true, stdio: "ignore" });
  }
}
