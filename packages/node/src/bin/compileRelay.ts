#!/usr/bin/env node
import { parseArgs } from "node:util";

import { compileRelay } from "../compileRelay.js";

const USAGE =
  "Usage: spa-kit-compile-relay --schema-dir <dir> --out <file> [--command <cmd>] [--no-cleanup]";

const { values } = parseArgs({
  options: {
    "schema-dir": { type: "string" },
    out: { type: "string" },
    command: { type: "string" },
    "no-cleanup": { type: "boolean" },
  },
});

const schemaDirectory = values["schema-dir"];
const schemaOutputFile = values.out;

if (schemaDirectory == null || schemaOutputFile == null) {
  console.error(USAGE);
  process.exit(1);
}

try {
  compileRelay({
    schemaDirectory,
    schemaOutputFile,
    command: values.command,
    cleanup: !values["no-cleanup"],
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}