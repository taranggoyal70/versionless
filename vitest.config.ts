import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    include: ["src/**/*.test.ts", "action/**/*.test.mjs"],
    exclude: ["demo/**", "demo-workspaces/**", "node_modules/**"],
  },
});
