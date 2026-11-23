import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    env: { NODE_ENV: "test", AUTH_SECRET: "test-secret-that-is-at-least-32-characters-long", ADMIN_TOKEN: "test-admin-token-1234567890abcd" },
    fileParallelism: false,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
