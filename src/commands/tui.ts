import { createElement } from "react";
import { render } from "ink";
import { loadConfig } from "@/core/config.js";
import { App } from "@/tui/App.js";

export async function tuiCommand(): Promise<void> {
  const config = loadConfig();
  render(createElement(App, { config }));
}
