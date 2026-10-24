import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      include: ["src/tests/**/*.test.{ts,tsx}"],
      setupFiles: ["./src/tests/setup.ts"],
      globals: false,
      clearMocks: true,
      restoreMocks: true,
      env: {
        NODE_ENV: "test",
      },
    },
  }),
);
