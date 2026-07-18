---
"@spa-kit/react-router": patch
---

Harden route authorization: spaRoutingResolver now applies `onError` to non-2xx decision responses instead of failing open when their body is valid JSON, and rethrows aborted requests so a superseded navigation is never decided; withRouteAuthorization no longer starts a document redirect for an aborted navigation and throws loudly on leaf routes using `lazy`, whose lazy-provided `loader` React Router would otherwise silently ignore