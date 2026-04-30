import type { Command } from "commander";
import {
  loadConfig,
  saveConfig,
  addOpenCommand,
  removeOpenCommand,
  setDefaultOpenCommand,
  listOpenCommands,
  isExecutableInPath,
} from "@/core/config.js";
import { validatePinnedPaths } from "@/core/pinning.js";

export function registerConfigCommand(program: Command): void {
  const config = program.command("config").description("Manage configuration");

  config
    .command("show")
    .description("Print current configuration")
    .action(() => {
      const cfg = loadConfig();
      console.log(JSON.stringify(cfg, null, 2));
    });

  config
    .command("add-root <path>")
    .description("Add a root folder to scan")
    .action((rootPath: string) => {
      const cfg = loadConfig();
      if (!cfg.roots.includes(rootPath)) {
        cfg.roots.push(rootPath);
        saveConfig(cfg);
        console.log(`Added root: ${rootPath}`);
      } else {
        console.log(`Root already exists: ${rootPath}`);
      }
    });

  config
    .command("remove-root <path>")
    .description("Remove a root folder")
    .action((rootPath: string) => {
      const cfg = loadConfig();
      const index = cfg.roots.indexOf(rootPath);
      if (index !== -1) {
        cfg.roots.splice(index, 1);
        saveConfig(cfg);
        console.log(`Removed root: ${rootPath}`);
      } else {
        console.log(`Root not found: ${rootPath}`);
      }
    });

  config
    .command("set-ide <command>")
    .description("(deprecated: use set-default-command) Set the default open command")
    .action((command: string) => {
      const cfg = loadConfig();
      cfg.defaultOpenCommand = command;
      saveConfig(cfg);
      console.log(`Default open command set to: ${command}`);
    });

  config
    .command("add-command")
    .description("Add a new open command to the config")
    .requiredOption("--name <display-name>", "Display name for the command (e.g. Cursor)")
    .requiredOption("--command <executable>", "Executable to run (e.g. cursor)")
    .option("--terminal", "Mark as a terminal app (e.g. nvim, vim) — opens in the current TTY")
    .addHelpText(
      "after",
      '\nExample:\n  workon config add-command --name "Cursor" --command "cursor"\n  workon config add-command --name "Neovim" --command "nvim" --terminal',
    )
    .action(async (opts: { name: string; command: string; terminal?: boolean }) => {
      const cfg = loadConfig();
      let updated;
      try {
        updated = addOpenCommand(cfg, opts.name, opts.command, opts.terminal ?? false);
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
      if (!(await isExecutableInPath(opts.command))) {
        console.warn(
          `Warning: executable '${opts.command}' not found in $PATH (but will be added anyway)`,
        );
      }
      saveConfig(updated);
      console.log(`Added open command: ${opts.name} (${opts.command})`);
    });

  config
    .command("remove-command <command>")
    .description("Remove an open command from the config")
    .addHelpText("after", "\nExample:\n  workon config remove-command cursor")
    .action((command: string) => {
      const cfg = loadConfig();
      let result;
      try {
        result = removeOpenCommand(cfg, command);
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
      saveConfig(result.config);
      console.log(`Removed open command: ${command}`);
      if (result.promotedTo !== null) {
        console.log(`Default promoted to: ${result.promotedTo}`);
      }
      if (result.wasLast) {
        console.log("Warning: No commands remain in config");
      }
    });

  config
    .command("list-commands")
    .description("List all configured open commands")
    .addHelpText("after", "\nExample:\n  workon config list-commands")
    .action(() => {
      const cfg = loadConfig();
      const rows = listOpenCommands(cfg);
      const nameWidth = Math.max("Display Name".length, ...rows.map((r) => r.name.length));
      const cmdWidth = Math.max("Executable".length, ...rows.map((r) => r.command.length));
      console.log(
        `${"Display Name".padEnd(nameWidth)}  ${"Executable".padEnd(cmdWidth)}  Terminal  Default`,
      );
      for (const row of rows) {
        console.log(
          `${row.name.padEnd(nameWidth)}  ${row.command.padEnd(cmdWidth)}  ${(row.terminal ? "Y" : "N").padEnd(8)}  ${row.isDefault ? "Y" : "N"}`,
        );
      }
    });

  config
    .command("set-default-command [executable]")
    .description("Set the default open command")
    .addHelpText("after", "\nExample:\n  workon config set-default-command cursor")
    .action((executable: string | undefined) => {
      if (!executable) {
        console.error(
          "executable name is required\nExample: workon config set-default-command cursor",
        );
        process.exit(1);
      }
      const cfg = loadConfig();
      let updated;
      try {
        updated = setDefaultOpenCommand(cfg, executable);
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
      saveConfig(updated);
      console.log(`Set default open command to: ${executable}`);
    });

  config
    .command("set-profile <name>")
    .description("Set the default VS Code profile")
    .action((name: string) => {
      const cfg = loadConfig();
      cfg.defaultProfile = name;
      saveConfig(cfg);
      console.log(`Default profile set to: ${name}`);
    });

  config
    .command("set-depth <number>")
    .description("Set the maximum scan depth")
    .action((depth: string) => {
      const cfg = loadConfig();
      const n = parseInt(depth, 10);
      if (isNaN(n) || n < 1) {
        console.error("Depth must be a positive integer");
        process.exit(1);
      }
      cfg.maxDepth = n;
      saveConfig(cfg);
      console.log(`Max depth set to: ${n}`);
    });

  config
    .command("cleanup-pins")
    .description("Remove missing pinned project entries")
    .action(() => {
      const cfg = loadConfig();
      if (cfg.pinned.length === 0) {
        console.log("No pinned projects to clean up");
        return;
      }

      const { valid, invalid } = validatePinnedPaths(cfg.pinned);
      if (invalid.length === 0) {
        console.log("All pinned projects are valid");
        return;
      }

      console.log(`Found ${invalid.length} missing pin(s):`);
      invalid.forEach((path) => console.log(`  - ${path}`));

      cfg.pinned = valid;
      saveConfig(cfg);
      console.log(`✓ Removed ${invalid.length} missing pin(s)`);
    });
}
