import { createContext } from "react-router";
import type { SpaRouteDefinition } from "./createSpaRouter.js";

/** The generated identifiers used to identify a route on the server. */
export type SpaRouteIdentity = Pick<SpaRouteDefinition, "applicationId" | "routeId">;

/**
 * The matched generated route's server identity. `createSpaRouter` sets this
 * after parameter validation and before user middleware. With native React
 * Router route objects, set it from a generated definition in middleware before
 * running `createSpaRouteAuthorization`'s middleware.
 */
export const spaRouteContext = createContext<SpaRouteIdentity | null>(null);
