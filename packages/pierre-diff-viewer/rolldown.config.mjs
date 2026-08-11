/** @type {import("rolldown").RolldownOptions} */
const config = {
  input: "src/index.ts",
  external: ["@pierre/diffs"],
  output: {
    dir: "dist",
    entryFileNames: "[name].js",
    format: "esm",
    sourcemap: true,
  },
  platform: "browser",
  treeshake: true,
};

export default config;
