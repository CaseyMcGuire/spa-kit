---
"@spa-kit/react-router": minor
---

Add `sharedMiddleware` to `createSpaRouter` options to register native React
Router middleware once for all generated routes. Shared middleware runs after
parameter validation and before route-specific middleware. Stop forcing the
unnecessary Data Mode `future.v8_middleware` runtime flag.
