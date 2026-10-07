import { transferableAbortController } from "node:util";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, redirect } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSpaRouter } from "./createSpaRouter.js";
import { WikiRoutes, SearchRoutes } from "./__fixtures__/routes.js";
import { createSpaRouteDecisionMiddleware } from "../authorization/createSpaRouteDecisionMiddleware.js";

const routes = {
  View: WikiRoutes.View,
  Index: { ...WikiRoutes.Index, hasAccessHandler: false },
};
const routers: ReturnType<typeof createSpaRouter>[] = [];
const auth = createSpaRouteDecisionMiddleware({ onError: { type: "denied", destination: "/wiki" }, redirectMode: "router" });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function mount(router: ReturnType<typeof createSpaRouter>) {
  routers.push(router);
  render(<RouterProvider router={router} />);
}
beforeEach(() => {
  vi.stubGlobal("AbortController", transferableAbortController().constructor);
  window.history.replaceState(null, "", "/wiki");
});
afterEach(() => {
  cleanup();
  routers.splice(0).forEach((router) => router.dispose());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("route preload", () => {
  it("starts alongside authorization, gates loaders, and does not await a promise preload", async () => {
    const decision = deferred<Response>();
    const data = deferred<{ title: string }>();
    const fetch = vi.spyOn(globalThis, "fetch").mockReturnValue(decision.promise);
    const loader = vi.fn(() => "loaded");
    const preload = vi.fn(() => data.promise);
    const view = vi.fn();
    const router = createSpaRouter(routes, {
      Index: { render: (context) => { expect(context).not.toHaveProperty("preload"); return "index"; } },
      View: {
        preload,
        loader,
        render: ({ preload, params }) => { view(preload); return `view ${params.wikiId}`; },
      },
    }, { sharedMiddleware: [auth] });
    mount(router);
    await screen.findByText("index");
    expect(fetch).not.toHaveBeenCalled();
    let navigation!: Promise<void>;
    await act(async () => { navigation = router.navigate("/wiki/42"); });
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(preload).toHaveBeenCalledOnce();
    expect(preload).toHaveBeenCalledWith({ params: { wikiId: "42" }, queryString: {} });
    expect(loader).not.toHaveBeenCalled();
    expect(view).not.toHaveBeenCalled();
    await act(async () => {
      decision.resolve(new Response(JSON.stringify({ type: "allowed" })));
      await navigation;
    });
    expect(screen.getByText("view 42")).toBeInTheDocument();
    expect(view).toHaveBeenCalledWith(data.promise);
    expect(loader).toHaveBeenCalledOnce();
  });

  it("preloads ungated routes without a decision and retains resources until replacement", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const first = { title: "first", dispose: vi.fn() };
    const second = { title: "second", dispose: vi.fn() };
    const preload = vi.fn(() => first).mockReturnValueOnce(first).mockReturnValueOnce(second);
    const router = createSpaRouter({ ...routes, View: { ...routes.View, hasAccessHandler: false } }, {
      Index: { render: () => "index" },
      View: { preload, render: ({ preload }) => preload.title },
    }, { sharedMiddleware: [auth] });
    mount(router);
    await screen.findByText("index");
    await act(() => router.navigate("/wiki/1"));
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(first.dispose).not.toHaveBeenCalled();
    await act(() => router.navigate("/wiki/2"));
    expect(screen.getByText("second")).toBeInTheDocument();
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(second.dispose).not.toHaveBeenCalled();
    await act(() => router.navigate("/wiki"));
    expect(second.dispose).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["denied", "unknown_route", "invalid_request"])("disposes a %s preload and redirects", async (type) => {
    const decision = deferred<Response>();
    vi.spyOn(globalThis, "fetch").mockReturnValue(decision.promise);
    const resource = { dispose: vi.fn() };
    const preload = vi.fn(() => resource);
    const loader = vi.fn();
    const router = createSpaRouter(routes, {
      Index: { render: () => "index" },
      View: { preload, loader, render: () => "view" },
    }, { sharedMiddleware: [auth] });
    mount(router);
    await screen.findByText("index");
    let navigation!: Promise<void>;
    await act(async () => { navigation = router.navigate("/wiki/42"); });
    await waitFor(() => expect(preload).toHaveBeenCalledOnce());
    await act(async () => {
      decision.resolve(new Response(JSON.stringify({ type, destination: "/wiki" })));
      await navigation;
    });
    expect(resource.dispose).toHaveBeenCalledOnce();
    expect(loader).not.toHaveBeenCalled();
    expect(screen.getByText("index")).toBeInTheDocument();
  });

  it("cleans up superseded preloads even when their promise resolves after abort", async () => {
    const decision = deferred<Response>();
    const data = deferred<{ dispose(): void }>();
    vi.spyOn(globalThis, "fetch").mockReturnValue(decision.promise);
    const preload = vi.fn(() => data.promise);
    const router = createSpaRouter(routes, {
      Index: { render: () => "index" },
      View: { preload, render: () => "view" },
    }, { sharedMiddleware: [auth] });
    mount(router);
    await screen.findByText("index");
    await act(async () => { void router.navigate("/wiki/42"); });
    await waitFor(() => expect(preload).toHaveBeenCalledOnce());
    await act(() => router.navigate("/wiki"));
    const dispose = vi.fn();
    await act(async () => {
      data.resolve({ dispose });
      decision.resolve(new Response(JSON.stringify({ type: "allowed" })));
    });
    expect(dispose).toHaveBeenCalledOnce();
    expect(screen.getByText("index")).toBeInTheDocument();
  });

  it("retains the visible resource during a pending replacement and disposes on shutdown", async () => {
    const first = { title: "first", dispose: vi.fn() };
    const second = { title: "second", dispose: vi.fn() };
    const decision = deferred<Response>();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ type: "allowed" })))
      .mockReturnValueOnce(decision.promise);
    const preload = vi.fn(() => first).mockReturnValueOnce(first).mockReturnValueOnce(second);
    const router = createSpaRouter(routes, {
      Index: { render: () => "index" },
      View: { preload, render: ({ preload }) => preload.title },
    }, { sharedMiddleware: [auth] });
    mount(router);
    await screen.findByText("index");
    await act(() => router.navigate("/wiki/1"));
    let navigation!: Promise<void>;
    await act(async () => { navigation = router.navigate("/wiki/2"); });
    await waitFor(() => expect(preload).toHaveBeenCalledTimes(2));
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(first.dispose).not.toHaveBeenCalled();
    await act(async () => {
      decision.resolve(new Response(JSON.stringify({ type: "allowed" })));
      await navigation;
    });
    expect(screen.getByText("second")).toBeInTheDocument();
    expect(first.dispose).toHaveBeenCalledOnce();
    router.dispose();
    expect(second.dispose).toHaveBeenCalledOnce();
  });

  it("preloads the initial route and repeats on query navigation without loader revalidation", async () => {
    window.history.replaceState(null, "", "/wiki/42?tab=first");
    const resources: { tab: string | undefined; dispose: ReturnType<typeof vi.fn> }[] = [];
    const loader = vi.fn(() => null);
    const router = createSpaRouter({ View: { ...routes.View, hasAccessHandler: false } }, {
      View: {
        preload: ({ queryString }) => {
          const resource = { tab: queryString.tab, dispose: vi.fn() };
          resources.push(resource);
          return resource;
        },
        loader,
        shouldRevalidate: () => false,
        render: ({ preload }) => preload.tab,
      },
    });
    mount(router);
    await screen.findByText("first");
    await act(() => router.navigate("/wiki/42?tab=second"));
    expect(screen.getByText("second")).toBeInTheDocument();
    expect(loader).toHaveBeenCalledOnce();
    expect(resources[0]!.dispose).toHaveBeenCalledOnce();
    expect(resources[1]!.dispose).not.toHaveBeenCalled();
  });

  it("disposes on loader redirects and router disposal", async () => {
    const resource = { dispose: vi.fn() };
    const router = createSpaRouter({ ...routes, View: { ...routes.View, hasAccessHandler: false } }, {
      Index: { render: () => "index" },
      View: { preload: () => resource, loader: () => redirect("/wiki"), render: () => "view" },
    }, { sharedMiddleware: [auth] });
    mount(router);
    await screen.findByText("index");
    await act(() => router.navigate("/wiki/42"));
    router.dispose();
    expect(resource.dispose).toHaveBeenCalledOnce();
  });
});

