#!/usr/bin/env node
import { program } from "commander";
import { readFileSync } from "node:fs";
import { listCommand } from "@/commands/list.js";
import { openCommand } from "@/commands/open.js";
import { initCommand } from "@/commands/init.js";
import { registerConfigCommand } from "@/commands/config.js";
import { registerPinCommand } from "@/commands/pin.js";
import { tuiCommand } from "@/commands/tui.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8")) as {
  version: string;
};

program
  .name("workon")
  .description("Find and open your projects quickly")
  .version(pkg.version)
  .action(tuiCommand);

program.command("open <query>").description("Open a project by name").action(openCommand);

program.command("list").description("List all discovered projects").action(listCommand);

program
  .command("init")
  .description("Create a .workonrc.json file in the current directory")
  .action(initCommand);

registerConfigCommand(program);
registerPinCommand(program);

await program.parseAsync();
