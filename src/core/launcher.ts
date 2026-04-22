import { spawn } from "node:child_process";
import type { Project } from "../types.js";

export function openProject(project: Project, overrideIde?: string): void {
  const ide = overrideIde ?? project.ide;
  const args = project.profile ? ["--profile", project.profile, project.path] : [project.path];
  spawn(ide, args, { detached: true, stdio: "ignore" }).unref();
}
