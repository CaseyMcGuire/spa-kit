# @spa-kit/node

Node-side (build- and server-time) helpers for SPA projects. **Not for the
browser** — these modules use Node built-ins like `fs`.

## Install

```bash
npm install -D @spa-kit/node graphql
```

`graphql` (v16) is a **peer dependency**.

## `getGraphqlSchema(schemaDirectory)`

Recursively combines every `*.graphql` file under `schemaDirectory` into one
printed schema (SDL). Tools like DGS let you split a schema across many files;
Relay's compiler expects a single schema, so this glues them back together.

```ts
import { fileURLToPath } from "node:url";
import { getGraphqlSchema } from "@spa-kit/node";

const schemaDir = fileURLToPath(new URL("./src/main/resources/schema", import.meta.url));
const sdl = getGraphqlSchema(schemaDir);
```

Typical use is a small script that writes the combined SDL to a file your
`relay.config.js` points at as its `schema`.

## `compileRelay(options)`

Combines your split schema, runs the Relay compiler against it, then removes the
transient schema file. Throws if compilation fails, so a broken schema fails
your build (and CI) loudly.

```ts
import { compileRelay } from "@spa-kit/node";

compileRelay({
  schemaDirectory: "src/main/resources/schema",
  schemaOutputFile: "src/main/resources/relay/schema.graphql", // matches relay.config `schema`
});
```

| Option | Default | Description |
| --- | --- | --- |
| `schemaDirectory` | — | Directory of split `*.graphql` files to combine. |
| `schemaOutputFile` | — | Where the combined schema is written; must match your `relay.config` `schema`. |
| `command` | `"relay-compiler"` | Compiler command. Bare, it reads your `relay.config`; override for e.g. `relay-compiler --validate`. |
| `cleanup` | `true` | Delete the written schema file afterward (on success or failure). |

`relay-compiler` must be installed and runnable on `PATH` — typically by calling
this from an npm script.