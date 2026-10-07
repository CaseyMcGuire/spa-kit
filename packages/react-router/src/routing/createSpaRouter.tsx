import type { ReactNode } from "react";
import { createBrowserRouter, useLocation, useParams } from "react-router";
import type { MiddlewareFunction, NonIndexRouteObject } from "react-router";
import { createPreloadLifecycle } from "./preloadLifecycle.js";
import { spaRouteContext } from "./spaRouteContext.js";

/** The metadata and parser exposed by a generated spa-routing route builder. */
export interface SpaRouteDefinition {
  readonly path: string;
  readonly applicationId: string;
  readonly routeId: string;
  /** Whether SPA navigation requires the server route-access handler. */
  readonly hasAccessHandler: boolean;
  parse(
    params: Readonly<Record<string, string | undefined>>,
    search: URLSearchParams,
  ): { params: object; queryString: object } | null;
}

type ParsedRoute<TRoute extends SpaRouteDefinition> = NonNullable<ReturnType<TRoute["parse"]>>;

/** Full generated parser result, including its compile-time route identity. */
export type SpaRouteContext<TRoute extends SpaRouteDefinition> = ParsedRoute<TRoute>;

/**
 * Configure a generated route's renderer and native React Router behavior.
 * Paths and IDs come from the generated definition. Routes are flat; rendering
 * is supplied by `render`, so `children`, `index`, and `lazy` are not supported.
 * `preload` and `render` receive the generated context; loaders/actions/middleware retain
 * their native React Router signatures.
 */
export type SpaRouteConfig<TRoute extends SpaRouteDefinition, TPreload = never> = Omit<
  NonIndexRouteObject,
  "id" | "path" | "index" | "children" | "element" | "Component" | "lazy"
> & {
  preload?: (context: SpaRouteContext<TRoute>) => TPreload;
  render: (context: NoInfer<SpaRouteContext<TRoute> &
    (unknown extends TPreload ? {} : [TPreload] extends [never] ? {} : { preload: TPreload })>) => ReactNode;
};

/** Every generated route requires a configuration and a renderer. */
export type SpaRouterConfig<
  TRoutes extends Record<string, SpaRouteDefinition>,
  TPreloads extends Record<keyof TRoutes, unknown> = Record<keyof TRoutes, never>,
> = {
  [Key in keyof TPreloads]-?: Key extends keyof TRoutes ? SpaRouteConfig<TRoutes[Key], TPreloads[Key]> : never;
};

type BrowserRouterOptions = NonNullable<Parameters<typeof createBrowserRouter>[1]>;

/** Browser router options plus middleware shared by all generated routes. */
export type CreateSpaRouterOptions = BrowserRouterOptions & {
  /** Runs after parameter validation and before each route's own middleware. */
  sharedMiddleware?: readonly MiddlewareFunction[];
};

/**
 * Create a browser Data Router from generated spa-routing route builders.
 * Renderer arguments are inferred from each builder's `parse` return type;
 * route keys are inferred only from `routes`, so missing configurations fail
 * type checking. Missing/unknown keys and missing renderers also throw at runtime.
 *
 * Invalid declared path/query values produce a 400 route error before user
 * middleware, loaders, or actions run. Renderers receive the parser's filtered,
 * decoded values for the current location, including query-only navigations.
 * Use `ErrorBoundary` or `errorElement` to customize route errors.
 *
 * Shared middleware runs on every generated route, before its own middleware.
 * The matched generated identity is available through `spaRouteContext`.
 * Middleware uses native React Router signatures without built-in authorization.
 * The returned router can be passed directly to `<RouterProvider>`.
 */
export function createSpaRouter<
  TRoutes extends Record<string, SpaRouteDefinition>,
  TPreloads extends Record<keyof TRoutes, unknown> = Record<keyof TRoutes, never>,
>(
  routes: TRoutes,
  config: SpaRouterConfig<NoInfer<TRoutes>, TPreloads>,
  options: CreateSpaRouterOptions = {},
): ReturnType<typeof createBrowserRouter> {
  const { sharedMiddleware = [], dataStrategy, ...routerOptions } = options;
  const preloads = createPreloadLifecycle();

  for (const key of Object.keys(config)) {
    if (!Object.prototype.hasOwnProperty.call(routes, key)) {
      throw new Error(`createSpaRouter: unknown route configuration "${key}".`);
    }
  }

  const routeObjects = Object.keys(routes).map((key) => {
    if (!Object.prototype.hasOwnProperty.call(config, key) || typeof config[key]?.render !== "function") {
      throw new Error(`createSpaRouter: route "${key}" requires a render function.`);
    }

    return createRouteObject(routes[key]!, config[key]! as unknown as SpaRouteConfig<SpaRouteDefinition, unknown>, sharedMiddleware, preloads);
  });

  const router = createBrowserRouter(routeObjects, {
    ...routerOptions,
    dataStrategy: preloads.wrapStrategy(dataStrategy),
  });
  preloads.attach(router);
  return router;
}

function createRouteObject<TRoute extends SpaRouteDefinition>(
  route: TRoute,
  config: SpaRouteConfig<TRoute, unknown>,
  sharedMiddleware: readonly MiddlewareFunction[],
  preloads: ReturnType<typeof createPreloadLifecycle>,
): NonIndexRouteObject {
  const { render, preload, middleware = [], ...routeOptions } = config;

  function RouteRenderer() {
    const params = useParams();
    const location = useLocation();
    // Read the current URL independently of loader data: shouldRevalidate may
    // skip loaders even when query values change. Never decode path values twice.
    const parsed = parseRoute(route, params, new URLSearchParams(location.search));
    return <>{render({ ...parsed, ...(preload ? { preload: preloads.value(route.routeId) } : {}) } as SpaRouteContext<TRoute> & { preload: unknown })}</>;
  }

  return {
    ...routeOptions,
    id: route.routeId,
    path: route.path,
    Component: RouteRenderer,
    hydrateFallbackElement: routeOptions.hydrateFallbackElement
      ?? (routeOptions.HydrateFallback ? undefined : <></>),
    middleware: [
      (args) => {
        const { params, request, context } = args;
        const parsed = parseRoute(route, params, new URL(request.url).searchParams);
        context.set(spaRouteContext, { applicationId: route.applicationId, routeId: route.routeId, hasAccessHandler: route.hasAccessHandler });
        if (preload) {
          preloads.start(args, route.routeId, () => preload(parsed));
        }
      },
      ...sharedMiddleware,
      ...middleware,
    ],
  };
}

function parseRoute<TRoute extends SpaRouteDefinition>(
  route: TRoute,
  params: Readonly<Record<string, string | undefined>>,
  search: URLSearchParams,
): ParsedRoute<TRoute> {
  const parsed = route.parse(params, search);
  if (parsed === null) {
    throw new Response(`Invalid parameters for route "${route.routeId}".`, {
      status: 400,
      statusText: "Bad Request",
    });
  }

  // Preserve the concrete generated parser's return type across the constraint.
  return parsed as ParsedRoute<TRoute>;
}
