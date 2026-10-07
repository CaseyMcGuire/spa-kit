import type { ESLint } from "eslint";
import { name, version } from "../package.json";
import { requirePreloadContext } from "./rules/requirePreloadContext.js";

/** Opt-in ESLint rules for spa-kit consumers. */
const plugin: ESLint.Plugin = {
  meta: { name, version },
  rules: {
    "require-preload-context": requirePreloadContext,
  },
};

export default plugin;
