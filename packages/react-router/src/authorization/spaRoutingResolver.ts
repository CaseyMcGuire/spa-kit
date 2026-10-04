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
   * The decision to apply when the request fails, the body is malformed, or
   * the returned statusCode is neither a 2xx success nor a valid 3xx redirect.
   * Required — rather than silently allowing or throwing, you choose:
   * `{ type: "allow" }` to let navigation proceed even for denial/error
   * decisions (data is still gated server-side), or
   * `{ type: "redirect", location }` to send the user somewhere
   * (e.g. an error or login page).
   */
  onError: RouteAuthorizationDecision;
}

/** JSON contract of the spa-routing decision endpoint. */
interface RouteDecisionResponse {
  statusCode: number;
  location?: string | null;
}

/**
 * The default {@link RouteAuthorizationResolver}: asks the spa-routing decision
 * endpoint (`/__spa/route-decision`) whether a route is allowed, using the
 * route's `id` as the server route id and sending its path params
 * (`parameters.*`) and URL query values (`queryString.*`, preserving repeats).
 * An integer `2xx` statusCode allows navigation; an integer
 * `3xx` with a nonblank string `location` redirects. Other decisions return
 * `onError`, including denial/error statuses and malformed bodies.
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

      return toRouteAuthorizationDecision(body) ?? onError;
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

function isRouteDecisionResponse(body: unknown): body is RouteDecisionResponse {
  if (body == null || typeof body !== "object") {
    return false;
  }

  const { statusCode, location } = body as Record<string, unknown>;
  return (
    typeof statusCode === "number" &&
    Number.isInteger(statusCode) &&
    (location == null || typeof location === "string")
  );
}

/** Map supported decisions; return undefined when the caller must apply its fallback. */
function toRouteAuthorizationDecision({
  statusCode,
  location,
}: RouteDecisionResponse): RouteAuthorizationDecision | undefined {
  if (statusCode >= 200 && statusCode < 300) {
    return { type: "allow" };
  }

  if (
    statusCode >= 300 &&
    statusCode < 400 &&
    location != null &&
    location.trim().length > 0
  ) {
    return { type: "redirect", location };
  }

  return undefined;
}
