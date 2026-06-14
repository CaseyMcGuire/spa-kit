import { Suspense } from "react";
import type { ReactNode } from "react";
import { RelayEnvironmentProvider } from "react-relay";
import type { IEnvironment } from "relay-runtime";

export interface RelayRootProps {
  /** The Relay environment to provide. Build one with `createRelayEnvironment`. */
  environment: IEnvironment;
  /** Rendered while the subtree suspends. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Provides a Relay environment to its subtree and opens a Suspense boundary
 * for the Relay-driven content beneath it. Drop it at the root of a route,
 * page, or any subtree that issues Relay queries.
 *
 * @example
 * <RelayRoot environment={environment} fallback={<Spinner />}>
 *   <Page />
 * </RelayRoot>
 */
export function RelayRoot({ environment, fallback, children }: RelayRootProps) {
  return (
    <RelayEnvironmentProvider environment={environment}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </RelayEnvironmentProvider>
  );
}