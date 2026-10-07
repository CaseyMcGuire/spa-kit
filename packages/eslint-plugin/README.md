# @spa-kit/eslint-plugin

Opt-in ESLint rules for spa-kit applications. This package is development tooling;
it does not add lint dependencies to `@spa-kit/react-router`.

## Setup

Install ESLint, a TypeScript parser, and the plugin as development dependencies:

```sh
npm install --save-dev eslint @typescript-eslint/parser @spa-kit/eslint-plugin
```

ESLint 9 and 10 are supported. Use a Node.js version supported by your ESLint release.

Add the rule to your flat configuration (`eslint.config.mjs`):

```js
import tsParser from "@typescript-eslint/parser";
import spaKit from "@spa-kit/eslint-plugin";

export default [
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "@spa-kit": spaKit },
    rules: {
      "@spa-kit/require-preload-context": "error",
    },
  },
];
```

If your configuration already selects a TypeScript parser, add only the plugin
and rule entries. Installing or registering the plugin does not enable the rule.
No TypeScript project or parser services are required.

## `require-preload-context`

Require a parameter type annotation on `preload` callbacks in route configurations
passed to `createSpaRouter` from `@spa-kit/react-router`. This preserves inference
of the preload return type in the sibling `render` callback.

```tsx
import { createSpaRouter } from "@spa-kit/react-router";
import { WikiRoutes } from "./generated/WikiRoutes";
import type { ViewContext } from "./generated/WikiRoutes";

createSpaRouter(WikiRoutes, {
  View: {
    preload: ({ params }: ViewContext) => loadQuery(environment, Query, {
      wikiId: params.wikiId,
    }),
    render: ({ preload }) => <ViewWikiPage queryRef={preload} />,
  },
  // Other generated routes omitted here.
});
```

These callbacks are reported:

```ts
preload: ({ params }) => loadQuery(/* ... */)
preload: context => prepare(context)
preload({ params }) { return prepare(params); }
```

These are accepted:

```ts
preload: ({ params }: ViewContext) => prepare(params)
preload(context: ViewContext) { return prepare(context.params); }
preload: () => prepareWithoutInputs()
```

The rule recognizes renamed imports and namespace imports, and follows local
`const` bindings for router aliases, configurations, route entries, and preload
functions. It also checks local function declarations and statically known object
spreads. Shadowed imports and unrelated functions named `createSpaRouter` are
ignored. Shared callbacks are reported only once per file.

The rule checks annotation presence, not the annotation's meaning. TypeScript
checks compatibility with the generated route context and resource types. A type
assertion on the function or a variable type does not replace the required
annotation on its parameter.

Imported callbacks/configurations, mutable bindings, dynamic property keys,
factory calls, and cross-file re-exports are not resolved. Keep the configuration
and annotated preload callback in the same file for enforcement. There are no
options and no autofix: selecting and importing the generated context type is an
application decision.
