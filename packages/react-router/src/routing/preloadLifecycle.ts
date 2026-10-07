import { createContext } from "react-router";
import type { DataStrategyFunction, DataStrategyFunctionArgs } from "react-router";

type Router = ReturnType<typeof import("react-router").createBrowserRouter>;

type PreloadEntry = {
  routeId: string;
  url: string;
  value: unknown;
  ready: boolean;
  release: () => void;
  detach: () => void;
};

type PreloadExecution = { entry?: PreloadEntry; navigation: boolean };
const executionContext = createContext<PreloadExecution | null>(null);

/** Own speculative values until navigation commits, then retain them for rendering. */
export function createPreloadLifecycle() {
  const pending = new Set<PreloadEntry>();
  let retained: PreloadEntry | undefined;

  function start(args: Parameters<import("react-router").MiddlewareFunction>[0], routeId: string, preload: () => unknown) {
    const execution = args.context.get(executionContext);
    if (!execution?.navigation) {
      return;
    }
    args.request.signal.throwIfAborted();
    const value = preload();
    let released = false;
    let resource: unknown = value;
    const dispose = () => {
      if (resource != null && (typeof resource === "object" || typeof resource === "function") &&
          "dispose" in resource && typeof resource.dispose === "function") {
        resource.dispose();
      }
    };
    const entry: PreloadEntry = {
      routeId,
      url: new URL(args.request.url).pathname + new URL(args.request.url).search,
      value,
      ready: false,
      detach: () => args.request.signal.removeEventListener("abort", entry.release),
      release: () => {
        if (released) {
          return;
        }
        released = true;
        pending.delete(entry);
        entry.detach();
        dispose();
      },
    };
    // Preserve the original return type/value, including promises. Observe late
    // resources so cancellation before resolution cannot leak a disposable.
    if (value != null && (typeof value === "object" || typeof value === "function") &&
        "then" in value && typeof value.then === "function") {
      Promise.resolve(value).then((resolved) => {
        if (resolved === resource) {
          return;
        }
        resource = resolved;
        if (released) {
          dispose();
        }
      }, () => {});
    }
    execution.entry = entry;
    pending.add(entry);
    args.request.signal.addEventListener("abort", entry.release, { once: true });
    if (args.request.signal.aborted) {
      entry.release();
      args.request.signal.throwIfAborted();
    }
  }

  function wrapStrategy(custom?: DataStrategyFunction): DataStrategyFunction {
    return async (args) => {
      const execution: PreloadExecution = {
        navigation: args.fetcherKey === null && args.request.method === "GET",
      };
      args.context.set(executionContext, execution);
      try {
        const results = await (custom ? custom(args) : args.runClientMiddleware(runLoaders));
        const failed = Object.values(results).some(({ type, result }) =>
          type === "error" || (result instanceof Response && result.status >= 300 && result.status < 400));
        if (execution.entry) {
          if (failed || args.request.signal.aborted) {
            execution.entry.release();
          } else {
            execution.entry.ready = true;
          }
        }
        return results;
      } catch (error) {
        execution.entry?.release();
        throw error;
      }
    };
  }

  function attach(router: Router) {
    const unsubscribe = router.subscribe((state) => {
      if (state.navigation.state !== "idle" || state.revalidation !== "idle" || !state.initialized) {
        return;
      }
      const routeId = state.matches.at(-1)?.route.id;
      const url = state.location.pathname + state.location.search;
      const next = [...pending].reverse().find((entry) => entry.ready && entry.routeId === routeId && entry.url === url);
      if (state.errors || next || retained?.routeId !== routeId || retained?.url !== url) {
        retained?.release();
        retained = state.errors ? undefined : next;
        if (retained) {
          pending.delete(retained);
          retained.detach();
        }
      }
      for (const entry of pending) {
        entry.release();
      }
    });
    const originalDispose = router.dispose;
    router.dispose = () => {
      unsubscribe();
      for (const entry of pending) {
        entry.release();
      }
      retained?.release();
      retained = undefined;
      originalDispose();
    };
  }

  return {
    start,
    wrapStrategy,
    attach,
    value: (routeId: string) => retained?.routeId === routeId ? retained.value : undefined,
  };
}

async function runLoaders(args: DataStrategyFunctionArgs) {
  const matches = args.matches.filter((match) => match.shouldLoad);
  const results = await Promise.all(matches.map((match) => match.resolve()));
  return Object.fromEntries(matches.map((match, index) => [match.route.id, results[index]!]));
}
