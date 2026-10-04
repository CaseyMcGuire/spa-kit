import { transferableAbortController } from "node:util";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterContextProvider, RouterProvider, useFetcher } from "react-router";
import type { MiddlewareFunction } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchRoutes, WikiRoutes } from "../routing/__fixtures__/routes.js";
import { createSpaRouter } from "../routing/createSpaRouter.js";
import { spaRouteContext } from "../routing/spaRouteContext.js";
import type { SpaRouteIdentity } from "../routing/spaRouteContext.js";
import { createSpaRouteAuthorization } from "./createSpaRouteAuthorization.js";

const routers: ReturnType<typeof createMemoryRouter>[] = [];
const onError = { type: "redirect", location: "/error" } as const;

beforeEach(() => {
  // Use the same AbortSignal implementation as Node's Request and fetch.
  vi.stubGlobal("AbortController", transferableAbortController().constructor);
});

afterEach(() => {
  cleanup();
  routers.splice(0).forEach((router) => router.dispose());
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function decision(statusCode: number, location?: string) {
  return new Response(JSON.stringify({ statusCode, location }));
}

function middlewareArgs(
  request = new Request("http://localhost/wiki/42?tab=history"),
  params: Record<string, string | undefined> = { wikiId: "42" },
  route: SpaRouteIdentity | null = WikiRoutes.View,
): Parameters<MiddlewareFunction>[0] {
  const context = new RouterContextProvider();
  context.set(spaRouteContext, route);
  return {
    request,
    params,
    context,
    url: new URL(request.url),
    pattern: WikiRoutes.View.path,
  };
}

function mountRouter(router: ReturnType<typeof createSpaRouter>) {
  routers.push(router);
  render(<RouterProvider router={router} />);
}

describe("createSpaRouteAuthorization", () => {
  it("reads each matched identity and forwards the endpoint, parameters, and abort signal", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => decision(200));
    const middleware = createSpaRouteAuthorization({ endpoint: "/custom/decision", onError });
    const args = middlewareArgs(undefined, { wikiId: "雪%2F", optional: undefined });
    const next = vi.fn(async () => {});

    await middleware(args, next);
    await middleware(middlewareArgs(new Request("http://localhost/search?q=hi"), {}, SearchRoutes.Search), next);

    const firstUrl = new URL(String(fetchSpy.mock.calls[0]![0]), "http://localhost");
    expect(firstUrl.pathname).toBe("/custom/decision");
    expect(firstUrl.searchParams.get("applicationId")).toBe("wiki");
    expect(firstUrl.searchParams.get("routeId")).toBe("View");
    expect(firstUrl.searchParams.get("parameters.wikiId")).toBe("雪%2F");
    expect(firstUrl.searchParams.has("parameters.optional")).toBe(false);
    expect(firstUrl.searchParams.get("queryString.tab")).toBe("history");
    expect(fetchSpy.mock.calls[0]![1]?.signal).toBe(args.request.signal);
    const secondUrl = new URL(String(fetchSpy.mock.calls[1]![0]), "http://localhost");
    expect(secondUrl.searchParams.get("applicationId")).toBe("search");
    expect(secondUrl.searchParams.get("routeId")).toBe("Search");
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("rejects missing route identity even when the endpoint fallback allows access", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const middleware = createSpaRouteAuthorization({ onError: { type: "allow" } });
    const next = vi.fn(async () => {});

    await expect(middleware(middlewareArgs(undefined, {}, null), next))
      .rejects.toThrow("missing route identity");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it.each([undefined, "router"] as const)("throws a native redirect with redirectMode=%s", async (redirectMode) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(decision(302, "/login"));
    const middleware = createSpaRouteAuthorization({ onError, redirectMode });
    const next = vi.fn(async () => {});

    const error = await Promise.resolve(middleware(middlewareArgs(), next)).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(Response);
    const response = error as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login");
    expect(response.headers.has("X-Remix-Reload-Document")).toBe(redirectMode !== "router");
    expect(next).not.toHaveBeenCalled();
  });

  it.each(["network", "denial", "malformed"])("applies the required fallback for %s failures", async (failure) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    switch (failure) {
      case "network":
        fetchSpy.mockRejectedValue(new Error("network unavailable"));
        break;
      case "denial":
        fetchSpy.mockImplementation(async () => decision(403));
        break;
      case "malformed":
        fetchSpy.mockImplementation(async () => new Response("not JSON"));
        break;
    }
    const next = vi.fn(async () => {});
    const middleware = createSpaRouteAuthorization({ onError });

    const error = await Promise.resolve(middleware(middlewareArgs(), next)).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(Response);
    expect((error as Response).headers.get("Location")).toBe("/error");
    expect(next).not.toHaveBeenCalled();

    const allowOnError = createSpaRouteAuthorization({ onError: { type: "allow" } });
    await allowOnError(middlewareArgs(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("does not treat downstream errors as authorization failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(decision(200));
    const failure = new Error("loader failed");
    const next = vi.fn().mockRejectedValue(failure);
    const middleware = createSpaRouteAuthorization({ onError });

    await expect(middleware(middlewareArgs(), next)).rejects.toBe(failure);
    expect(next).toHaveBeenCalledOnce();
  });

  it.each([200, 302])("discards a late %i decision after cancellation", async (statusCode) => {
    let respond!: (response: Response) => void;
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((resolve) => { respond = resolve; }));
    const controller = new AbortController();
    const request = new Request("http://localhost/wiki/42", { signal: controller.signal });
    const next = vi.fn(async () => {});
    const middleware = createSpaRouteAuthorization({ onError });
    const pending = middleware(middlewareArgs(request), next);

    controller.abort();
    respond(decision(statusCode, "/login"));

    await expect(pending).rejects.toBe(request.signal.reason);
    expect(next).not.toHaveBeenCalled();
  });

  it("does not request authorization when already aborted", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const controller = new AbortController();
    controller.abort();
    const request = new Request("http://localhost/wiki/42", { signal: controller.signal });
    const middleware = createSpaRouteAuthorization({ onError });
    const next = vi.fn(async () => {});

    await expect(middleware(middlewareArgs(request), next)).rejects.toBe(request.signal.reason);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("waits for authorization before downstream middleware, loaders, and rendering", async () => {
    window.history.replaceState(null, "", "/wiki/42?tab=history");
    let respond!: (response: Response) => void;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((resolve) => { respond = resolve; }));
    const authMiddleware = createSpaRouteAuthorization({ onError });
    const loader = vi.fn(() => null);
    const downstream = vi.fn<MiddlewareFunction>(async (_, next) => { await next(); });
    const view = vi.fn((params: { wikiId: string }, queryString: { tab?: string }) => (
      <p>Wiki {params.wikiId}: {queryString.tab}</p>
    ));
    mountRouter(createSpaRouter(WikiRoutes, {
      Index: { render: () => "index" },
      View: { render: view, loader, middleware: [downstream] },
      Edit: { render: () => "edit" },
    }, { sharedMiddleware: [authMiddleware] }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledOnce());
    expect(downstream).not.toHaveBeenCalled();
    expect(loader).not.toHaveBeenCalled();
    expect(view).not.toHaveBeenCalled();

    await act(async () => { respond(decision(200)); });

    expect(await screen.findByText("Wiki 42: history")).toBeInTheDocument();
    expect(downstream).toHaveBeenCalledOnce();
    expect(loader).toHaveBeenCalledOnce();
  });

  it("authorizes every generated route with its current identity and decoded values under a basename", async () => {
    window.history.replaceState(null, "", "/app/wiki");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => decision(200));
    const authMiddleware = createSpaRouteAuthorization({ onError });
    const router = createSpaRouter({ ...WikiRoutes, ...SearchRoutes }, {
      Index: { render: () => "index" },
      View: { render: (params) => `view ${params.wikiId}` },
      Edit: { render: () => "edit" },
      Search: { render: () => "search" },
    }, { basename: "/app", sharedMiddleware: [authMiddleware] });
    mountRouter(router);
    await screen.findByText("index");

    await act(() => router.navigate(WikiRoutes.View({ wikiId: "雪%2F%25" }, { tab: "a b+&" })));
    // React Router turns %2F into /; the remaining %25 must not be decoded again.
    expect(screen.getByText("view 雪/%25")).toBeInTheDocument();
    await act(() => router.navigate(WikiRoutes.Edit({ wikiId: "42" })));
    await act(() => router.navigate("/search/books?q=hello&tag=one&tag=two&extra=kept"));
    await act(() => router.navigate("/search?q="));

    const queries = fetchSpy.mock.calls.map(([input]) => new URL(String(input), "http://localhost").searchParams);
    expect(queries.map((query) => [query.get("applicationId"), query.get("routeId")])).toEqual([
      ["wiki", "Index"], ["wiki", "View"], ["wiki", "Edit"], ["search", "Search"], ["search", "Search"],
    ]);
    expect(queries[1]!.get("parameters.wikiId")).toBe("雪/%25");
    expect(queries[1]!.get("queryString.tab")).toBe("a b+&");
    expect(queries[2]!.get("parameters.wikiId")).toBe("42");
    expect(queries[3]!.get("parameters.category")).toBe("books");
    expect(queries[3]!.getAll("queryString.tag")).toEqual(["one", "two"]);
    expect(queries[3]!.get("queryString.extra")).toBe("kept");
    expect(queries[4]!.has("parameters.category")).toBe(false);
    expect(queries[4]!.get("queryString.q")).toBe("");
    expect(router.state.location.pathname).toBe("/app/search");
  });

  it("uses the route React Router actually matches with case-sensitive route options", async () => {
    window.history.replaceState(null, "", "/wiki/New");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => decision(200));
    const router = createSpaRouter({
      ...WikiRoutes,
      New: { ...WikiRoutes.Index, path: "/wiki/New", routeId: "New" },
    }, {
      Index: { render: () => "index" },
      View: { render: () => "view" },
      Edit: { render: () => "edit" },
      New: { render: () => "new", caseSensitive: true },
    }, { sharedMiddleware: [createSpaRouteAuthorization({ onError })] });
    mountRouter(router);
    await screen.findByText("new");

    await act(() => router.navigate("/wiki/new"));

    expect(screen.getByText("view")).toBeInTheDocument();
    expect(fetchSpy.mock.calls.map(([input]) => new URL(String(input), "http://localhost").searchParams.get("routeId")))
      .toEqual(["New", "View"]);
  });

  it("checks query-only navigations without loaders and redirects denied routes", async () => {
    window.history.replaceState(null, "", "/wiki/42");
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(decision(200))
      .mockResolvedValueOnce(decision(302, "/wiki"))
      .mockResolvedValueOnce(decision(200));
    const authMiddleware = createSpaRouteAuthorization({ onError, redirectMode: "router" });
    const view = vi.fn(() => "view");
    const router = createSpaRouter(WikiRoutes, {
      Index: { render: () => "index" },
      View: { render: view },
      Edit: { render: () => "edit" },
    }, { sharedMiddleware: [authMiddleware] });
    mountRouter(router);
    await screen.findByText("view");
    view.mockClear();

    await act(() => router.navigate("/wiki/42?tab=history"));

    expect(screen.getByText("index")).toBeInTheDocument();
    expect(view).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    const query = new URL(String(fetchSpy.mock.calls[1]![0]), "http://localhost").searchParams;
    expect(query.get("queryString.tab")).toBe("history");
    const redirectQuery = new URL(String(fetchSpy.mock.calls[2]![0]), "http://localhost").searchParams;
    expect(redirectQuery.get("routeId")).toBe("Index");
  });

  it("authorizes a fetcher's target route independently of the rendered route", async () => {
    window.history.replaceState(null, "", "/wiki");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => decision(200));
    const loader = vi.fn(() => "wiki data");

    function FetcherIndex() {
      const fetcher = useFetcher<string>();
      return <>
        <p>index</p>
        <button onClick={() => { void fetcher.load("/wiki/42?tab=history"); }}>Load details</button>
        <p>{fetcher.data}</p>
      </>;
    }

    const router = createSpaRouter(WikiRoutes, {
      Index: { render: () => <FetcherIndex /> },
      View: { render: () => "view", loader },
      Edit: { render: () => "edit" },
    }, { sharedMiddleware: [createSpaRouteAuthorization({ onError })] });
    mountRouter(router);
    await screen.findByText("index");

    fireEvent.click(screen.getByRole("button", { name: "Load details" }));

    expect(await screen.findByText("wiki data")).toBeInTheDocument();
    expect(screen.getByText("index")).toBeInTheDocument();
    expect(loader).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const query = new URL(String(fetchSpy.mock.calls[1]![0]), "http://localhost").searchParams;
    expect(query.get("routeId")).toBe("View");
    expect(query.get("parameters.wikiId")).toBe("42");
    expect(query.get("queryString.tab")).toBe("history");
  });

  it("blocks submitted actions when authorization is denied", async () => {
    window.history.replaceState(null, "", "/wiki");
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(decision(200))
      .mockResolvedValueOnce(decision(403))
      .mockResolvedValueOnce(decision(200));
    const authMiddleware = createSpaRouteAuthorization({
      onError: { type: "redirect", location: "/wiki" },
      redirectMode: "router",
    });
    const action = vi.fn(() => "saved");
    const loader = vi.fn(() => null);
    const view = vi.fn(() => "edit");
    const router = createSpaRouter(WikiRoutes, {
      Index: { render: () => "index" },
      View: { render: () => "view" },
      Edit: { render: view, action, loader },
    }, { sharedMiddleware: [authMiddleware] });
    mountRouter(router);
    await screen.findByText("index");

    await act(() => router.navigate("/wiki/42/edit", { formMethod: "post", formData: new FormData() }));

    expect(screen.getByText("index")).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(action).not.toHaveBeenCalled();
    expect(loader).not.toHaveBeenCalled();
    expect(view).not.toHaveBeenCalled();
  });

  it.each([200, 403])("gates parent and child loaders in a native router for decision %i", async (statusCode) => {
    let respond!: (response: Response) => void;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((resolve) => { respond = resolve; }));
    const parentLoader = vi.fn(() => null);
    const childLoader = vi.fn(() => null);
    const authMiddleware = createSpaRouteAuthorization({ onError, redirectMode: "router" });
    const router = createMemoryRouter([
      {
        path: "/wiki",
        loader: parentLoader,
        children: [{
          id: "frontend-only-id",
          path: ":wikiId",
          middleware: [
            ({ context }) => { context.set(spaRouteContext, WikiRoutes.View); },
            authMiddleware,
          ],
          loader: childLoader,
        }],
      },
      { path: "/error" },
    ], { initialEntries: ["/wiki/42"] });
    routers.push(router);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledOnce());
    expect(parentLoader).not.toHaveBeenCalled();
    expect(childLoader).not.toHaveBeenCalled();
    const query = new URL(String(fetchSpy.mock.calls[0]![0]), "http://localhost").searchParams;
    expect(query.get("routeId")).toBe("View");

    respond(decision(statusCode));
    await waitFor(() => expect(router.state.initialized).toBe(true));

    expect(parentLoader).toHaveBeenCalledTimes(statusCode === 200 ? 1 : 0);
    expect(childLoader).toHaveBeenCalledTimes(statusCode === 200 ? 1 : 0);
    expect(router.state.location.pathname).toBe(statusCode === 200 ? "/wiki/42" : "/error");
    expect(router.state.errors).toBeNull();
  });

  it("aborts the endpoint request when a newer navigation supersedes it", async () => {
    window.history.replaceState(null, "", "/wiki/42");
    let requestSignal: AbortSignal | undefined;
    vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce((_input, options) => new Promise((_resolve, reject) => {
        requestSignal = options?.signal ?? undefined;
        requestSignal?.addEventListener("abort", () => reject(requestSignal?.reason), { once: true });
      }))
      .mockResolvedValueOnce(decision(200));
    const authMiddleware = createSpaRouteAuthorization({ onError });
    const loader = vi.fn(() => null);
    const router = createSpaRouter(WikiRoutes, {
      Index: { render: () => "index" },
      View: { render: () => "view", loader },
      Edit: { render: () => "edit" },
    }, { sharedMiddleware: [authMiddleware] });
    mountRouter(router);
    await waitFor(() => expect(requestSignal).toBeDefined());

    await act(() => router.navigate("/wiki"));

    expect(requestSignal?.aborted).toBe(true);
    expect(screen.getByText("index")).toBeInTheDocument();
    expect(router.state.errors).toBeNull();
    expect(loader).not.toHaveBeenCalled();
  });
});

// Compile-only API coverage; checked by the package's typecheck:test command.
function verifyAuthorizationTypes() {
  // @ts-expect-error A fallback decision is required.
  createSpaRouteAuthorization({});
  const middleware: MiddlewareFunction = createSpaRouteAuthorization({ onError });
  // @ts-expect-error The middleware is ready to register, not a per-route factory.
  middleware(WikiRoutes.View);
  // @ts-expect-error Both generated route identifiers are required in context.
  new RouterContextProvider().set(spaRouteContext, { routeId: "View" });
  // @ts-expect-error The application ID comes from the matched route.
  createSpaRouteAuthorization({ onError, applicationId: "wiki" });
  return middleware;
}
