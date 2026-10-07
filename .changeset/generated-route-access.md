---
"@spa-kit/react-router": minor
---

Require generated `hasAccessHandler` metadata for shared route authorization.
Routes without access handlers skip the decision endpoint; application-level
access is assumed to have been established by the initial full-page load.

Consume semantic `allowed`, `denied`, `unknown_route`, and `invalid_request`
route decisions. Failure destinations always redirect, independently of the
transport-error fallback. Legacy status-code decision bodies are unsupported.
Regenerate route builders before upgrading.

Resolvers, middleware, and `onError` fallbacks now share the semantic decision
union. Replace `allow` with `allowed`, and `redirect`/`location` with a failure
type (`denied`, `unknown_route`, or `invalid_request`) and `destination`.

Rename `createSpaRouteAuthorization` to `createSpaRouteDecisionMiddleware` and
`CreateSpaRouteAuthorizationOptions` to `CreateSpaRouteDecisionMiddlewareOptions`.
The old exports are removed.
