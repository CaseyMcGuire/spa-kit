import { useCallback } from "react";
import { useNavigate } from "react-router";
import { useSpaApplicationId } from "./spaApplicationContext.js";
import type { RouteTarget } from "./routeTarget.js";

/** Navigation options supported by both SPA and full-page navigation. */
export interface SpaNavigateOptions {
  /** Replace the current history entry instead of adding a new entry. */
  replace?: boolean;
}

/** Internal navigation may return React Router's completion promise. */
export type SpaNavigateFunction = (target: RouteTarget, options?: SpaNavigateOptions) => void | Promise<void>;

/**
 * Navigate to a completed generated target. Matching application IDs use React
 * Router's normal navigation pipeline; other applications use a full-page request.
 * Requires a component rendered by createSpaRouter (including its error/fallback UI).
 *
 * Internal hrefs follow React Router's basename convention: the router adds its
 * basename. Cross-application hrefs are document URLs, used unchanged, and must
 * already include any destination deployment prefix. No parameters are encoded here.
 */
export function useSpaNavigate(): SpaNavigateFunction {
  const applicationId = useSpaApplicationId("useSpaNavigate");
  const navigate = useNavigate();

  return useCallback((target: RouteTarget, options?: SpaNavigateOptions) => {
    if (target.applicationId === applicationId) {
      return navigate(target.href, { replace: options?.replace });
    }
    if (options?.replace) {
      window.location.replace(target.href);
    } else {
      window.location.assign(target.href);
    }
  }, [applicationId, navigate]);
}
