// @vitest-environment node
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getGraphqlSchema } from "./getGraphqlSchema.js";

const schemaDir = fileURLToPath(new URL("./__fixtures__/schema", import.meta.url));

describe("getGraphqlSchema", () => {
  it("combines .graphql files across nested directories", () => {
    const sdl = getGraphqlSchema(schemaDir);
    expect(sdl).toContain("type Query");
    expect(sdl).toContain("hello: String");
    // `User` lives in a nested directory, proving the recursive walk works.
    expect(sdl).toContain("type User");
    expect(sdl).toContain("name: String");
  });

  it("ignores non-.graphql files", () => {
    // ignore.txt sits alongside the schema; reading it as SDL would throw.
    expect(() => getGraphqlSchema(schemaDir)).not.toThrow();
  });
});