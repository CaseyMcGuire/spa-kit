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

  it("throws when the route has no id", async () => {
    const idless = { ...callArgs, route: { path: "/oops" } as RouteObject };
    await expect(
      spaRoutingResolver({ applicationId: "app", onError })(idless),
    ).rejects.toThrow(/no `id`/);
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