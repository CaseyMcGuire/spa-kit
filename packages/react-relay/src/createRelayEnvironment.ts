import { Environment, Network, Observable, RecordSource, Store } from "relay-runtime";
import type {
  FetchFunction,
  GraphQLResponse,
  SubscribeFunction,
} from "relay-runtime";
import { createClient } from "graphql-sse";
import type { Client, ClientOptions } from "graphql-sse";

/**
 * Extra headers added to every request. Pass a function to compute fresh
 * headers per request (e.g. a rotating auth or CSRF token).
 */
export type HeadersProvider =
  | Record<string, string>
  | (() => Record<string, string>);

export interface CreateRelayEnvironmentOptions {
  /** Endpoint for queries and mutations. Defaults to `"/graphql"`. */
  endpoint?: string;
  /** Endpoint for SSE subscriptions. Defaults to `endpoint`. */
  subscriptionEndpoint?: string;
  /** Extra headers added to every fetch and subscription request. */
  headers?: HeadersProvider;
  /**
   * Credentials mode applied to both fetch and SSE requests.
   * Defaults to `"include"`.
   */
  credentials?: RequestCredentials;
  /** Fetch implementation to use. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /**
   * A prebuilt Relay {@link Store} (e.g. hydrated for SSR). Takes precedence
   * over `gcReleaseBufferSize`. Defaults to a fresh in-memory store.
   */
  store?: Store;
  /** GC release buffer size for the default store. Ignored when `store` is set. */
  gcReleaseBufferSize?: number;
  /** Extra options forwarded to the `graphql-sse` client. */
  sseClientOptions?: Partial<ClientOptions>;
}

const DEFAULT_ENDPOINT = "/graphql";

function resolveHeaders(headers?: HeadersProvider): Record<string, string> {
  return typeof headers === "function" ? headers() : (headers ?? {});
}

function createFetch(
  endpoint: string,
  fetchImpl: typeof fetch,
  credentials: RequestCredentials,
  headers?: HeadersProvider,
): FetchFunction {
  return (operation, variables) =>
    fetchImpl(endpoint, {
      method: "POST",
      credentials,
      headers: {
        "Content-Type": "application/json",
        ...resolveHeaders(headers),
      },
      body: JSON.stringify({
        query: operation.text,
        variables,
      }),
    }).then((response) => response.json());
}

function createSubscribe(client: Client): SubscribeFunction {
  return (operation, variables) =>
    Observable.create<GraphQLResponse>((sink) => {
      return client.subscribe(
        {
          operationName: operation.name,
          query: operation.text ?? "",
          variables,
        },
        {
          next: (value) => sink.next(value as GraphQLResponse),
          complete: () => sink.complete(),
          error: (err) => sink.error(err instanceof Error ? err : new Error(String(err))),
        },
      );
    });
}

/**
 * Create a Relay {@link Environment} backed by an in-memory store, a fetch
 * network for queries/mutations, and a `graphql-sse` network for subscriptions.
 *
 * @example
 * const environment = createRelayEnvironment({
 *   headers: () => ({ "X-CSRF-Token": readToken() }),
 * });
 */
export function createRelayEnvironment(
  options: CreateRelayEnvironmentOptions = {},
): Environment {
  const {
    endpoint = DEFAULT_ENDPOINT,
    subscriptionEndpoint = endpoint,
    headers,
    credentials = "include",
    fetch: fetchImpl = fetch,
    store,
    gcReleaseBufferSize,
    sseClientOptions,
  } = options;

  const sseClient = createClient({
    ...sseClientOptions,
    url: subscriptionEndpoint,
    credentials,
    headers: () => resolveHeaders(headers),
  });

  return new Environment({
    network: Network.create(
      createFetch(endpoint, fetchImpl, credentials, headers),
      createSubscribe(sseClient),
    ),
    store:
      store ??
      new Store(
        new RecordSource(),
        gcReleaseBufferSize != null ? { gcReleaseBufferSize } : undefined,
      ),
  });
}