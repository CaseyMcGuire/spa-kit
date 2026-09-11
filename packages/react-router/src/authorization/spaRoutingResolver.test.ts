import type { RouteObject } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { spaRoutingResolver } from "./spaRoutingResolver.js";

const route: RouteObject = { id: "AssetDetail", path: "/assets/:id" };
const callArgs = {
  route,
  params: { id: "123" },
  request: new Request("http://localhost/assets/123"),
};

const onError = { type: "allow" } as const;

// jsdom's AbortSignal and the Request global live in different realms, so an
// aborted signal can't be passed through RequestInit; shadow the getter instead.
function abortedRequest(url: string): Request {
  const request = new Request(url);
  Object.defineProperty(request, "signal", { value: { aborted: true } });
  return request;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("spaRoutingResolver", () => {
  it("queries the decision endpoint with applicationId, the route's id and params", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ statusCode: 200 })));

    const decision = await spaRoutingResolver({ applicationId: "app", onError })(callArgs);

    expect(decision).toEqual({ type: "allow" });
    const url = String(fetchSpy.mock.calls[0]![0]);
    expect(url).toContain("/__spa/route-decision?");
    expect(url).toContain("applicationId=app");
    expect(url).toContain("routeId=AssetDetail");
    expect(url).toContain("parameters.id=123");
  });

  it("maps a 3xx + location to a redirect decision", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 302, location: "/login" })),
    );
    await expect(spaRoutingResolver({ applicationId: "app", onError })(callArgs)).resolves.toEqual({
      type: "redirect",
      location: "/login",
    });
  });

  it.each([200, 204, 299])("allows a successful %i decision", async (statusCode) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ statusCode, location: null })),
    );

    await expect(
      spaRoutingResolver({
        applicationId: "app",
        onError: { type: "redirect", location: "/error" },
      })(callArgs),
    ).resolves.toEqual({ type: "allow" });
  });

  it.each([199, 400, 403, 404, 500, 600])(
    "returns onError for a %i decision inside an HTTP 200 response",
    async (statusCode) => {
      const fallback = { type: "redirect", location: "/error" } as const;
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ statusCode })),
      );

      await expect(
        spaRoutingResolver({ applicationId: "app", onError: fallback })(callArgs),
      ).resolves.toEqual(fallback);
    },
  );

  it.each([
    null,
    [],
    "allow",
    {},
    { location: "/login" },
    { statusCode: null },
    { statusCode: "200" },
    { statusCode: 200.5 },
    { statusCode: 200, location: 123 },
    { statusCode: 200, location: {} },
    { statusCode: "302", location: "/login" },
    { statusCode: 302.5, location: "/login" },
    { statusCode: 302 },
    { statusCode: 302, location: null },
    { statusCode: 302, location: "" },
    { statusCode: 302, location: "   " },
    { statusCode: 302, location: 123 },
    { statusCode: 302, location: {} },
  ].map((body) => [body]))("returns onError for a malformed decision: %j", async (body) => {
    const fallback = { type: "redirect", location: "/error" } as const;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body)));

    await expect(
      spaRoutingResolver({ applicationId: "app", onError: fallback })(callArgs),
    ).resolves.toEqual(fallback);
  });

  it("honors an explicit allow fallback for an unsuccessful decision", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 403 })),
    );

    await expect(spaRoutingResolver({ applicationId: "app", onError })(callArgs)).resolves.toEqual(
      onError,
    );
  });

  it("throws when the route has no id", async () => {
    const idless = { ...callArgs, route: { path: "/oops" } as RouteObject };
    await expect(
      spaRoutingResolver({ applicationId: "app", onError })(idless),
    ).rejects.toThrow(/no `id`/);
  });

  it("returns onError for a non-2xx response even when its body is valid JSON", async () => {
    const onErrorRedirect = { type: "redirect", location: "/error" } as const;
    const resolver = spaRoutingResolver({ applicationId: "app", onError: onErrorRedirect });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 500 }), { status: 500 }));

    await expect(resolver(callArgs)).resolves.toEqual(onErrorRedirect);
    await expect(resolver(callArgs)).resolves.toEqual(onErrorRedirect);
  });

  it("rethrows an aborted request instead of applying onError", async () => {
    const aborted = {
      ...callArgs,
      request: abortedRequest("http://localhost/assets/123"),
    };
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(abortError);

    await expect(
      spaRoutingResolver({
        applicationId: "app",
        onError: { type: "redirect", location: "/error" },
      })(aborted),
    ).rejects.toBe(abortError);
  });

  it("returns the onError decision when the request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));

    await expect(
      spaRoutingResolver({ applicationId: "app", onError: { type: "allow" } })(callArgs),
    ).resolves.toEqual({ type: "allow" });

    await expect(
      spaRoutingResolver({
        applicationId: "app",
        onError: { type: "redirect", location: "/login" },
      })(callArgs),
    ).resolves.toEqual({ type: "redirect", location: "/login" });
  });
});
