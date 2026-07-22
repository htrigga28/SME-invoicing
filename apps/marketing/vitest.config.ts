import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  esbuild: {
    jsxInject: 'import React from "react";'
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src")
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"]
  }
});