// Compile-only proof that callbacks infer each route's independent preload type.
function verifyPreloadTypes() {
  createSpaRouter({ ...WikiRoutes, ...SearchRoutes }, {
    Index: { render: (context) => {
      // @ts-expect-error Routes without preload have no preload property.
      context.preload;
      return "index";
    } },
    View: {
      preload: ({ params, queryString }) => {
        const id: string = params.wikiId;
        const tab: string | undefined = queryString.tab;
        return { kind: "wiki" as const, id, tab, dispose() {} };
      },
      render: ({ params, queryString, preload }) => {
        const kind: "wiki" = preload.kind;
        const id: string = params.wikiId;
        const tab: string | undefined = queryString.tab;
        // @ts-expect-error Another route's query reference is incompatible.
        const wrong: { kind: "search" } = preload;
        return id + kind + tab;
      },
    },
    Edit: { preload: () => 123, render: ({ preload }) => {
      const number: number = preload;
      // @ts-expect-error This route does not receive View's resource.
      preload.kind;
      return number;
    } },
    Search: {
      preload: ({ params, queryString }) => ({ kind: "search" as const, q: queryString.q, category: params.category }),
      render: ({ preload }) => {
        const kind: "search" = preload.kind;
        const q: string = preload.q;
        // @ts-expect-error Search's preload has no wiki id.
        preload.id;
        return kind + q;
      },
    },
  });
}
