/** A resolved destination returned by a generated spa-routing route builder. */
export interface RouteTarget {
  readonly href: string;
  readonly applicationId: string;
  readonly routeId: string;
}
