# @spa-kit/react-router

Typed routing and server-authorized client navigation for
[React Router](https://reactrouter.com) (v7 data router), plus a top progress bar
for the wait.

## Install

```bash
npm install @spa-kit/react-router react react-dom react-router
```

`react`, `react-dom`, and `react-router` (v7.9.3+) are **peer dependencies**.

## Typed routing from generated routes

`createSpaRouter` creates a browser Data Router from spa-routing's generated
route builders. Parsers must return `{ params, queryString }`. Regenerate routes
with a spa-routing version that emits `parse(params, searchParams)` on each
builder. TypeScript 5.4+ is required.

```tsx
import { RouterProvider } from "react-router";
import { createSpaRouter } from "@spa-kit/react-router";
import { WikiRoutes } from "./generated/WikiRoutes";

const router = createSpaRouter(WikiRoutes, {
  Index: {
    render: () => <WikiIndex />,
  },
  View: {
    render: (params, queryString) => (
      <WikiView wikiId={params.wikiId} tab={queryString.tab} />
    ),
  },
  Edit: {
    render: (params) => <WikiEditor wikiId={params.wikiId} />,
  },
});

export default function App() {
  return <RouterProvider router={router} />;
}
```

Every generated key requires a configuration with a `render` callback. In this
example, `params.wikiId` is `string` and `queryString.tab` is `string | undefined`;
accessing undeclared parameters or omitting `Edit` is a compile error. Optional
path values remain optional, and repeated queries are `readonly string[]`
(possibly `undefined` when optional). Renderers return React content; put hooks
in the components they render.

Paths and route IDs come from the generated definitions. Each configuration can
also supply native React Router options such as `middleware`, `loader`, `action`,
`shouldRevalidate`, `ErrorBoundary`, and `HydrateFallback`. Those handlers retain
React Router's own argument types. Routes are flat: `children`, `index`, `lazy`,
`path`, `id`, `Component`, and `element` are not configuration options.

The generated parser validates declared values before user middleware, loaders,
or actions run. A `null` parser result becomes a 400 route error, handled by
`ErrorBoundary` or `errorElement`. Renderers receive only declared values from
the current URL, even when a query-only navigation skips loader revalidation.
Path values are already decoded by React Router and are passed through as-is.
Until initial middleware/loaders finish, the router renders nothing unless a
`HydrateFallback` or `hydrateFallbackElement` is configured.

The optional third argument forwards browser router options, for example
`createSpaRouter(WikiRoutes, config, { basename: "/app" })`. No runtime
`future.v8_middleware` flag is needed in Data Mode. As with native React Router,
a custom `dataStrategy` must run route middleware. To type middleware context
in your loaders/actions, add the following application-level declaration:

```ts
import "react-router";

declare module "react-router" {
  interface Future {
    v8_middleware: true;
  }
}
```

Authorization is configured separately. `createSpaRouter` makes no authorization
requests itself. Register ordinary middleware once for all generated routes with
`sharedMiddleware` in the third argument:

```tsx
const router = createSpaRouter(WikiRoutes, routeConfig, {
  sharedMiddleware: [authMiddleware],
});
```

Here, `authMiddleware` is a separately supplied React Router middleware function.
Omit `sharedMiddleware` when no shared behavior is needed. Shared middleware uses
React Router's native arguments, including `request`, `params`, and `context`;
only `render` receives generated parameter and query types.

Execution order is parameter validation, shared middleware in array order,
route-specific middleware in array order, then the loader or action. Code after
`await next()` runs in reverse order. Shared middleware also runs on initial
navigation without loaders and on query-only navigations that skip loader
revalidation. It follows React Router's middleware lifecycle, including the
loader revalidation after an action. Redirects prevent downstream handlers from
running, and errors use the matched route's error boundary.

Individual routes can also configure their own middleware:

```tsx
View: {
  middleware: [async ({ request }, next) => {
    console.log("Navigating to", request.url);
    await next();
  }],
  render: (params, queryString) => (
    <WikiView wikiId={params.wikiId} tab={queryString.tab} />
  ),
},
```

Run the router's runtime and compiler tests with:

```bash
npm test -- packages/react-router/src/routing/createSpaRouter.test.tsx
npm run typecheck:test --workspace @spa-kit/react-router
```

## Authorizing routes

> This guards the *navigation* (don't render a route the user can't see; redirect
> cleanly). It is **not** a security boundary — your API must still authorize the
> underlying data server-side.

### Shared authorization middleware

Create the authorization middleware once and register it with `sharedMiddleware`:

```tsx
import { createSpaRouter, createSpaRouteAuthorization } from "@spa-kit/react-router";

const authMiddleware = createSpaRouteAuthorization({
  onError: { type: "redirect", location: "/error" },
});

const router = createSpaRouter(WikiRoutes, routeConfig, {
  sharedMiddleware: [authMiddleware],
});
```

`createSpaRouter` supplies the matched generated route's `applicationId` and
`routeId` through `spaRouteContext`, after parameter validation and before shared
middleware runs. The authorization middleware reads those identifiers and sends
the matched path parameters and all URL query values to `/__spa/route-decision`.
There is no per-route authorization configuration or second route lookup, and
the router's `basename` needs no separate authorization configuration.

An allow decision continues to subsequent middleware, loaders, and actions. A
redirect decision prevents them from running. Requests are cancelled with the
navigation, and a late decision cannot redirect or continue an aborted request.

`createSpaRouteAuthorization` accepts:

- **`onError`** — required fallback decision for failed requests, malformed
  responses, or denial statuses. See the default resolver below.
- **`endpoint`** — decision endpoint; defaults to `/__spa/route-decision`.
- **`redirectMode`** — `"document"` (default) uses React Router's
  `redirectDocument`; `"router"` uses `redirect` for client-side navigation.
  Client-side redirect destinations go through the same authorization check.

With native React Router route objects, a preceding middleware can set
`context.set(spaRouteContext, WikiRoutes.View)` using the exported
`spaRouteContext`. Missing route identity throws a configuration error before
requesting authorization, even when `onError` allows access.

### Loader-based authorization for route objects

`withRouteAuthorization` wraps each **leaf** route so a page navigation is checked
before that leaf's loader runs. The default resolver, `spaRoutingResolver`,
identifies each route to the server by its React Router `id` (so set one on every
route).

For existing React Router route objects, compose the router and authorization
APIs directly:

```tsx
import { createBrowserRouter } from "react-router";
import { withRouteAuthorization, spaRoutingResolver } from "@spa-kit/react-router";

const routes = [
  { id: "Home", path: "/", Component: Home },
  { id: "Assets", path: "/assets", Component: Assets },
  { id: "AssetDetail", path: "/assets/:id", Component: AssetDetail },
];

const router = createBrowserRouter(
  withRouteAuthorization(
    routes,
    spaRoutingResolver({ applicationId: "app", onError: { type: "redirect", location: "/error" } }),
  ),
);
```

Pass a custom `endpoint` to `spaRoutingResolver`, `redirectMode` in the third
argument to `withRouteAuthorization`, and browser options such as `basename`
in the second argument to `createBrowserRouter`.

`withRouteAuthorization(routes, resolve, options?)`:

- **`resolve`** — a `RouteAuthorizationResolver`: given the matched
  `{ route, params, request }`, returns a `RouteAuthorizationDecision` —
  `{ type: "allow" }` or `{ type: "redirect", location }`. Composes with each
  route's own `loader`.
- **`options.redirectMode`** — how a redirect is performed:
  - `"document"` (default): full-document `window.location.assign`, for targets
    server-rendered outside the SPA.
  - `"router"`: a React Router `redirect(...)`, for client-side route targets.

The check is attached to each **leaf** route (one with no children), which
authorizes itself with its own route and React Router's matched params — so a
navigation yields a single check at its terminal route. How a route is identified
is the resolver's call (`spaRoutingResolver` uses `route.id` and throws if it's
missing). Note: a parent route navigable at its own path with no index child
isn't a leaf, so a direct visit to it isn't gated.

