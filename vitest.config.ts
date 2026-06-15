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
  // Ensure a single `graphql` instance — mixing realms throws
  // "Duplicate graphql modules cannot be used at the same time".
  resolve: {
    dedupe: ["graphql"],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["packages/*/src/**/*.{test,spec}.{ts,tsx}"],
    server: {
      deps: {
        // Inline the whole graphql ecosystem (graphql + every @graphql-tools/*)
        // through one pipeline so they share a single graphql realm.
        inline: [/graphql/],
      },
    },
  },
});
