---
"@spa-kit/react-router": minor
---

Remove the `createSpaRoutingBrowserRouter` function and
`CreateSpaRoutingBrowserRouterOptions` type. This is a breaking API removal.
For existing React Router route objects, compose `createBrowserRouter`,
`withRouteAuthorization`, and `spaRoutingResolver` directly. Generated
spa-routing definitions use `createSpaRouter` with authorization configured
separately.
