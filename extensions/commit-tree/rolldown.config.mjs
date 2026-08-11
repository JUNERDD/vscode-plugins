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
      // Let Shiki language modules split naturally. Broad dependency chunks can
      // introduce circular ESM modules while Pierre renders highlighted lines.
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
