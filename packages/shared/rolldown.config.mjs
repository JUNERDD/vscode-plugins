/** @type {import("rolldown").RolldownOptions} */
const config = {
  input: "src/index.ts",
  output: {
    dir: "dist",
    entryFileNames: "[name].js",
    format: "esm",
    sourcemap: true,
  },
  platform: "neutral",
  treeshake: true,
};

export default config;
