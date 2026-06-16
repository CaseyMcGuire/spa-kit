import type { LoaderFunction, RouteObject } from "react-router";
import { describe, expect, it, vi } from "vitest";
import {
  withRouteAuthorization,
  type RouteAuthorizationResolver,
} from "./withRouteAuthorization.js";

function loaderArgs(url: string, params: Record<string, string> = {}) {
  return { request: new Request(url), params, context: {} } as never;
}

function firstLoader(wrapped: RouteObject[]): LoaderFunction {
  return wrapped[0]!.loader as LoaderFunction;
}

const allow: RouteAuthorizationResolver = () => ({ type: "allow" });

describe("withRouteAuthorization", () => {
  it("calls resolve with the matched route and allows on an allow decision", async () => {
    const resolve = vi.fn(allow);
    const wrapped = withRouteAuthorization([{ id: "Assets", path: "/assets" }], resolve);
    await expect(firstLoader(wrapped)(loaderArgs("http://localhost/assets"), {})).resolves.toBeNull();
    expect(resolve).toHaveBeenCalledWith(
      expect.objectContaining({ route: expect.objectContaining({ id: "Assets" }), params: {} }),
    );
  });

  it("passes the matched params through to resolve", async () => {
    const resolve = vi.fn(allow);
    const wrapped = withRouteAuthorization([{ id: "AssetDetail", path: "/assets/:id" }], resolve);
    await firstLoader(wrapped)(loaderArgs("http://localhost/assets/123", { id: "123" }), {});
    expect(resolve).toHaveBeenCalledWith(
      expect.objectContaining({
        route: expect.objectContaining({ id: "AssetDetail" }),
        params: { id: "123" },
      }),
    );
  });

  it("throws a React Router redirect in router mode", async () => {
    const resolve: RouteAuthorizationResolver = () => ({ type: "redirect", location: "/login" });
    const wrapped = withRouteAuthorization([{ id: "Assets", path: "/assets" }], resolve, {
      redirectMode: "router",
    });
    const thrown = await Promise.resolve(
      firstLoader(wrapped)(loaderArgs("http://localhost/assets"), {}),
    ).catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(302);
    expect((thrown as Response).headers.get("Location")).toBe("/login");
  });

  it("navigates the document and never settles in document mode (default)", async () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { assign } });
    try {
      const resolve: RouteAuthorizationResolver = () => ({ type: "redirect", location: "/login" });
      const wrapped = withRouteAuthorization([{ id: "Assets", path: "/assets" }], resolve);

      const result = Promise.resolve(firstLoader(wrapped)(loaderArgs("http://localhost/assets"), {}));
      const outcome = await Promise.race([
        result.then(() => "settled"),
        new Promise((r) => setTimeout(() => r("pending"), 30)),
      ]);

      expect(outcome).toBe("pending");
      expect(assign).toHaveBeenCalledWith("/login");
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });

  it("composes with the leaf's own loader, running it once allowed", async () => {
    const inner = vi.fn((args: { request: Request }) => ({ url: args.request.url }));
    const wrapped = withRouteAuthorization([{ id: "Home", path: "/", loader: inner }], allow);
    await expect(firstLoader(wrapped)(loaderArgs("http://localhost/"), {})).resolves.toEqual({
      url: "http://localhost/",
    });
    expect(inner).toHaveBeenCalledOnce();
  });

  it("does not run the leaf's own loader when denied", async () => {
    const inner = vi.fn(() => ({ data: 1 }));
    const resolve: RouteAuthorizationResolver = () => ({ type: "redirect", location: "/login" });
    const wrapped = withRouteAuthorization([{ id: "Home", path: "/", loader: inner }], resolve, {
      redirectMode: "router",
    });
    await Promise.resolve(firstLoader(wrapped)(loaderArgs("http://localhost/"), {})).catch(
      () => undefined,
    );
    expect(inner).not.toHaveBeenCalled();
  });

  it("checks every leaf (even one without an id — the resolver decides)", async () => {
    const resolve = vi.fn(allow);
    const wrapped = withRouteAuthorization([{ path: "/public" }], resolve);
    await firstLoader(wrapped)(loaderArgs("http://localhost/public"), {});
    expect(resolve).toHaveBeenCalledWith(
      expect.objectContaining({ route: expect.objectContaining({ path: "/public" }) }),
    );
  });

  it("gates the leaf, not its parent, on a nested tree", async () => {
    const resolve = vi.fn(allow);
    const routes: RouteObject[] = [
      {
        id: "Dashboard",
        path: "/dashboard",
        children: [{ id: "DashboardSettings", path: "settings" }],
      },
    ];
    const wrapped = withRouteAuthorization(routes, resolve);

    // The parent has children, so it keeps its own (here: no) loader; the leaf is gated.
    expect(wrapped[0]!.loader).toBeUndefined();
    const leafLoader = wrapped[0]!.children![0]!.loader as LoaderFunction;

    await leafLoader(loaderArgs("http://localhost/dashboard/settings"), {});
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith(
      expect.objectContaining({ route: expect.objectContaining({ id: "DashboardSettings" }) }),
    );
  });
});
