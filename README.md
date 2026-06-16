# spa-kit

A monorepo of reusable React components and utility functions shared across projects.

## Packages

| Package | Description |
| --- | --- |
| [`@spa-kit/utils`](./packages/utils) | Framework-agnostic utility functions |
| [`@spa-kit/react`](./packages/react) | React components and hooks |
| [`@spa-kit/react-relay`](./packages/react-relay) | Reusable Relay helpers for React |
| [`@spa-kit/react-router`](./packages/react-router) | Server-authorized navigation + progress bar for React Router |
| [`@spa-kit/node`](./packages/node) | Node-side (build/server) helpers, e.g. GraphQL schema combining |

## Tooling

- **npm workspaces** — manages the packages under `packages/*`
- **TypeScript** (project references) — shared base config in `tsconfig.base.json`
- **tsup** — bundles each package to ESM + CJS + type declarations
- **Vitest** + Testing Library — tests live next to source as `*.test.ts(x)`
- **Changesets** — versioning and publishing to npm

## Common commands

```bash
npm install            # install all workspace dependencies
npm run build          # build every package
npm test               # run all tests once
npm run test:watch     # run tests in watch mode
npm run typecheck      # type-check all packages via project references
```

## Adding a new package

1. Create `packages/<name>/` with a `package.json` named `@spa-kit/<name>`.
2. Copy `tsconfig.json` and `tsup.config.ts` from an existing package.
3. Add a reference to it in the root `tsconfig.json`.
4. Run `npm install` to wire up the workspace.

## Releasing

```bash
npm run changeset          # record what changed
npm run version-packages   # bump versions + changelogs
npm run release            # build + publish to npm
```