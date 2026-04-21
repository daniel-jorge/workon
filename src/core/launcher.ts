import { spawn } from "node:child_process";
import type { Project } from "../types.js";

export function openProject(project: Project): void {
  const args = project.profile ? ["--profile", project.profile, project.path] : [project.path];
  spawn(project.ide, args, { detached: true, stdio: "ignore" }).unref();
}
