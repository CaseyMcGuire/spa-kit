import { RecordSource, Store } from "relay-runtime";
import { Environment } from "relay-runtime";
import { describe, expect, it } from "vitest";
import { createRelayEnvironment } from "./createRelayEnvironment.js";

describe("createRelayEnvironment", () => {
  it("returns a configured Relay Environment with defaults", () => {
    const env = createRelayEnvironment();
    expect(env).toBeInstanceOf(Environment);
    expect(env.getNetwork()).toBeDefined();
    expect(env.getStore()).toBeDefined();
  });

  it("accepts a custom endpoint and headers", () => {
    const env = createRelayEnvironment({
      endpoint: "/api/graphql",
      headers: () => ({ "X-CSRF-Token": "abc123" }),
    });
    expect(env).toBeInstanceOf(Environment);
  });

  it("uses a prebuilt store when provided", () => {
    const store = new Store(new RecordSource());
    const env = createRelayEnvironment({ store });
    expect(env.getStore()).toBe(store);
  });

  it("uses the provided fetch implementation for queries", async () => {
    let calledWith: { url: string; init?: RequestInit } | undefined;
    const fakeFetch: typeof fetch = (url, init) => {
      calledWith = { url: String(url), init };
      return Promise.resolve(new Response(JSON.stringify({ data: { ok: true } })));
    };

    const env = createRelayEnvironment({
      endpoint: "/custom",
      credentials: "omit",
      fetch: fakeFetch,
    });

    await env
      .getNetwork()
      .execute(
        {
          id: null,
          cacheID: "Q",
          text: "query { ok }",
          name: "Q",
          operationKind: "query",
          metadata: {},
        },
        {},
        {},
      )
      .toPromise();

    expect(calledWith?.url).toBe("/custom");
    expect(calledWith?.init?.credentials).toBe("omit");
  });
});