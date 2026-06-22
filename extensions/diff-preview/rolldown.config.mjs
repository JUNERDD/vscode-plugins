/** @type {import("rolldown").RolldownOptions[]} */
const config = [
  {
    input: "src/extension.ts",
    external: ["vscode"],
    output: {
      file: "dist/extension.js",
      format: "cjs",
      sourcemap: true,
    },
    platform: "node",
    treeshake: true,
  },
  {
    input: "src/webview/main.ts",
    output: {
      chunkFileNames: "chunks/[name]-[hash].js",
      dir: "dist/webview",
      entryFileNames: "main.js",
      format: "esm",
      sourcemap: true,
    },
    platform: "browser",
    treeshake: true,
  },
];

export default config;
