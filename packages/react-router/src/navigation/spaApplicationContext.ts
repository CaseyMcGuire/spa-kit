import { createContext, useContext } from "react";

// React context for rendered routes, distinct from React Router's middleware
// spaRouteContext. Each generated route supplies its own application identity.
export const spaApplicationContext = createContext<string | null>(null);

export function useSpaApplicationId(consumer: string): string {
  const applicationId = useContext(spaApplicationContext);
  if (applicationId === null) {
    throw new Error(
      `${consumer}: missing application context. Render this component inside a route ` +
      "created by createSpaRouter and mounted with RouterProvider.",
    );
  }
  return applicationId;
}
