import { transferableAbortController } from "node:util";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { createContext, isRouteErrorResponse, redirect, RouterProvider, useLoaderData, useRouteError } from "react-router";
import type { MiddlewareFunction } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSpaRouter } from "./createSpaRouter.js";
import type { SpaRouterConfig } from "./createSpaRouter.js";
import { SearchRoutes, WikiRoutes } from "./__fixtures__/routes.js";

const routers: ReturnType<typeof createSpaRouter>[] = [];

beforeEach(() => {
  // Node's Request needs a Node AbortSignal rather than jsdom's implementation.
  vi.stubGlobal("AbortController", transferableAbortController().constructor);
});

afterEach(() => {
  cleanup();
  routers.splice(0).forEach((router) => router.dispose());
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mountRouter(router: ReturnType<typeof createSpaRouter>) {
  routers.push(router);
  return render(<RouterProvider router={router} />);
}

function RouteError() {
  const error = useRouteError();
  return <p>Error {isRouteErrorResponse(error) ? error.status : "unexpected"}</p>;
}

function LoaderView() {
  return <p>Loaded: {useLoaderData<string>()}</p>;
}

const wikiConfig = {
  Index: { render: () => "index", hydrateFallbackElement: <p>Loading</p> },
  View: {
    render: (params, query) => <p>{params.wikiId}: {query.tab ?? "default"}</p>,
    errorElement: <RouteError />,
    hydrateFallbackElement: <p>Loading</p>,
  },
  Edit: { render: (params) => <p>Edit {params.wikiId}</p>, hydrateFallbackElement: <p>Loading</p> },
} satisfies SpaRouterConfig<typeof WikiRoutes>;

describe("createSpaRouter", () => {
  it("uses generated paths and IDs, forwards browser options, and renders parsed values without auth", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    window.history.replaceState(null, "", "/app/wiki/42?tab=a+b%2B%26%E9%9B%AA&extra=ignored");
    const view = vi.fn(wikiConfig.View.render);
    const router = createSpaRouter(WikiRoutes, {
      ...wikiConfig,
      View: { ...wikiConfig.View, render: view },
    }, { basename: "/app" });
    mountRouter(router);

    expect(await screen.findByText("42: a b+&雪")).toBeInTheDocument();
    expect(view).toHaveBeenLastCalledWith({ wikiId: "42" }, { tab: "a b+&雪" });
    expect(router.basename).toBe("/app");
    expect(router.routes.map(({ id, path }) => ({ id, path }))).toEqual([
      { id: "Index", path: "/wiki" },
      { id: "View", path: "/wiki/:wikiId" },
      { id: "Edit", path: "/wiki/:wikiId/edit" },
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("updates query values even when loaders do not revalidate, and supports all generated routes", async () => {
    window.history.replaceState(null, "", "/wiki/42");
    const loader = vi.fn(() => null);
    const sharedMiddleware = vi.fn<MiddlewareFunction>();
    const router = createSpaRouter(WikiRoutes, {
      ...wikiConfig,
      View: { ...wikiConfig.View, loader, shouldRevalidate: () => false },
    }, { sharedMiddleware: [sharedMiddleware] });
    mountRouter(router);

    expect(await screen.findByText("42: default")).toBeInTheDocument();
    await act(() => router.navigate("/wiki/42?tab=history"));
    expect(screen.getByText("42: history")).toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(1);

    await act(() => router.navigate(WikiRoutes.Edit({ wikiId: "42" })));
    expect(screen.getByText("Edit 42")).toBeInTheDocument();
    await act(() => router.navigate(WikiRoutes.Index()));
    expect(screen.getByText("index")).toBeInTheDocument();
    expect(sharedMiddleware.mock.calls.map(([{ request }]) => {
      const url = new URL(request.url);
      return url.pathname + url.search;
    })).toEqual(["/wiki/42", "/wiki/42?tab=history", "/wiki/42/edit", "/wiki"]);
  });

  it("waits for shared middleware on the initial navigation without loaders", async () => {
    window.history.replaceState(null, "", "/wiki/42");
    let allow!: () => void;
    const pending = new Promise<void>((resolve) => { allow = resolve; });
    const sharedMiddleware = vi.fn<MiddlewareFunction>(async (_args, next) => {
      await pending;
      await next();
    });
    const view = vi.fn(wikiConfig.View.render);
    mountRouter(createSpaRouter(WikiRoutes, {
      ...wikiConfig,
      View: { ...wikiConfig.View, render: view },
    }, { sharedMiddleware: [sharedMiddleware] }));

    await waitFor(() => expect(sharedMiddleware).toHaveBeenCalledOnce());
    expect(view).not.toHaveBeenCalled();
    expect(screen.getByText("Loading")).toBeInTheDocument();

    await act(async () => { allow(); });
    expect(await screen.findByText("42: default")).toBeInTheDocument();
  });

  it("passes required/repeated queries and optional path values from the parser", async () => {
    window.history.replaceState(null, "", "/search?q=hello&tag=one&tag=two");
    const view = vi.fn((params, query) => JSON.stringify({ params, query }));
    const router = createSpaRouter(SearchRoutes, {
      Search: { render: view, hydrateFallbackElement: <p>Loading</p> },
    });
    mountRouter(router);

    await waitFor(() => expect(view).toHaveBeenCalledWith({}, { q: "hello", tag: ["one", "two"] }));
    await act(() => router.navigate("/search/books?q="));
    expect(view).toHaveBeenLastCalledWith({ category: "books" }, { q: "" });
  });

  it("leaves React Router's decoded path values intact", async () => {
    window.history.replaceState(null, "", WikiRoutes.View({ wikiId: "雪%25" }));
    mountRouter(createSpaRouter(WikiRoutes, wikiConfig));
    expect(await screen.findByText("雪%25: default")).toBeInTheDocument();
  });

  it("validates the initial URL without loaders or an explicit loading fallback", async () => {
    window.history.replaceState(null, "", "/search");
    const warn = vi.spyOn(console, "warn");
    const view = vi.fn(() => "search");
    mountRouter(createSpaRouter(SearchRoutes, {
      Search: { render: view, ErrorBoundary: RouteError },
    }));

    expect(await screen.findByText("Error 400")).toBeInTheDocument();
    expect(view).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(["/wiki/42?tab=one&tab=two", "/search"])(
    "rejects invalid declared values at %s before user middleware, loaders, actions, or rendering",
    async (path) => {
      window.history.replaceState(null, "", "/wiki");
      const sharedMiddleware = vi.fn();
      const middleware = vi.fn();
      const loader = vi.fn();
      const action = vi.fn();
      const view = vi.fn(() => "invalid render");
      const invalidConfig = {
        render: view,
        middleware: [middleware],
        loader,
        action,
        ErrorBoundary: RouteError,
        hydrateFallbackElement: <p>Loading</p>,
      };
      const router = createSpaRouter({ ...WikiRoutes, ...SearchRoutes }, {
        ...wikiConfig,
        View: invalidConfig,
        Search: invalidConfig,
      }, { sharedMiddleware: [sharedMiddleware] });
      mountRouter(router);
      await screen.findByText("index");
      sharedMiddleware.mockClear();

      await act(() => router.navigate(path));
      expect(screen.getByText("Error 400")).toBeInTheDocument();
      await act(() => router.navigate(path, { formMethod: "post", formData: new FormData() }));
      expect(screen.getByText("Error 400")).toBeInTheDocument();
      expect(sharedMiddleware).not.toHaveBeenCalled();
      expect(middleware).not.toHaveBeenCalled();
      expect(loader).not.toHaveBeenCalled();
      expect(action).not.toHaveBeenCalled();
      expect(view).not.toHaveBeenCalled();
    },
  );

  it("runs shared middleware around route middleware and loaders/actions with a common context", async () => {
    window.history.replaceState(null, "", "/wiki/42");
    const events: string[] = [];
    const userContext = createContext<string>();
    const router = createSpaRouter(WikiRoutes, {
      ...wikiConfig,
      View: {
        ...wikiConfig.View,
        render: () => <LoaderView />,
        middleware: [async ({ params, request, context }, next) => {
          expect(context.get(userContext)).toBe("casey");
          events.push(`before ${request.method} ${params.wikiId}`);
          await next();
          events.push(`after ${request.method}`);
        }],
        loader: () => { events.push("loader"); return "wiki data"; },
        action: () => { events.push("action"); return "saved"; },
      },
    }, {
      sharedMiddleware: [
        async ({ context }, next) => {
          context.set(userContext, "casey");
          events.push("shared first before");
          await next();
          events.push("shared first after");
        },
        async (_args, next) => {
          events.push("shared second before");
          await next();
          events.push("shared second after");
        },
      ],
    });
    mountRouter(router);

    expect(await screen.findByText("Loaded: wiki data")).toBeInTheDocument();
    expect(events).toEqual([
      "shared first before", "shared second before", "before GET 42",
      "loader",
      "after GET", "shared second after", "shared first after",
    ]);
    events.length = 0;
    await act(() => router.navigate("/wiki/42", { formMethod: "post", formData: new FormData() }));
    expect(events).toEqual([
      "shared first before", "shared second before", "before POST 42",
      "action",
      "after POST", "shared second after", "shared first after",
      "shared first before", "shared second before", "before GET 42",
      "loader",
      "after GET", "shared second after", "shared first after",
    ]);
    expect(router.state.actionData).toEqual({ View: "saved" });
  });

  it("lets middleware redirect before loading or rendering the destination", async () => {
    window.history.replaceState(null, "", "/wiki/42");
    const loader = vi.fn();
    const view = vi.fn(() => "protected");
    mountRouter(createSpaRouter(WikiRoutes, {
      ...wikiConfig,
      View: {
        ...wikiConfig.View,
        render: view,
        loader,
        middleware: [() => { throw redirect(WikiRoutes.Index()); }],
      },
    }));

    expect(await screen.findByText("index")).toBeInTheDocument();
    expect(loader).not.toHaveBeenCalled();
    expect(view).not.toHaveBeenCalled();
  });

  it.each(["get", "post"] as const)("lets shared middleware redirect a %s before route handlers or rendering", async (formMethod) => {
    window.history.replaceState(null, "", "/wiki");
    const middleware = vi.fn();
    const loader = vi.fn();
    const action = vi.fn();
    const view = vi.fn(() => "protected");
    const router = createSpaRouter(WikiRoutes, {
      ...wikiConfig,
      View: { ...wikiConfig.View, render: view, middleware: [middleware], loader, action },
    }, {
      sharedMiddleware: [({ params }) => {
        if (params.wikiId !== undefined) {
          throw redirect(WikiRoutes.Index());
        }
      }],
    });
    mountRouter(router);
    await screen.findByText("index");

    await act(() => router.navigate("/wiki/42", { formMethod, formData: new FormData() }));

    expect(router.state.location.pathname).toBe("/wiki");
    expect(screen.getByText("index")).toBeInTheDocument();
    expect(middleware).not.toHaveBeenCalled();
    expect(loader).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
    expect(view).not.toHaveBeenCalled();
  });

  it("handles shared middleware errors with the matched route's error boundary", async () => {
    window.history.replaceState(null, "", "/wiki/42");
    const view = vi.fn(wikiConfig.View.render);
    mountRouter(createSpaRouter(WikiRoutes, {
      ...wikiConfig,
      View: { ...wikiConfig.View, render: view },
    }, {
      sharedMiddleware: [() => { throw new Response("Forbidden", { status: 403 }); }],
    }));

    expect(await screen.findByText("Error 403")).toBeInTheDocument();
    expect(view).not.toHaveBeenCalled();
  });

  it("rejects incomplete or unknown configurations from untyped callers", () => {
    const unchecked = (value: unknown) => value as SpaRouterConfig<typeof WikiRoutes>;
    expect(() => createSpaRouter(WikiRoutes, unchecked({ Index: wikiConfig.Index })))
      .toThrow('route "View" requires a render function');
    expect(() => createSpaRouter(WikiRoutes, unchecked({ ...wikiConfig, View: {} })))
      .toThrow('route "View" requires a render function');
    expect(() => createSpaRouter(WikiRoutes, unchecked({ ...wikiConfig, Unknown: wikiConfig.Index })))
      .toThrow('unknown route configuration "Unknown"');
  });
});

// Compile-only coverage. Run `npm run typecheck:test --workspace @spa-kit/react-router`:
// Vitest alone does not validate these assertions, and this function is never called.
function verifyRendererTypes() {
  const sharedMiddleware: readonly MiddlewareFunction[] = [async ({ request, params }, next) => {
    const url: string = request.url;
    const wikiId: string | undefined = params.wikiId;
    // @ts-expect-error Shared middleware uses native optional parameter types.
    const requiredWikiId: string = params.wikiId;
    await next();
  }];
  createSpaRouter(WikiRoutes, wikiConfig, { sharedMiddleware, basename: "/app" });
  createSpaRouter(WikiRoutes, wikiConfig, {
    // @ts-expect-error Shared middleware must contain native middleware functions.
    sharedMiddleware: ["auth"],
  });

  createSpaRouter(WikiRoutes, {
    Index: { render: (params, query) => {
      // @ts-expect-error Index has no declared path parameters.
      params.wikiId;
      // @ts-expect-error Index has no declared query parameters.
      query.tab;
      return "index";
    } },
    View: { render: (params, query) => {
      const wikiId: string = params.wikiId;
      const tab: string | undefined = query.tab;
      // @ts-expect-error Only declared path parameters are available.
      params.unknown;
      // @ts-expect-error Only declared query parameters are available.
      query.unknown;
      // @ts-expect-error An optional query is not guaranteed to be present.
      const requiredTab: string = query.tab;
      return <p>{wikiId}: {tab}</p>;
    } },
    Edit: { render: (params) => {
      const wikiId: string = params.wikiId;
      return wikiId;
    } },
  });

  // @ts-expect-error Every generated route requires configuration.
  createSpaRouter(WikiRoutes, { Index: wikiConfig.Index });
  createSpaRouter(WikiRoutes, {
    ...wikiConfig,
    // @ts-expect-error Every configured route requires a renderer.
    View: { middleware: [] },
  });
  createSpaRouter(WikiRoutes, {
    ...wikiConfig,
    // @ts-expect-error Unknown route keys cannot widen the inferred routes.
    Unknown: { render: () => "unknown" },
  });
  createSpaRouter(WikiRoutes, {
    ...wikiConfig,
    // @ts-expect-error Renderers return React content, not arbitrary objects.
    View: { render: (params) => ({ wikiId: params.wikiId }) },
  });
  createSpaRouter(WikiRoutes, {
    ...wikiConfig,
    // @ts-expect-error Generated paths cannot be overridden.
    View: { ...wikiConfig.View, path: "/different" },
  });
  createSpaRouter(SearchRoutes, {
    Search: { render: (params, query) => {
      const category: string | undefined = params.category;
      const q: string = query.q;
      const tags: readonly string[] | undefined = query.tag;
      // @ts-expect-error Optional path parameters may be absent.
      const requiredCategory: string = params.category;
      // @ts-expect-error Repeated query values are lists, not scalars.
      const tag: string = query.tag;
      return <p>{category} {q} {tags?.join(",")}</p>;
    } },
  });
}
