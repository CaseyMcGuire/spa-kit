// @vitest-environment node
import { execSync } from "node:child_process";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { compileRelay } from "./compileRelay.js";

vi.mock("node:child_process", () => ({ execSync: vi.fn() }));

const schemaDir = fileURLToPath(new URL("./__fixtures__/schema", import.meta.url));
const workDir = join(tmpdir(), `spa-kit-relay-${process.pid}`);
const outputFile = join(workDir, "schema.graphql");

afterEach(() => {
  vi.mocked(execSync).mockReset();
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe("compileRelay", () => {
  it("writes the combined schema, runs relay-compiler, then cleans up", () => {
    let schemaPresentDuringCompile = false;
    vi.mocked(execSync).mockImplementation(() => {
      schemaPresentDuringCompile = fs.existsSync(outputFile);
      return Buffer.from("");
    });

    compileRelay({ schemaDirectory: schemaDir, schemaOutputFile: outputFile });

    expect(execSync).toHaveBeenCalledWith(
      "relay-compiler",
      expect.objectContaining({ stdio: "inherit" }),
    );
    expect(schemaPresentDuringCompile).toBe(true);
    expect(fs.existsSync(outputFile)).toBe(false);
  });

  it("uses a custom command when provided", () => {
    compileRelay({
      schemaDirectory: schemaDir,
      schemaOutputFile: outputFile,
      command: "relay-compiler --validate",
    });
    expect(execSync).toHaveBeenCalledWith("relay-compiler --validate", expect.anything());
  });

  it("cleans up even when compilation throws, and rethrows", () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("compile failed");
    });
    expect(() =>
      compileRelay({ schemaDirectory: schemaDir, schemaOutputFile: outputFile }),
    ).toThrow("compile failed");
    expect(fs.existsSync(outputFile)).toBe(false);
  });

  it("keeps the schema file when cleanup is false", () => {
    compileRelay({
      schemaDirectory: schemaDir,
      schemaOutputFile: outputFile,
      cleanup: false,
    });
    expect(fs.existsSync(outputFile)).toBe(true);
  });
});