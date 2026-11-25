import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    target: "es2020",
    platform: "neutral",
    treeshake: true,
  },
  {
    // one file for <script> tags and the demo page: window.unbaht
    entry: { "unbaht.global": "src/index.ts" },
    format: ["iife"],
    globalName: "unbaht",
    minify: true,
    target: "es2020",
    platform: "browser",
    outExtension: () => ({ js: ".js" }),
  },
]);
