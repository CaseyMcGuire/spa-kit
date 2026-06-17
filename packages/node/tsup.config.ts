import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/bin/compileRelay.ts"],
  format: ["esm", "cjs"],
  dts: { entry: "src/index.ts" },
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ["graphql", "@graphql-tools/schema"],
});