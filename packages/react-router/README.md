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
route builders. Regenerate routes with a spa-routing version that emits
`parse(params, searchParams)` on each builder. TypeScript 5.4+ is required.

```tsx
import { RouterProvider } from "react-router";
import { createSpaRouter } from "@spa-kit/react-router";
import { WikiRoutes } from "./generated/WikiRoutes";

const router = createSpaRouter(WikiRoutes, {
  Index: {
    render: () => <WikiIndex />,
  },
  View: {
    render: (params, query) => (
      <WikiView wikiId={params.wikiId} tab={query.tab} />
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
example, `params.wikiId` is `string` and `query.tab` is `string | undefined`;
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
`createSpaRouter(WikiRoutes, config, { basename: "/app" })`. The helper always
sets `future.v8_middleware: true`. As with native React Router, a custom
`dataStrategy` must run route middleware. To type middleware context in your
loaders/actions, add the following application-level declaration:

```ts
import "react-router";

declare module "react-router" {
  interface Future {
    v8_middleware: true;
  }
}
```

Authorization is configured separately. `createSpaRouter` makes no authorization
requests; it accepts ordinary middleware on each route:

```tsx
View: {
  middleware: [async ({ request }, next) => {
    console.log("Navigating to", request.url);
    await next();
  }],
  render: (params, query) => (
    <WikiView wikiId={params.wikiId} tab={query.tab} />
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

`withRouteAuthorization` wraps each **leaf** route so a page navigation is checked
before that leaf's loader runs. The default resolver, `spaRoutingResolver`,
identifies each route to the server by its React Router `id` (so set one on every
route).

For the common setup, `createSpaRoutingBrowserRouter` performs the standard
composition in one call:

```tsx
import { createSpaRoutingBrowserRouter } from "@spa-kit/react-router";

const router = createSpaRoutingBrowserRouter(routes, {
  applicationId: "app",
  onError: { type: "redirect", location: "/500" },
});
```

It also accepts the default resolver's `endpoint`, `routeAuthorizationOptions`
forwarded to `withRouteAuthorization` (e.g. `redirectMode`), and `routerOptions`
forwarded to React Router's `createBrowserRouter`:

```tsx
const router = createSpaRoutingBrowserRouter(routes, {
  applicationId: "app",
  endpoint: "/custom/route-decision",
  onError: { type: "redirect", location: "/500" },
  routeAuthorizationOptions: { redirectMode: "router" },
  routerOptions: { basename: "/app" },
});
```

Use the primitives directly when you need a custom resolver or another router
flavor.

The equivalent explicit composition is:

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
