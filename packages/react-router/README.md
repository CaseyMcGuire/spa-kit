# @spa-kit/react-router

Server-authorized client navigation for [React Router](https://reactrouter.com)
(v7 data router), plus a top progress bar for the wait.

## Install

```bash
npm install @spa-kit/react-router react react-dom react-router
```

`react`, `react-dom`, and `react-router` (v7+) are **peer dependencies**.

> This guards the *navigation* (don't render a route the user can't see; redirect
> cleanly). It is **not** a security boundary — your API must still authorize the
> underlying data server-side.

## Authorizing routes

`withRouteAuthorization` wraps each **leaf** route so a page navigation is checked
before that leaf's loader runs. The default resolver, `spaRoutingResolver`,
identifies each route to the server by its React Router `id` (so set one on every
route).

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

If the request itself fails (network/server error), it returns the required
`onError` decision — there's no silent default, so you choose: `{ type: "allow" }`
to let navigation through (data is still gated server-side), or
`{ type: "redirect", location }` to send the user to a fallback (e.g. an error or
login page).

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