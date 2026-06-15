import fs from "node:fs";
import { join } from "node:path";

import { makeExecutableSchema } from "@graphql-tools/schema";
// Import from the main `graphql` entry (not `graphql/utilities`) so we share the
// same module instance as @graphql-tools/schema — mixing them triggers
// graphql's "Duplicate graphql modules" / "from another realm" error.
import { printSchema } from "graphql";

function collectGraphqlFiles(directory: string, files: string[]): void {
  for (const entry of fs.readdirSync(directory)) {
    const path = join(directory, entry);
    if (fs.lstatSync(path).isFile()) {
      if (entry.endsWith(".graphql")) {
        files.push(path);
      }
    } else {
      collectGraphqlFiles(path, files);
    }
  }
}

/**
 * Recursively combine every `*.graphql` file under `schemaDirectory` into a
 * single printed schema (SDL).
 *
 * Tools like DGS let you split a schema across many files; Relay's compiler
 * expects a single schema, so this glues them back together for Relay.
 *
 * @param schemaDirectory Absolute path to the root of your `.graphql` files.
 * @returns The combined schema as an SDL string.
 *
 * @example
 * import { fileURLToPath } from "node:url";
 * const dir = fileURLToPath(new URL("./schema", import.meta.url));
 * const sdl = getGraphqlSchema(dir);
 */
export function getGraphqlSchema(schemaDirectory: string): string {
  const files: string[] = [];
  collectGraphqlFiles(schemaDirectory, files);
  const schema = makeExecutableSchema({
    typeDefs: files.map((file) => fs.readFileSync(file, "utf8")),
  });
  return printSchema(schema);
}