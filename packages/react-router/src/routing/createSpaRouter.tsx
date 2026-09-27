import type { ReactNode } from "react";
import { createBrowserRouter, useLocation, useParams } from "react-router";
import type { NonIndexRouteObject } from "react-router";

/** The metadata and parser exposed by a generated spa-routing route builder. */
export interface SpaRouteDefinition {
  readonly path: string;
  readonly applicationId: string;
  readonly routeId: string;
  parse(
    params: Readonly<Record<string, string | undefined>>,
    search: URLSearchParams,
  ): { params: object; query: object } | null;
}

type ParsedRoute<TRoute extends SpaRouteDefinition> = NonNullable<ReturnType<TRoute["parse"]>>;

/**
 * Configure a generated route's renderer and native React Router behavior.
 * Paths and IDs come from the generated definition. Routes are flat; rendering
 * is supplied by `render`, so `children`, `index`, and `lazy` are not supported.
 * Only `render` receives the generated types; loaders/actions/middleware retain
 * their native React Router signatures.
 */
export type SpaRouteConfig<TRoute extends SpaRouteDefinition> = Omit<
  NonIndexRouteObject,
  "id" | "path" | "index" | "children" | "element" | "Component" | "lazy"
> & {
  render: (
    params: ParsedRoute<TRoute>["params"],
    query: ParsedRoute<TRoute>["query"],
  ) => ReactNode;
};

/** Every generated route requires a configuration and a renderer. */
export type SpaRouterConfig<TRoutes extends Record<string, SpaRouteDefinition>> = {
  [Key in keyof TRoutes]-?: SpaRouteConfig<TRoutes[Key]>;
};

type BrowserRouterOptions = NonNullable<Parameters<typeof createBrowserRouter>[1]>;

/** Browser router options. Middleware is always enabled by `createSpaRouter`. */
export type CreateSpaRouterOptions = Omit<BrowserRouterOptions, "future"> & {
  future?: Omit<NonNullable<BrowserRouterOptions["future"]>, "v8_middleware"> & {
    v8_middleware?: true;
  };
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
 * Native route middleware is supported without any built-in authorization.
 * The returned router can be passed directly to `<RouterProvider>`.
 */
export function createSpaRouter<TRoutes extends Record<string, SpaRouteDefinition>>(
  routes: TRoutes,
  config: SpaRouterConfig<NoInfer<TRoutes>>,
  options: CreateSpaRouterOptions = {},
): ReturnType<typeof createBrowserRouter> {
  for (const key of Object.keys(config)) {
    if (!Object.prototype.hasOwnProperty.call(routes, key)) {
      throw new Error(`createSpaRouter: unknown route configuration "${key}".`);
    }
  }

  const routeObjects = Object.keys(routes).map((key) => {
    if (!Object.prototype.hasOwnProperty.call(config, key) || typeof config[key]?.render !== "function") {
      throw new Error(`createSpaRouter: route "${key}" requires a render function.`);
    }

    return createRouteObject(routes[key]!, config[key]!);
  });

  return createBrowserRouter(routeObjects, {
    ...options,
    future: { ...options.future, v8_middleware: true },
  });
}

function createRouteObject<TRoute extends SpaRouteDefinition>(
  route: TRoute,
  config: SpaRouteConfig<TRoute>,
): NonIndexRouteObject {
  const { render, middleware = [], ...routeOptions } = config;

  function RouteRenderer() {
    const params = useParams();
    const location = useLocation();
    // Read the current URL independently of loader data: shouldRevalidate may
    // skip loaders even when query values change. Never decode path values twice.
    const parsed = parseRoute(route, params, new URLSearchParams(location.search));
    return <>{render(parsed.params, parsed.query)}</>;
  }

  return {
    ...routeOptions,
    id: route.routeId,
    path: route.path,
    Component: RouteRenderer,
    hydrateFallbackElement: routeOptions.hydrateFallbackElement
      ?? (routeOptions.HydrateFallback ? undefined : <></>),
    middleware: [
      ({ params, request }) => {
        parseRoute(route, params, new URL(request.url).searchParams);
      },
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
