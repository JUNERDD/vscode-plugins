/** @type {import("rolldown").RolldownOptions} */
const config = {
  input: "src/extension.ts",
  external: ["vscode"],
  output: {
    file: "dist/extension.js",
    format: "cjs",
    sourcemap: true,
  },
  platform: "node",
  treeshake: true,
};

export default config;
