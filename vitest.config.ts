import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["demo/**", "demo-workspaces/**", "node_modules/**"],
  },
});
