# @spa-utils/react-relay

Reusable [Relay](https://relay.dev) helpers for React.

## Install

```bash
npm install @spa-utils/react-relay react react-dom react-relay relay-runtime graphql
```

`react`, `react-dom`, `react-relay`, `relay-runtime`, and `graphql` are **peer
dependencies**. `graphql-sse` (used for subscriptions) ships as a dependency.

## Usage

`createRelayEnvironment` wires up a Relay `Environment` with a fetch network for
queries/mutations and a [`graphql-sse`](https://github.com/enisdenjo/graphql-sse)
network for subscriptions.

```tsx
import { RelayEnvironmentProvider } from "react-relay";
import { createRelayEnvironment } from "@spa-utils/react-relay";

const environment = createRelayEnvironment({
  // Defaults to "/graphql" (and the same URL for subscriptions).
  endpoint: "/graphql",
  // Extra headers added to every request. Pass a function for fresh values
  // per request (e.g. a rotating auth or CSRF token).
  headers: () => ({ "X-CSRF-Token": readCsrfToken() }),
});

<RelayEnvironmentProvider environment={environment}>
  <App />
</RelayEnvironmentProvider>;
```

### Options

| Option | Default | Description |
| --- | --- | --- |
| `endpoint` | `"/graphql"` | URL for queries and mutations. |
| `subscriptionEndpoint` | `endpoint` | URL for SSE subscriptions. |
| `headers` | _none_ | Extra headers (object or `() => object`) added to every request. |
| `credentials` | `"include"` | Credentials mode applied to both fetch and SSE requests. |
| `fetch` | global `fetch` | Fetch implementation (e.g. for SSR, tests, interceptors). |
| `store` | fresh in-memory store | A prebuilt Relay `Store`, e.g. hydrated for SSR. |
| `gcReleaseBufferSize` | Relay default | GC release buffer size for the default store. |
| `sseClientOptions` | _none_ | Extra options forwarded to the `graphql-sse` client (`retryAttempts`, `lazy`, …). |