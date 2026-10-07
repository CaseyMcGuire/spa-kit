# @spa-kit/eslint-plugin

## 0.1.0

### Minor Changes

- Preserve the full generated parser context, including spa-routing 0.5.0's opaque
  route identity. Export `SpaRouteContext` and document generated context aliases on
  preload inputs, with independently inferred render resources.

  Add the opt-in `@spa-kit/require-preload-context` ESLint rule in the separate
  `@spa-kit/eslint-plugin` package. Require a parameter annotation for route preloads
  with inputs, while allowing zero-argument preloads. Support named and namespace
  imports, import aliases, and local immutable configurations and callbacks.
