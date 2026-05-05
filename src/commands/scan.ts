/**
 * FR5 — workon scan / workon scan --remote
 *
 * Rescans project roots and updates the remote cache.
 */
import type { Command } from "commander";
import { loadConfig } from "@/core/config.js";
import { scanProjects } from "@/core/scanner.js";
import { loadRemoteCache, saveRemoteCache } from "@/core/remote-cache.js";
import { scanRemoteRoots } from "@/core/remote-scan.js";

export function registerScanCommand(program: Command): void {
  program
    .command("scan")
    .description("Rescan project roots and refresh remote cache")
    .option("--remote", "Rescan only remote roots (skip local scan)")
    .addHelpText(
      "after",
      "\nExamples:\n  workon scan            # rescan local + remote\n  workon scan --remote   # rescan remote roots only",
    )
    .action(async (opts: { remote?: boolean }) => {
      const config = loadConfig();

      if (!opts.remote) {
        // Full local scan (runs implicitly on each workon invocation anyway)
        console.log("Scanning local roots...");
        const localProjects = await scanProjects({ ...config, remoteRoots: [] });
        const localCount = localProjects.filter((p) => !p.isRemote).length;
        console.log(`Found ${localCount} local project${localCount === 1 ? "" : "s"}`);
      }

      if (config.remoteRoots.length === 0) {
        if (opts.remote) {
          console.log("No remote roots configured. Add one with: workon config add-remote-root");
        }
        return;
      }

      const { cache } = loadRemoteCache();
      const { cache: updatedCache, errors } = await scanRemoteRoots(config, cache);

      // Report results per host
      for (const uri of config.remoteRoots) {
        const entry = updatedCache.roots[uri];
        if (entry) {
          const hostname = uri.split("@")[1]?.split("/")[0] ?? uri;
          console.log(`Found ${entry.projects.length} projects on ${hostname}`);
        }
      }

      // Report errors (AC8 — host unreachable warnings)
      for (const error of errors) {
        console.warn(error);
      }

      saveRemoteCache(updatedCache);

      // Exit code 0 even with warnings (AC8)
      if (errors.length > 0 && errors.length === config.remoteRoots.length) {
        // All hosts failed and no scan succeeded at all
        process.exit(1);
      }
    });
}
