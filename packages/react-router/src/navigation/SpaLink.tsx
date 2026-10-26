import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { Link } from "react-router";
import { useSpaApplicationId } from "./spaApplicationContext.js";
import type { RouteTarget } from "./routeTarget.js";

/** Normal anchor attributes with a completed generated target in place of href. */
export type SpaLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  to: RouteTarget;
};

/**
 * Link within the matched application using React Router, or to another
 * application using a native anchor. Modifiers, targets, downloads, and caller
 * cancellation retain normal link behavior. Internal hrefs use the router's
 * basename; cross-application hrefs are document URLs used unchanged.
 */
const SpaLink = forwardRef<HTMLAnchorElement, SpaLinkProps>(function SpaLink(props, ref) {
  const { to, download, ...anchorProps } = props;
  const applicationId = useSpaApplicationId("SpaLink");

  if (to.applicationId !== applicationId) {
    return <a {...anchorProps} ref={ref} href={to.href} download={download} />;
  }

  return (
    <Link
      {...anchorProps}
      ref={ref}
      to={to.href}
      download={download}
      reloadDocument={download != null && download !== false}
    />
  );
});

export default SpaLink;