> **Parent/layout loaders aren't gated.** `withRouteAuthorization` gates only the
> **leaf** loaders it wraps; the check runs before a leaf's own loader. It does
> **not** gate parent/layout loaders — React Router runs a match's loaders in
> parallel, so a parent loader runs concurrently with the leaf's check, not after
> it. If a parent/layout route loads sensitive data, it must authorize that data
> itself (server-side); the route guard won't cover it.

### The default resolver

`spaRoutingResolver` is the batteries-included `resolve` for the spa-routing
decision endpoint:

```
GET /__spa/route-decision?applicationId=app&routeId=AssetDetail&parameters.id=123
→ { "statusCode": 200 }
→ { "statusCode": 302, "location": "/login" }
```

Path values are sent as `parameters.*`. URL query values are sent as
`queryString.*`, including undeclared, empty, and repeated values.

The JSON decision's integer `statusCode` determines the result: `2xx` allows
navigation, and `3xx` redirects when `location` is a nonblank string. Other
decisions (including `403`, `404`, `500`, a missing or invalid `statusCode`, or
a redirect without a valid location) return the required `onError` decision,
even when the endpoint's HTTP response is `200`.

Request failures (network errors, non-2xx HTTP responses, or invalid JSON) also
return `onError`. Choose `{ type: "redirect", location }` to send the user to a
fallback (e.g. an error or login page). Choosing `{ type: "allow" }` explicitly
lets navigation through even for denial/error decisions; data authorization
must still be enforced server-side.

### A custom resolver

Any function with the `RouteAuthorizationResolver` signature works — REST
elsewhere, a Relay query, your own identifier instead of `route.id`, etc.:

```ts
withRouteAuthorization(routes, async ({ route, params }) => {
  const allowed = await myCheck(route.id, params);
  return allowed ? { type: "allow" } : { type: "redirect", location: "/login" };
});
```

## Progress indicator

`<NavigationProgress />` shows a top bar while a navigation is pending — only
after a short delay, so instant checks don't flash. Render it once inside your
router. `useNavigationPending(delay)` exposes the boolean if you'd rather render
your own.
