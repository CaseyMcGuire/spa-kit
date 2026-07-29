import type { LoaderFunction } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSpaRoutingBrowserRouter } from "./createSpaRoutingBrowserRouter.js";

function loaderArgs(url: string, params: Record<string, string> = {}) {
  return { request: new Request(url), params, context: {} } as never;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createSpaRoutingBrowserRouter", () => {
  it("creates a router whose leaves are gated through the spa-routing decision endpoint", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ statusCode: 200 })));
    const inner = vi.fn(() => ({ data: 1 }));

    const router = createSpaRoutingBrowserRouter(
      [{ id: "AssetDetail", path: "/assets/:id", loader: inner }],
      { applicationId: "app", onError: { type: "redirect", location: "/500" } },
    );
    try {
      const loader = router.routes[0]!.loader as LoaderFunction;

      await expect(
        loader(loaderArgs("http://localhost/assets/123", { id: "123" }), {}),
      ).resolves.toEqual({ data: 1 });

      const url = String(fetchSpy.mock.calls[0]![0]);
      expect(url).toContain("applicationId=app");
      expect(url).toContain("routeId=AssetDetail");
      expect(url).toContain("parameters.id=123");
    } finally {
      router.dispose();
    }
  });

  it("applies onError as a document redirect when the decision request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { assign } });
    const router = createSpaRoutingBrowserRouter([{ id: "Assets", path: "/assets" }], {
      applicationId: "app",
      onError: { type: "redirect", location: "/500" },
    });
    try {
      const loader = router.routes[0]!.loader as LoaderFunction;

      const outcome = await Promise.race([
        Promise.resolve(loader(loaderArgs("http://localhost/assets"), {})).then(() => "settled"),
        new Promise((r) => setTimeout(() => r("pending"), 30)),
      ]);

      expect(outcome).toBe("pending");
      expect(assign).toHaveBeenCalledWith("/500");
    } finally {
      router.dispose();
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });

  it("forwards endpoint, redirect mode, and browser router options", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ statusCode: 302, location: "/login" })),
      );
    const originalPath = window.location.pathname;
    window.history.replaceState(null, "", "/app/");

    const router = createSpaRoutingBrowserRouter(
      [{ id: "Assets", path: "/assets" }],
      {
        applicationId: "app",
        endpoint: "/custom/route-decision",
        onError: { type: "redirect", location: "/500" },
        routeAuthorizationOptions: { redirectMode: "router" },
        routerOptions: { basename: "/app" },
      },
    );

    try {
      expect(router.basename).toBe("/app");
      const loader = router.routes[0]!.loader as LoaderFunction;
      const thrown = await Promise.resolve(
        loader(loaderArgs("http://localhost/app/assets"), {}),
      ).catch((error: unknown) => error);

      expect(thrown).toBeInstanceOf(Response);
      expect((thrown as Response).headers.get("Location")).toBe("/login");
      expect(String(fetchSpy.mock.calls[0]![0])).toContain(
        "/custom/route-decision?",
      );
    } finally {
      router.dispose();
      window.history.replaceState(null, "", originalPath);
    }
  });
});
