export { createSpaRouter } from "./routing/createSpaRouter.js";
export type {
  SpaRouteDefinition,
  SpaRouteConfig,
  SpaRouteContext,
  SpaRouterConfig,
  CreateSpaRouterOptions,
} from "./routing/createSpaRouter.js";
export { spaRouteContext } from "./routing/spaRouteContext.js";
export type { SpaRouteIdentity } from "./routing/spaRouteContext.js";
export { createSpaRouteDecisionMiddleware } from "./authorization/createSpaRouteDecisionMiddleware.js";
export type { CreateSpaRouteDecisionMiddlewareOptions } from "./authorization/createSpaRouteDecisionMiddleware.js";
export { withRouteAuthorization } from "./authorization/withRouteAuthorization.js";
export type {
  RouteAuthorizationDecision,
  RouteAuthorizationResolver,
  RouteAuthorizationOptions,
} from "./authorization/withRouteAuthorization.js";
export { spaRoutingResolver } from "./authorization/spaRoutingResolver.js";
export type { SpaRoutingResolverOptions } from "./authorization/spaRoutingResolver.js";
export { NavigationProgress, useNavigationPending } from "./components/NavigationProgress.js";
export type { NavigationProgressProps } from "./components/NavigationProgress.js";

export { useSpaNavigate } from "./navigation/useSpaNavigate.js";
export type { SpaNavigateFunction, SpaNavigateOptions } from "./navigation/useSpaNavigate.js";
export type { RouteTarget } from "./navigation/routeTarget.js";
export { default as SpaLink } from "./navigation/SpaLink.js";
export type { SpaLinkProps } from "./navigation/SpaLink.js";
