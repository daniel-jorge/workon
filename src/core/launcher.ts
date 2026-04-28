import { execa } from "execa";
import type { Project } from "@/types.js";

export async function openProject(project: Project, overrideOpenCommand?: string): Promise<void> {
  const openCommand = overrideOpenCommand ?? project.openCommand;
  const args = project.profile ? ["--profile", project.profile, project.path] : [project.path];
  await execa(openCommand, args, { detached: true, stdio: "ignore" });
}
