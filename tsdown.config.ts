import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node18",
  unbundle: false,
  minify: false,
  clean: true,
  outDir: "dist",
});
