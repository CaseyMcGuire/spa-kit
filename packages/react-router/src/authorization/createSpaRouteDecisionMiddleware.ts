import { routeAuthorizationRedirect } from "./routeAuthorizationRedirect.js";
import type { MiddlewareFunction } from "react-router";
import { spaRouteContext } from "../routing/spaRouteContext.js";
import { spaRoutingResolver } from "./spaRoutingResolver.js";
import type { SpaRoutingResolverOptions } from "./spaRoutingResolver.js";
import type { RouteAuthorizationOptions } from "./withRouteAuthorization.js";

/** Shared endpoint, fallback decision, and redirect mode for route middleware. */
export interface CreateSpaRouteDecisionMiddlewareOptions
  extends Omit<SpaRoutingResolverOptions, "applicationId">, RouteAuthorizationOptions {}

/**
 * Create native React Router route-decision middleware for shared registration.
 * Reads the matched generated route's applicationId/routeId from spaRouteContext,
 * supplied automatically by `createSpaRouter` before shared middleware runs.
 *
 * Skips the endpoint when generated `hasAccessHandler` is false. Application
 * access is assumed to have been established by the full-page app load.
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
 * const authMiddleware = createSpaRouteDecisionMiddleware({
 *   onError: { type: "denied", destination: "/error" },
 * });
 * const router = createSpaRouter(WikiRoutes, routeConfig, {
 *   sharedMiddleware: [authMiddleware],
 * });
 */
export function createSpaRouteDecisionMiddleware(
  options: CreateSpaRouteDecisionMiddlewareOptions,
): MiddlewareFunction {
  const { redirectMode = "document", ...resolverOptions } = options;

  return async ({ params, request, context }, next) => {
    request.signal.throwIfAborted();

    const route = context.get(spaRouteContext);
    if (route === null) {
      throw new Error(
        "createSpaRouteDecisionMiddleware: missing route identity. Use createSpaRouter " +
        "or set spaRouteContext before running authorization middleware.",
      );
    }
    if (typeof route.hasAccessHandler !== "boolean") {
      throw new Error("createSpaRouteDecisionMiddleware: missing hasAccessHandler metadata. Regenerate routes.");
    }
    if (!route.hasAccessHandler) {
      await next();
      return;
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
      case "allowed":
        await next();
        return;
      case "denied":
      case "unknown_route":
      case "invalid_request":
        throw routeAuthorizationRedirect(decision.destination, redirectMode);
    }
  };
}
