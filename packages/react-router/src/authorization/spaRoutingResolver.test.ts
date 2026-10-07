import type { RouteObject } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { spaRoutingResolver } from "./spaRoutingResolver.js";

const route: RouteObject = { id: "AssetDetail", path: "/assets/:id" };
const callArgs = {
  route,
  params: { id: "123" },
  request: new Request("http://localhost/assets/123"),
};

const onError = { type: "allowed" } as const;

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
      .mockResolvedValue(new Response(JSON.stringify({ type: "allowed" })));

    const decision = await spaRoutingResolver({ applicationId: "app", onError })(callArgs);

    expect(decision).toEqual({ type: "allowed" });
    const url = String(fetchSpy.mock.calls[0]![0]);
    expect(url).toContain("/__spa/route-decision?");
    expect(url).toContain("applicationId=app");
    expect(url).toContain("routeId=AssetDetail");
    expect(url).toContain("parameters.id=123");
  });

  it.each(["denied", "unknown_route", "invalid_request"])("redirects a %s decision even with an allow fallback", async (type) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ type, destination: "/login" })),
    );
    await expect(spaRoutingResolver({ applicationId: "app", onError })(callArgs)).resolves.toEqual({
      type,
      destination: "/login",
    });
  });

  it("forwards repeated, empty, and encoded query values without colliding with route metadata", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ type: "allowed" })),
    );
    const request = new Request(
      "http://localhost/assets/123?tag=one&tag=&q=a+b%2B%26%E9%9B%AA&applicationId=other&parameters.id=other",
    );

    await spaRoutingResolver({ applicationId: "app", onError })({ ...callArgs, request });

    const query = new URL(String(fetchSpy.mock.calls[0]![0]), "http://localhost").searchParams;
    expect(query.getAll("queryString.tag")).toEqual(["one", ""]);
    expect(query.get("queryString.q")).toBe("a b+&雪");
    expect(query.get("queryString.applicationId")).toBe("other");
    expect(query.get("queryString.parameters.id")).toBe("other");
    expect(query.get("applicationId")).toBe("app");
    expect(query.get("routeId")).toBe("AssetDetail");
    expect(query.get("parameters.id")).toBe("123");
    expect(fetchSpy.mock.calls[0]![1]?.signal).toBe(request.signal);
  });

  it("allows a semantic decision with a redirect fallback", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ type: "allowed" })),
    );
    await expect(spaRoutingResolver({
      applicationId: "app", onError: { type: "denied", destination: "/error" },
    })(callArgs)).resolves.toEqual({ type: "allowed" });
  });

  it.each([
    null, [], "allowed", {}, { type: "allow" }, { type: "unknown" },
    { statusCode: 200 }, { statusCode: 302, location: "/login" },
    ...["denied", "unknown_route", "invalid_request"].flatMap((type) =>
      [undefined, null, "", "   ", 123, {}].map((destination) => ({ type, destination }))),
  ].map((body) => [body]))("returns onError for a malformed or legacy decision: %j", async (body) => {
    const fallback = { type: "denied", destination: "/error" } as const;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body)));
    await expect(spaRoutingResolver({ applicationId: "app", onError: fallback })(callArgs))
      .resolves.toEqual(fallback);
  });

  it("throws when the route has no id", async () => {
    const idless = { ...callArgs, route: { path: "/oops" } as RouteObject };
    await expect(
      spaRoutingResolver({ applicationId: "app", onError })(idless),
    ).rejects.toThrow(/no `id`/);
  });

  it("returns onError for a non-2xx response even when its body is valid JSON", async () => {
    const onErrorRedirect = { type: "denied", destination: "/error" } as const;
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
        onError: { type: "denied", destination: "/error" },
      })(aborted),
    ).rejects.toBe(abortError);
  });

  it("returns the onError decision when the request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));

    await expect(
      spaRoutingResolver({ applicationId: "app", onError: { type: "allowed" } })(callArgs),
    ).resolves.toEqual({ type: "allowed" });

    await expect(
      spaRoutingResolver({
        applicationId: "app",
        onError: { type: "denied", destination: "/login" },
      })(callArgs),
    ).resolves.toEqual({ type: "denied", destination: "/login" });
  });
});
