import type { Command } from "commander";
import { loadConfig, saveConfig } from "../core/config.js";

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
    .command("set-ide <ide>")
    .description("Set the default IDE (code or code-insiders)")
    .action((ide: string) => {
      const cfg = loadConfig();
      if (ide !== "code" && ide !== "code-insiders") {
        console.error('IDE must be "code" or "code-insiders"');
        process.exit(1);
      }
      cfg.defaultIde = ide as "code" | "code-insiders";
      saveConfig(cfg);
      console.log(`Default IDE set to: ${ide}`);
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
}
