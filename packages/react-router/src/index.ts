export { createSpaRouter } from "./routing/createSpaRouter.js";
export type {
  SpaRouteDefinition,
  SpaRouteConfig,
  SpaRouterConfig,
  CreateSpaRouterOptions,
} from "./routing/createSpaRouter.js";
export { spaRouteContext } from "./routing/spaRouteContext.js";
export type { SpaRouteIdentity } from "./routing/spaRouteContext.js";
export { createSpaRouteAuthorization } from "./authorization/createSpaRouteAuthorization.js";
export type { CreateSpaRouteAuthorizationOptions } from "./authorization/createSpaRouteAuthorization.js";
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
