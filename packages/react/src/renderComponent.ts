import type { ReactNode } from "react";
import ReactDOM from "react-dom/client";

/**
 * Mount a React node into the DOM element with the given id.
 *
 * @param component The React node to render.
 * @param elementId The id of the mount target. Defaults to "root".
 * @throws If no element with `elementId` exists in the document.
 */
export function renderComponent(component: ReactNode, elementId: string = "root") {
  const rootElement = document.getElementById(elementId);
  if (rootElement == null) {
    throw new Error(
      `In order to mount this component, there must be tag with an id of ${elementId} but none was found.`,
    );
  }
  const root = ReactDOM.createRoot(rootElement);
  root.render(component);
}
