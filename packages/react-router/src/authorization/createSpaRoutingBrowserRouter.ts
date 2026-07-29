import { createBrowserRouter } from "react-router";
import type { RouteObject } from "react-router";

import { spaRoutingResolver } from "./spaRoutingResolver.js";
import type { SpaRoutingResolverOptions } from "./spaRoutingResolver.js";
import { withRouteAuthorization } from "./withRouteAuthorization.js";
import type { RouteAuthorizationOptions } from "./withRouteAuthorization.js";

export interface CreateSpaRoutingBrowserRouterOptions extends SpaRoutingResolverOptions {
  /** Options forwarded to `withRouteAuthorization` (e.g. `redirectMode`). */
  routeAuthorizationOptions?: RouteAuthorizationOptions;
  /** Options forwarded to React Router's `createBrowserRouter`. */
  routerOptions?: Parameters<typeof createBrowserRouter>[1];
}

/**
 * The common composition in one call: a browser router whose routes are gated
 * with {@link withRouteAuthorization} using the default
 * {@link spaRoutingResolver}. The application id and failure decision are
 * required; the resolver endpoint, `withRouteAuthorization` options (e.g.
 * redirect mode), and `createBrowserRouter` options can be overridden when
 * needed — each option family is forwarded wholesale, so nothing is silently
 * dropped. For another router flavor or a custom resolver, compose
 * `createBrowserRouter`, `withRouteAuthorization`, and `spaRoutingResolver`
 * directly.
 *
 * @example
 * const router = createSpaRoutingBrowserRouter(routes, {
 *   applicationId: "app",
 *   onError: { type: "redirect", location: "/500" },
 * });
 */
export function createSpaRoutingBrowserRouter(
  routes: RouteObject[],
  options: CreateSpaRoutingBrowserRouterOptions,
): ReturnType<typeof createBrowserRouter> {
  const { routeAuthorizationOptions, routerOptions, ...resolverOptions } = options;

  const resolver = spaRoutingResolver(resolverOptions);
  const authorizedRoutes = withRouteAuthorization(routes, resolver, routeAuthorizationOptions);

  return createBrowserRouter(authorizedRoutes, routerOptions);
}
