import { transferableAbortController } from "node:util";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useRouteError } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSpaRouter, createSpaRouteDecisionMiddleware, useSpaNavigate } from "../index.js";
import type { RouteTarget, SpaNavigateFunction, SpaNavigateOptions } from "../index.js";
import { SearchRoutes, WikiRoutes } from "../routing/__fixtures__/routes.js";

const routers: ReturnType<typeof createSpaRouter>[] = [];
const config = {
  Index: { render: () => "index" },
  View: { render: () => "view" },
  Edit: { render: () => "edit" },
};

type NavigateButtonProps = { target: RouteTarget; options?: SpaNavigateOptions; label?: string };
function NavigateButton(props: NavigateButtonProps) {
  const navigate = useSpaNavigate();
  return <button onClick={() => { void navigate(props.target, props.options); }}>{props.label ?? "Navigate"}</button>;
}

function mountRouter(router: ReturnType<typeof createSpaRouter>) {
  routers.push(router);
  return render(<RouterProvider router={router} />);
}

// jsdom's Location methods are non-configurable. Replace only the global window
// view of location during these assertions; the router retains its real window.
function spyOnDocumentNavigation() {
  const assign = vi.fn();
  const replace = vi.fn();
  vi.stubGlobal("window", new Proxy(window, {
    get(target, property) {
      return property === "location" ? { assign, replace } : Reflect.get(target, property);
    },
  }));
  return { assign, replace };
}

