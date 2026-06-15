import { execSync } from "node:child_process";
import fs from "node:fs";
import { dirname } from "node:path";

import { getGraphqlSchema } from "./getGraphqlSchema.js";

export interface CompileRelayOptions {
  /** Directory of split `*.graphql` files to combine. */
  schemaDirectory: string;
  /**
   * Where the combined schema is written — must match the `schema` path in your
   * `relay.config`. Written transiently and removed afterward (see `cleanup`).
   */
  schemaOutputFile: string;
  /**
   * Command that runs the Relay compiler. Run bare, `relay-compiler` reads your
   * `relay.config`; override for variants like `relay-compiler --validate`.
   * @default "relay-compiler"
   */
  command?: string;
  /**
   * Delete the written schema file when done (compile succeeds or fails).
   * @default true
   */
  cleanup?: boolean;
}

/**
 * Combine your split `*.graphql` files into a single schema, run the Relay
 * compiler against it, then remove the transient schema file.
 *
 * Throws if the compiler exits non-zero, so a broken schema fails your build
 * (and CI) loudly rather than silently. `relay-compiler` must be runnable on
 * the current `PATH` (typically by invoking this from an npm script).
 *
 * @example
 * compileRelay({
 *   schemaDirectory: "src/main/resources/schema",
 *   schemaOutputFile: "src/main/resources/relay/schema.graphql",
 * });
 */
export function compileRelay(options: CompileRelayOptions): void {
  const {
    schemaDirectory,
    schemaOutputFile,
    command = "relay-compiler",
    cleanup = true,
  } = options;

  try {
    fs.mkdirSync(dirname(schemaOutputFile), { recursive: true });
    fs.writeFileSync(schemaOutputFile, getGraphqlSchema(schemaDirectory));
    execSync(command, { stdio: "inherit" });
  } finally {
    if (cleanup && fs.existsSync(schemaOutputFile)) {
      fs.unlinkSync(schemaOutputFile);
    }
  }
}