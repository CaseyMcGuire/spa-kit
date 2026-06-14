import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react({
      // Compile StyleX in tests the same way a consuming app would.
      // `runtimeInjection` makes the generated CSS apply inside jsdom.
      babel: {
        plugins: [["@stylexjs/babel-plugin", { dev: true, runtimeInjection: true }]],
      },
    }),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["packages/*/src/**/*.{test,spec}.{ts,tsx}"],
  },
});