beforeEach(() => {
  vi.stubGlobal("AbortController", transferableAbortController().constructor);
  window.history.replaceState(null, "", "/wiki");
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
  routers.splice(0).forEach((router) => router.dispose());
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

describe("useSpaNavigate", () => {
  it.each([false, true])("uses React Router navigation with replace=%s and preserves encoded hrefs", async (replace) => {
    window.history.replaceState(null, "", "/app/wiki");
    const target = WikiRoutes.View({ wikiId: "雪%25" }, { tab: "a b+&" });
    const router = createSpaRouter(WikiRoutes, {
      ...config,
      Index: { render: () => <NavigateButton target={target} options={{ replace }} /> },
      View: { render: ({ params, queryString }) => `${params.wikiId}: ${queryString.tab}` },
    }, { basename: "/app" });
    mountRouter(router);
    await screen.findByRole("button");
    const navigate = vi.spyOn(router, "navigate");
    const document = spyOnDocumentNavigation();

    fireEvent.click(screen.getByRole("button"));

    await screen.findByText("雪%25: a b+&");
    expect(navigate).toHaveBeenCalledWith(target.href, expect.objectContaining({ replace }));
    expect(router.state.historyAction).toBe(replace ? "REPLACE" : "PUSH");
    expect(router.state.location.pathname + router.state.location.search).toBe(`/app${target.href}`);
    expect(document.assign).not.toHaveBeenCalled();
    expect(document.replace).not.toHaveBeenCalled();
  });

  it.each([undefined, false, true])("uses document navigation across applications with replace=%s", async (replace) => {
    window.history.replaceState(null, "", "/app/wiki");
    // A URL that also matches this router must still leave the application.
    const target = { ...WikiRoutes.View({ wikiId: "雪" }, { tab: "a b+&" }), applicationId: "auth" };
    const router = createSpaRouter(WikiRoutes, {
      ...config,
      Index: { render: () => <NavigateButton target={target} options={replace === undefined ? undefined : { replace }} /> },
    }, { basename: "/app" });
    mountRouter(router);
    await screen.findByRole("button");
    const navigate = vi.spyOn(router, "navigate");
    const document = spyOnDocumentNavigation();

    fireEvent.click(screen.getByRole("button"));

    expect(replace ? document.replace : document.assign).toHaveBeenCalledOnce();
    expect(replace ? document.replace : document.assign).toHaveBeenCalledWith(target.href);
    expect(replace ? document.assign : document.replace).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/app/wiki");
  });

  it("uses the matched application's identity rather than the first registry entry and follows match changes", async () => {
    window.history.replaceState(null, "", "/search?q=first");
    const target = SearchRoutes.Search({}, { q: "second", tag: ["one", "two"] });
    const router = createSpaRouter({ ...WikiRoutes, ...SearchRoutes }, {
      ...config,
      Index: { render: () => <NavigateButton target={WikiRoutes.View({ wikiId: "42" })} /> },
      Search: { render: () => <NavigateButton target={target} /> },
    });
    mountRouter(router);
    await screen.findByRole("button");
    const navigate = vi.spyOn(router, "navigate");
    const document = spyOnDocumentNavigation();

    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(router.state.location.search).toBe("?q=second&tag=one&tag=two"));
    expect(navigate).toHaveBeenCalledWith(target.href, expect.any(Object));

    // Native router navigation can match another application's route in a mixed registry.
    await act(() => router.navigate(WikiRoutes.Index().href));
    fireEvent.click(screen.getByRole("button"));
    await screen.findByText("view");
    expect(document.assign).not.toHaveBeenCalled();
    expect(document.replace).not.toHaveBeenCalled();
  });

  it("isolates application identity between simultaneously mounted routers", async () => {
    const target = WikiRoutes.View({ wikiId: "42" });
    const wikiRouter = createSpaRouter(WikiRoutes, {
      ...config,
      Index: { render: () => <NavigateButton target={target} label="Wiki" /> },
    });
    const otherRouter = createSpaRouter({ Index: { ...WikiRoutes.Index, applicationId: "other" } }, {
      Index: { render: () => <NavigateButton target={target} label="Other" /> },
    });
    mountRouter(wikiRouter);
    mountRouter(otherRouter);
    await screen.findByRole("button", { name: "Wiki" });
    await screen.findByRole("button", { name: "Other" });
    const otherNavigate = vi.spyOn(otherRouter, "navigate");
    const document = spyOnDocumentNavigation();

    fireEvent.click(screen.getByRole("button", { name: "Wiki" }));
    await screen.findByText("view");
    expect(document.assign).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Other" }));
    expect(document.assign).toHaveBeenCalledOnce();
    expect(document.assign).toHaveBeenCalledWith(target.href);
    expect(otherNavigate).not.toHaveBeenCalled();
    expect(otherRouter.state.location.pathname).toBe("/wiki");
  });

  it.each(["bare", "native router"])("reports a clear missing-context error in a %s", async (mode) => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const element = <NavigateButton target={WikiRoutes.Index()} />;
    const message = "useSpaNavigate: missing application context. Render this component inside a route created by createSpaRouter and mounted with RouterProvider.";
    if (mode === "bare") {
      expect(() => render(element)).toThrow(message);
    } else {
      function ErrorMessage() {
        return <p>{(useRouteError() as Error).message}</p>;
      }
      mountRouter(createMemoryRouter([{ path: "/", element, ErrorBoundary: ErrorMessage }]));
      await screen.findByText(message);
    }
    errorLog.mockRestore();
  });

  it.each(["allowed", "denied"] as const)("runs route-decision middleware before destination loaders for %s", async (type) => {
    let respond!: (response: Response) => void;
    const fetch = vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((resolve) => { respond = resolve; }));
    const loader = vi.fn(() => null);
    const router = createSpaRouter({ ...WikiRoutes, Index: { ...WikiRoutes.Index, hasAccessHandler: false } }, {
      ...config,
      Index: { render: () => <NavigateButton target={WikiRoutes.View({ wikiId: "42" }, { tab: "stats" })} /> },
      View: { ...config.View, loader },
    }, {
      sharedMiddleware: [createSpaRouteDecisionMiddleware({
        onError: { type: "denied", destination: "/wiki" }, redirectMode: "router",
      })],
    });
    mountRouter(router);
    await screen.findByRole("button");
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(loader).not.toHaveBeenCalled();
    expect(screen.queryByText("view")).not.toBeInTheDocument();
    const query = new URL(String(fetch.mock.calls[0]![0]), "http://localhost").searchParams;
    expect(query.get("applicationId")).toBe("wiki");
    expect(query.get("routeId")).toBe("View");
    expect(query.get("parameters.wikiId")).toBe("42");
    expect(query.get("queryString.tab")).toBe("stats");

    await act(async () => {
      respond(Response.json(type === "allowed" ? { type } : { type, destination: "/wiki" }));
    });
    await waitFor(() => expect(router.state.navigation.state).toBe("idle"));
    expect(loader).toHaveBeenCalledTimes(type === "allowed" ? 1 : 0);
    expect(router.state.location.pathname).toBe(type === "allowed" ? "/wiki/42" : "/wiki");
  });

  it.each(["ErrorBoundary", "errorElement"] as const)("supplies context to %s without bypassing route errors", async (boundary) => {
    window.history.replaceState(null, "", "/wiki/42?tab=one&tab=two");
    function ErrorNavigation() {
      const error = useRouteError() as { status: number };
      return <>
        <p>Error {error.status}</p>
        <NavigateButton target={WikiRoutes.Index()} />
      </>;
    }
    const router = createSpaRouter(WikiRoutes, {
      ...config,
      View: {
        ...config.View,
        ...(boundary === "ErrorBoundary" ? { ErrorBoundary: ErrorNavigation } : { errorElement: <ErrorNavigation /> }),
      },
    });
    mountRouter(router);
    await screen.findByText("Error 400");
    fireEvent.click(screen.getByRole("button"));
    await screen.findByText("index");
    expect(router.state.errors).toBeNull();
  });

  it.each(["HydrateFallback", "hydrateFallbackElement"] as const)("supplies context to %s while initial loaders are pending", async (fallback) => {
    let resolve!: () => void;
    const pending = new Promise<void>((done) => { resolve = done; });
    function LoadingNavigation() {
      return <NavigateButton target={{ href: "/auth/login", applicationId: "auth", routeId: "Login" }} />;
    }
    const router = createSpaRouter(WikiRoutes, {
      ...config,
      Index: {
        ...config.Index,
        loader: async () => { await pending; return null; },
        ...(fallback === "HydrateFallback" ? { HydrateFallback: LoadingNavigation } : { hydrateFallbackElement: <LoadingNavigation /> }),
      },
    });
    mountRouter(router);
    await screen.findByRole("button");
    const document = spyOnDocumentNavigation();
    fireEvent.click(screen.getByRole("button"));
    expect(document.assign).toHaveBeenCalledOnce();
    expect(document.assign).toHaveBeenCalledWith("/auth/login");
    await act(async () => { resolve(); });
    await screen.findByText("index");
  });
});

