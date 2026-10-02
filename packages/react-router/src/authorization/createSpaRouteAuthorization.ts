import { redirect, redirectDocument } from "react-router";
import type { MiddlewareFunction } from "react-router";
import { spaRouteContext } from "../routing/spaRouteContext.js";
import { spaRoutingResolver } from "./spaRoutingResolver.js";
import type { SpaRoutingResolverOptions } from "./spaRoutingResolver.js";
import type { RouteAuthorizationOptions } from "./withRouteAuthorization.js";

/** Shared endpoint, fallback decision, and redirect mode for route middleware. */
export interface CreateSpaRouteAuthorizationOptions
  extends Omit<SpaRoutingResolverOptions, "applicationId">, RouteAuthorizationOptions {}

/**
 * Create native React Router authorization middleware for shared registration.
 * Reads the matched generated route's applicationId/routeId from spaRouteContext,
 * supplied automatically by `createSpaRouter` before shared middleware runs.
 *
 * Uses `spaRoutingResolver` to send matched path params and all query values
 * (including repeated values) to the decision endpoint. An allow decision runs
 * the downstream middleware and handlers. A redirect decision throws React
 * Router's `redirectDocument` (default) or `redirect` (`redirectMode: "router"`),
 * preventing the destination's loaders/actions/rendering from running.
 *
 * Runs on each middleware invocation, including initial navigation, fetchers,
 * and submissions/revalidation. Requests follow the router's abort signal;
 * superseded decisions never redirect or continue to downstream handlers.
 *
 * Register once through `createSpaRouter`'s `sharedMiddleware`. Native React
 * Router routes must set `spaRouteContext` before this middleware runs. Missing
 * route identity throws a configuration error without requesting or allowing
 * authorization; it does not use the endpoint's `onError` fallback.
 *
 * @example
 * const authMiddleware = createSpaRouteAuthorization({
 *   onError: { type: "redirect", location: "/error" },
 * });
 * const router = createSpaRouter(WikiRoutes, routeConfig, {
 *   sharedMiddleware: [authMiddleware],
 * });
 */
export function createSpaRouteAuthorization(
  options: CreateSpaRouteAuthorizationOptions,
): MiddlewareFunction {
  const { redirectMode = "document", ...resolverOptions } = options;

  return async ({ params, request, context }, next) => {
    request.signal.throwIfAborted();

    const route = context.get(spaRouteContext);
    if (route === null) {
      throw new Error(
        "createSpaRouteAuthorization: missing route identity. Use createSpaRouter " +
        "or set spaRouteContext before running authorization middleware.",
      );
    }
    const resolve = spaRoutingResolver({ ...resolverOptions, applicationId: route.applicationId });

    const pathParams: Record<string, string> = {};
    for (const [name, value] of Object.entries(params)) {
      if (value !== undefined) {
        pathParams[name] = value;
      }
    }

    const decision = await resolve({ route: { id: route.routeId }, params: pathParams, request });
    // A transport may still resolve after cancellation. Check before either
    // redirecting or continuing, even if the fetch itself did not reject.
    request.signal.throwIfAborted();

    switch (decision.type) {
      case "allow":
        await next();
        return;
      case "redirect":
        throw redirectMode === "document"
          ? redirectDocument(decision.location)
          : redirect(decision.location);
    }
  };
}
