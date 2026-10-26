import { transferableAbortController } from "node:util";
import { createRef } from "react";
import type { ComponentProps, MouseEventHandler } from "react";
import { act, cleanup, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSpaRouter, createSpaRouteDecisionMiddleware, SpaLink } from "../index.js";
import type { RouteTarget, SpaLinkProps } from "../index.js";
import { WikiRoutes } from "../routing/__fixtures__/routes.js";

const routers: ReturnType<typeof createSpaRouter>[] = [];

beforeEach(() => {
  vi.stubGlobal("AbortController", transferableAbortController().constructor);
  window.history.replaceState(null, "", "/app/wiki");
});

afterEach(() => {
  cleanup();
  routers.splice(0).forEach((router) => router.dispose());
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mountLink(to: RouteTarget, props: Omit<ComponentProps<typeof SpaLink>, "to"> = {}) {
  const router = createSpaRouter(WikiRoutes, {
    Index: { render: () => <SpaLink {...props} to={to}>Destination</SpaLink> },
    View: { render: ({ params, queryString }) => <p>View {params.wikiId}: {queryString.tab}</p> },
    Edit: { render: () => "edit" },
  }, { basename: "/app" });
  routers.push(router);
  render(<RouterProvider router={router} />);
  const link = await screen.findByRole("link", { name: "Destination" });
  return { router, link, navigate: vi.spyOn(router, "navigate") };
}

// Observe cancellation after React's handlers, then prevent jsdom's unsupported
// document navigation. This keeps the link's native default behavior testable.
function dispatchLinkEvent(link: HTMLElement, event: Event): boolean {
  let prevented = false;
  function observe(nativeEvent: Event) {
    if (nativeEvent === event) {
      prevented = nativeEvent.defaultPrevented;
      nativeEvent.preventDefault();
    }
  }
  document.addEventListener(event.type, observe);
  try {
    fireEvent(link, event);
  } finally {
    document.removeEventListener(event.type, observe);
  }
  return prevented;
}

describe("SpaLink", () => {
  it("uses a React Router Link for the same application, applying basename without re-encoding", async () => {
    const target = WikiRoutes.View({ wikiId: "雪%25" }, { tab: "a b+&" });
    const onClick = vi.fn();
    const { router, link, navigate } = await mountLink(target, { onClick });
    expect(link.getAttribute("href")).toBe(`/app${target.href}`);

    expect(dispatchLinkEvent(link, createEvent.click(link))).toBe(true);

    await screen.findByText("View 雪%25: a b+&");
    expect(onClick).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(target.href, expect.any(Object));
    expect(router.state.location.pathname + router.state.location.search).toBe(`/app${target.href}`);
  });

  it("uses a native anchor for another application even when its href matches this router", async () => {
    const target = { ...WikiRoutes.View({ wikiId: "42" }), applicationId: "auth" };
    const onClick = vi.fn();
    const { link, navigate } = await mountLink(target, { onClick });
    expect(link.getAttribute("href")).toBe(target.href);

    expect(dispatchLinkEvent(link, createEvent.click(link))).toBe(false);

    expect(onClick).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each(["wiki", "auth"])("preserves anchor attributes and refs for application %s", async (applicationId) => {
    const to = { ...WikiRoutes.View({ wikiId: "42" }, { tab: "stats" }), applicationId };
    const ref = createRef<HTMLAnchorElement>();
    const { link } = await mountLink(to, {
      ref, id: "destination", className: "menu-link", title: "Open destination",
      target: "_blank", rel: "noopener", "aria-describedby": "hint", hrefLang: "en",
    });
    expect(ref.current).toBe(link);
    expect(link).toHaveAttribute("id", "destination");
    expect(link).toHaveClass("menu-link");
    expect(link).toHaveAttribute("title", "Open destination");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener");
    expect(link).toHaveAttribute("aria-describedby", "hint");
    expect(link).toHaveAttribute("hreflang", "en");
    expect(link.getAttribute("href")).toBe(`${applicationId === "wiki" ? "/app" : ""}${to.href}`);
  });

  describe.each(["wiki", "auth"])("native interactions for application %s", (applicationId) => {
    const to = { ...WikiRoutes.View({ wikiId: "42" }), applicationId };

    it.each(["ctrlKey", "metaKey", "shiftKey", "altKey"])("leaves %s clicks to the browser", async (modifier) => {
      const onClick = vi.fn();
      const { link, navigate } = await mountLink(to, { onClick });
      expect(dispatchLinkEvent(link, createEvent.click(link, { [modifier]: true }))).toBe(false);
      expect(onClick).toHaveBeenCalledOnce();
      expect(navigate).not.toHaveBeenCalled();
    });

    it("leaves middle clicks and auxiliary clicks to the browser", async () => {
      const onAuxClick = vi.fn();
      const { link, navigate } = await mountLink(to, { onAuxClick });
      expect(dispatchLinkEvent(link, createEvent.click(link, { button: 1 }))).toBe(false);
      const auxiliary = new MouseEvent("auxclick", { button: 1, bubbles: true, cancelable: true });
      expect(dispatchLinkEvent(link, auxiliary)).toBe(false);
      expect(onAuxClick).toHaveBeenCalledOnce();
      expect(navigate).not.toHaveBeenCalled();
    });

    it.each(["_blank", "preview"])("leaves target=%s navigation to the browser", async (target) => {
      const { link, navigate } = await mountLink(to, { target });
      expect(dispatchLinkEvent(link, createEvent.click(link))).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
    });

    it.each([true, "", "page.html"])("leaves download=%s to the browser", async (download) => {
      const { link, navigate } = await mountLink(to, { download });
      expect(link).toHaveAttribute("download", typeof download === "string" ? download : "");
      expect(dispatchLinkEvent(link, createEvent.click(link))).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
    });

    it("honors caller preventDefault", async () => {
      const onClick = vi.fn<MouseEventHandler<HTMLAnchorElement>>((event) => event.preventDefault());
      const { link, navigate } = await mountLink(to, { onClick });
      expect(dispatchLinkEvent(link, createEvent.click(link))).toBe(true);
      expect(onClick).toHaveBeenCalledOnce();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  it("keeps internal navigation for download=false and target=_self", async () => {
    const { link, navigate } = await mountLink(WikiRoutes.View({ wikiId: "42" }), { download: false, target: "_self" });
    expect(link).not.toHaveAttribute("download");
    expect(dispatchLinkEvent(link, createEvent.click(link))).toBe(true);
    await waitFor(() => expect(navigate).toHaveBeenCalledOnce());
    await screen.findByText("View 42:");
  });

  it("runs the route-decision middleware before rendering an internal destination", async () => {
    let respond!: (value: Response) => void;
    const fetch = vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((resolve) => { respond = resolve; }));
    const router = createSpaRouter({ ...WikiRoutes, Index: { ...WikiRoutes.Index, hasAccessHandler: false } }, {
      Index: { render: () => <SpaLink to={WikiRoutes.View({ wikiId: "42" })}>View</SpaLink> },
      View: { render: () => "Authorized destination" },
      Edit: { render: () => "edit" },
    }, {
      basename: "/app",
      sharedMiddleware: [createSpaRouteDecisionMiddleware({ onError: { type: "denied", destination: "/error" } })],
    });
    routers.push(router);
    render(<RouterProvider router={router} />);
    fireEvent.click(await screen.findByRole("link", { name: "View" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(screen.queryByText("Authorized destination")).not.toBeInTheDocument();
    await act(async () => { respond(Response.json({ type: "allowed" })); });
    await screen.findByText("Authorized destination");
  });

  it("reports a clear error outside the generated route context", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<SpaLink to={WikiRoutes.Index()}>Index</SpaLink>))
      .toThrow("SpaLink: missing application context");
  });
});

// Compile-only public API checks, validated by typecheck:test.
function verifyLinkTypes() {
  const props: SpaLinkProps = { to: WikiRoutes.View({ wikiId: "42" }, { tab: "stats" }), target: "_blank" };
  const valid = <SpaLink {...props} ref={createRef<HTMLAnchorElement>()} download="page.html">View</SpaLink>;
  // @ts-expect-error Strings have no application identity.
  const stringTarget = <SpaLink to="/wiki">Index</SpaLink>;
  // @ts-expect-error Pass a completed target, not a builder.
  const builderTarget = <SpaLink to={WikiRoutes.Index}>Index</SpaLink>;
  // @ts-expect-error href comes from the target and cannot be overridden.
  const overriddenHref = <SpaLink to={WikiRoutes.Index()} href="/other">Index</SpaLink>;
  // @ts-expect-error React Router state is not a cross-application anchor attribute.
  const routerState = <SpaLink to={WikiRoutes.Index()} state={{ from: "index" }}>Index</SpaLink>;
  return valid;
}
