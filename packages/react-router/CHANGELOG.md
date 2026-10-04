# @spa-kit/react-router

## 0.1.0

### Minor Changes

- 0931090: Remove the `createSpaRoutingBrowserRouter` function and
  `CreateSpaRoutingBrowserRouterOptions` type. This is a breaking API removal.
  For existing React Router route objects, compose `createBrowserRouter`,
  `withRouteAuthorization`, and `spaRoutingResolver` directly. Generated
  spa-routing definitions use `createSpaRouter` with authorization configured
  separately.
- 0931090: Add `createSpaRouteAuthorization` as native middleware that can be registered
  once through `createSpaRouter`'s `sharedMiddleware`. The router supplies the
  matched generated route's application and route IDs through the exported
  `spaRouteContext`. Authorization runs before downstream middleware, loaders,
  actions, and rendering, with native redirects and navigation cancellation.

  Forward URL query values as `queryParameters.*` in `spaRoutingResolver`,
  preserving empty and repeated values alongside the existing path parameters.

- 0931090: Add `sharedMiddleware` to `createSpaRouter` options to register native React
  Router middleware once for all generated routes. Shared middleware runs after
  parameter validation and before route-specific middleware. Stop forcing the
  unnecessary Data Mode `future.v8_middleware` runtime flag.
- e08024f: Add `createSpaRouter` for generated spa-routing definitions, with exhaustive route
  configuration, inferred renderer path/query types, 400 errors for invalid declared
  values, and native React Router middleware, loaders, and actions. Authorization
  remains separately configured. Require React Router 7.9.3 or newer for middleware
  on initial navigation without loaders.

## 0.0.4

### Patch Changes

- Validate route decision responses against an explicit API contract. Allow only successful 2xx decisions, preserve valid redirects, and apply the configured `onError` decision to denial/error statuses and malformed responses instead of implicitly allowing navigation.

## 0.0.3

### Patch Changes

- b440969: Add `createSpaRoutingBrowserRouter`, the common composition in one call: a browser router whose routes are gated by `withRouteAuthorization` using the default `spaRoutingResolver`, with optional resolver, route-authorization, and browser-router configuration.
- 4d5c021: Harden route authorization: spaRoutingResolver now applies `onError` to non-2xx decision responses instead of failing open when their body is valid JSON, and rethrows aborted requests so a superseded navigation is never decided; withRouteAuthorization no longer starts a document redirect for an aborted navigation and throws loudly on leaf routes using `lazy`, whose lazy-provided `loader` React Router would otherwise silently ignore

## 0.0.2

### Patch Changes

- Internal restructure of source files (no API changes)

## 0.0.1

### Patch Changes

- Initial release of `@spa-kit/node` (build/server helpers, e.g. `getGraphqlSchema`
  and `compileRelay`) and `@spa-kit/react-router` (server-authorized navigation
  with a progress bar).