// Compile-only public API checks, validated by typecheck:test.
function verifyNavigationTypes(navigate: SpaNavigateFunction) {
  const generated: RouteTarget = WikiRoutes.View({ wikiId: "42" }, { tab: "stats" });
  const options: SpaNavigateOptions = { replace: true };
  const result: void | Promise<void> = navigate(generated, options);
  navigate(WikiRoutes.Index());
  navigate(SearchRoutes.Search({}, { q: "hello", tag: ["one", "two"] }));
  // @ts-expect-error Pass a completed target, not the callable builder.
  navigate(WikiRoutes.Index);
  // @ts-expect-error Strings have no application identity.
  navigate("/wiki");
  // @ts-expect-error The target contract requires routeId.
  navigate({ href: "/wiki", applicationId: "wiki" });
  // @ts-expect-error Cross-application navigation cannot honor React Router state.
  navigate(generated, { state: { id: "42" } });
  // @ts-expect-error The generated builder owns typed parameter validation.
  navigate(WikiRoutes.View({ wikiId: 42 }));
  // @ts-expect-error The generated builder owns typed query validation.
  navigate(WikiRoutes.View({ wikiId: "42" }, { tab: ["stats"] }));
  // @ts-expect-error Targets are readonly.
  generated.href = "/other";
  return result;
}
