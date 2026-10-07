import { redirect, redirectDocument } from "react-router";
import type { RouteAuthorizationOptions } from "./withRouteAuthorization.js";

/** Central redirect seam for route decisions, including server failure destinations. */
export function routeAuthorizationRedirect(
  destination: string,
  mode: RouteAuthorizationOptions["redirectMode"],
): Response {
  return mode === "router" ? redirect(destination) : redirectDocument(destination);
}
