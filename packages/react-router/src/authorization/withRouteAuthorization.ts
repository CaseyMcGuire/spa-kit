import { redirect } from "react-router";
import type { LoaderFunction, RouteObject } from "react-router";

/** The decision for a route: allow it, or redirect the user away. */
export type RouteAuthorizationDecision =
  | { type: "allow" }
  | { type: "redirect"; location: string };

/**
 * Decide whether a matched route is allowed — e.g. by asking your server. The
 * matched route object and its path params are provided; how a route is
 * identified to the server is up to the resolver (the default
 * `spaRoutingResolver` uses the route's `id`). This is the one configurable
 * seam.
 */
export type RouteAuthorizationResolver = (args: {
  route: RouteObject;
  params: Record<string, string>;
  request: Request;
}) => RouteAuthorizationDecision | Promise<RouteAuthorizationDecision>;

export interface RouteAuthorizationOptions {
  /**
   * How a redirect decision is performed:
   * - `"document"` (default): a full-document navigation (`window.location.assign`),
   *   for targets that are server-rendered or otherwise outside this SPA.
   * - `"router"`: a React Router redirect (`throw redirect(...)`), for targets
   *   that are client-side routes within this SPA.
   *
   * @default "document"
   */
  redirectMode?: "document" | "router";
}

/**
 * Wrap each leaf route in a React Router route tree so a page navigation is
 * gated by a server authorization check before that leaf's loader runs. The
 * check calls `resolve` with
 * the matched route for a {@link RouteAuthorizationDecision}; a `redirect` is
 * performed per {@link RouteAuthorizationOptions#redirectMode}. It composes with
 * each route's own `loader`, which runs only once access is allowed.
 *
 * The loader is attached to each **leaf** route (one with no children), which
 * authorizes itself using its own route and React Router's matched `params`.
 * Exactly one leaf terminates a given match, so there's a single check per
 * navigation. (A parent route that's navigable at its own path with no index
 * child is not a leaf, so a direct visit to it isn't gated.)
 *
 * @example
 * createBrowserRouter(
 *   withRouteAuthorization(routes, spaRoutingResolver({
 *     applicationId: "app",
 *     onError: { type: "redirect", location: "/error" },
 *   })),
 * );
 */
export function withRouteAuthorization(
  routes: RouteObject[],
  resolve: RouteAuthorizationResolver,
  options: RouteAuthorizationOptions = {},
): RouteObject[] {
  const { redirectMode = "document" } = options;

  const wrap = (route: RouteObject): RouteObject => {
    if (route.children != null && route.children.length > 0) {
      // Not a leaf — recurse; leave this route's own loader untouched.
      return { ...route, children: route.children.map(wrap) };
    }

    const inner = typeof route.loader === "function" ? route.loader : undefined;

    const loader: LoaderFunction = async (args) => {
      const params: Record<string, string> = {};
      for (const [name, value] of Object.entries(args.params)) {
        if (value != null) params[name] = value;
      }

      const decision = await resolve({ route, params, request: args.request });
      if (decision.type === "redirect") {
        if (redirectMode === "router") {
          // React Router owns the control flow — a normal loader redirect.
          throw redirect(decision.location);
        }
        // Leaving the SPA: start the document navigation and never settle, so
        // the denied route never renders while the browser unloads the page.
        window.location.assign(decision.location);
        return new Promise<null>(() => {});
      }

      return inner ? inner(args) : null;
    };

    return { ...route, loader };
  };

  return routes.map(wrap);
}