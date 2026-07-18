import type {
  RouteAuthorizationDecision,
  RouteAuthorizationResolver,
} from "./withRouteAuthorization.js";

export interface SpaRoutingResolverOptions {
  /** The spa-routing application id this bundle serves (AppSpaApplication.id). */
  applicationId: string;
  /** Decision endpoint. @default "/__spa/route-decision" */
  endpoint?: string;
  /**
   * The decision to apply when the request itself fails (network/server error).
   * Required — rather than silently allowing or throwing, you choose:
   * `{ type: "allow" }` to let navigation proceed (data is still gated
   * server-side), or `{ type: "redirect", location }` to send the user
   * somewhere (e.g. an error or login page).
   */
  onError: RouteAuthorizationDecision;
}

/** Shape of a spa-routing decision endpoint response. */
interface RouteDecisionResponse {
  statusCode: number;
  location?: string | null;
}

/**
 * The default {@link RouteAuthorizationResolver}: asks the spa-routing decision
 * endpoint (`/__spa/route-decision`) whether a route is allowed, using the
 * route's `id` as the server route id and sending its path params
 * (`parameters.*`). A `3xx` + `location` response is a redirect; anything else
 * is allowed.
 *
 * Throws if the route has no `id` — a route can't be authorized without one. If
 * the request fails, returns `onError`. Swap this resolver for any function with
 * the same signature to use a different transport or identifier.
 */
export function spaRoutingResolver(options: SpaRoutingResolverOptions): RouteAuthorizationResolver {
  const { applicationId, endpoint = "/__spa/route-decision", onError } = options;

  return async ({ route, params, request }) => {
    const routeId = route.id;
    if (routeId == null) {
      throw new Error(
        `spaRoutingResolver: route "${route.path ?? "(index)"}" has no \`id\`, so it ` +
          "cannot be authorized. Set an `id` on every route you route through " +
          "withRouteAuthorization.",
      );
    }

    const query = new URLSearchParams({ applicationId, routeId });
    for (const [name, value] of Object.entries(params)) {
      query.set(`parameters.${name}`, value);
    }

    try {
      const response = await fetch(`${endpoint}?${query}`, {
        headers: { Accept: "application/json" },
        signal: request.signal,
      });
      const { statusCode, location } = (await response.json()) as RouteDecisionResponse;
      return location != null && statusCode >= 300 && statusCode < 400
        ? { type: "redirect", location }
        : { type: "allow" };
    } catch {
      return onError;
    }
  };
}