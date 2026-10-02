---
"@spa-kit/react-router": minor
---

Add `createSpaRouteAuthorization` as native middleware that can be registered
once through `createSpaRouter`'s `sharedMiddleware`. The router supplies the
matched generated route's application and route IDs through the exported
`spaRouteContext`. Authorization runs before downstream middleware, loaders,
actions, and rendering, with native redirects and navigation cancellation.

Forward URL query values as `queryParameters.*` in `spaRoutingResolver`,
preserving empty and repeated values alongside the existing path parameters.
