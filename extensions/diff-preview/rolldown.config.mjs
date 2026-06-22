const productionDefine = {
  "process.env.NODE_ENV": JSON.stringify("production"),
};

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
      // Keep Shiki language modules naturally split; broad node_modules grouping can
      // create circular ESM chunks that fail while rendering highlighted diff lines.
      dir: "dist/webview",
      entryFileNames: "main.js",
      format: "esm",
      sourcemap: true,
    },
    platform: "browser",
    treeshake: true,
    transform: {
      define: productionDefine,
    },
  },
];

export default config;
