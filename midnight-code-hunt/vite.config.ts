import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@sentinel/skeleton-core": fileURLToPath(
        new URL("../packages/skeleton-core/src/index.ts", import.meta.url),
      ),
    },
  },
  build: {
    modulePreload: { polyfill: false },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["test/support/setup.ts"],
    include: [
      "src/**/*.test.{ts,tsx}",
      "test/**/*.test.{ts,tsx}",
      "scripts/**/*.test.ts",
    ],
  },
});
