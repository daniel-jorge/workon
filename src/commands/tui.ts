import { createElement } from "react";
import { render } from "ink";
import { loadConfig } from "@/core/config.js";
import { scanProjects } from "@/core/scanner.js";
import { App } from "@/tui/App.js";

export async function tuiCommand(): Promise<void> {
  const config = loadConfig();
  const projects = await scanProjects(config);
  render(createElement(App, { projects }));
}
