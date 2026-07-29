# @spa-kit/react-router

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
