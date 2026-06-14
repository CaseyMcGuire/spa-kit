# @spa-kit/react

Reusable React components and hooks. Components are styled with
[StyleX](https://stylexjs.com).

## Install

```bash
npm install @spa-kit/react react react-dom @stylexjs/stylex
```

`react`, `react-dom`, and `@stylexjs/stylex` are **peer dependencies**.

## Usage

```tsx
import { renderComponent } from "@spa-kit/react";

// Mount a tree into <div id="root"></div>
renderComponent(<h1>Hello</h1>);
```

## Required: compile this package's StyleX

This package ships **un-compiled** StyleX. Its `stylex.create`/`stylex.props`
calls throw at runtime until your build compiles them into your app's single
atomic CSS bundle. So your StyleX toolchain must be told to include this
package's files (in `node_modules`) alongside your own source.

The exact config depends on your setup:

**PostCSS plugin** (Next.js, etc.) — add the package glob to `include`:

```js
// postcss.config.js
module.exports = {
  plugins: {
    "@stylexjs/postcss-plugin": {
      include: [
        "src/**/*.{js,jsx,ts,tsx}",
        "node_modules/@spa-kit/react/dist/**/*.{js,cjs}",
      ],
    },
    autoprefixer: {},
  },
};
```

**Rollup / Vite plugin** — point `include` at the package:

```js
import stylexPlugin from "@stylexjs/rollup-plugin";

stylexPlugin({
  include: ["src/**/*.{js,jsx,ts,tsx}", "node_modules/@spa-kit/react/**"],
});
```

**Babel plugin** — make sure Babel transforms `node_modules/@spa-kit/react`
(by default Babel ignores `node_modules`, so add an override / `exclude` carve-out
for this package) and that `@stylexjs/babel-plugin` runs on it.

> If you skip this step you'll get an error like
> *"Unexpected 'stylex.create' call at runtime"* — that means the package's
> StyleX wasn't compiled.