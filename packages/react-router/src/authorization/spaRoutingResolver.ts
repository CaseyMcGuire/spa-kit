import type {
  RouteAuthorizationDecision,
  RouteAuthorizationResolver,
} from "./withRouteAuthorization.js";

export interface SpaRoutingResolverOptions {
  /** The spa-routing application id this bundle serves (AppSpaApplication.id). */
  applicationId: string;
  /** Decision endpoint. @default "/__spa/route-decision" */
  endpoint?: string;
  /** Fallback for transport failures or malformed responses, never valid server denials. */
  onError: RouteAuthorizationDecision;
}

/**
 * The default {@link RouteAuthorizationResolver}: asks the spa-routing decision
 * endpoint (`/__spa/route-decision`) whether a route is allowed, using the
 * route's `id` as the server route id and sending its path params
 * (`parameters.*`) and URL query values (`queryString.*`, preserving repeats).
 * Semantic `allowed` decisions allow navigation. `denied`, `unknown_route`, and
 * `invalid_request` decisions redirect to their nonblank `destination`.
 *
 * Throws if the route has no `id` — a route can't be authorized without one. If
 * the request fails (network error, non-2xx response, or malformed body),
 * returns `onError`; a request aborted by a superseded navigation rethrows
 * instead of deciding. Swap this resolver for any function with the same
 * signature to use a different transport or identifier.
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
    for (const [name, value] of new URL(request.url).searchParams) {
      query.append(`queryString.${name}`, value);
    }

    try {
      const response = await fetch(`${endpoint}?${query}`, {
        headers: { Accept: "application/json" },
        signal: request.signal,
      });

      if (!response.ok) {
        return onError;
      }

      const body: unknown = await response.json();
      if (!isRouteDecisionResponse(body)) {
        return onError;
      }

      return body;
    } catch (error) {
      // An aborted navigation is not a failed decision: rethrow so React
      // Router discards the superseded load instead of applying `onError`.
      if (request.signal.aborted) {
        throw error;
      }
      return onError;
    }
  };
}

function isRouteDecisionResponse(body: unknown): body is RouteAuthorizationDecision {
  if (body == null || typeof body !== "object") {
    return false;
  }

  const { type, destination } = body as Record<string, unknown>;
  switch (type) {
    case "allowed":
      return true;
    case "denied":
    case "unknown_route":
    case "invalid_request":
      return typeof destination === "string" && destination.trim().length > 0;
    default:
      return false;
  }
}
