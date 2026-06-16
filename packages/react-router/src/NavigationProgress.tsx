import { useEffect, useState } from "react";
import { useNavigation } from "react-router";

/**
 * Returns `true` while a React Router navigation has been pending longer than
 * `delayMs`. The delay prevents the indicator from flickering when a route's
 * loader (e.g. an authorization check) resolves quickly.
 */
export function useNavigationPending(delayMs = 150): boolean {
  const navigation = useNavigation();
  const active = navigation.state !== "idle";
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!active) {
      setPending(false);
      return;
    }
    const timer = setTimeout(() => setPending(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  return pending;
}

const KEYFRAMES = `@keyframes spa-kit-navigation-progress {
  0% { left: -40%; }
  100% { left: 100%; }
}`;

export interface NavigationProgressProps {
  /** Delay before the bar appears, in ms. @default 150 */
  delay?: number;
  /** Bar color. @default "#3b82f6" */
  color?: string;
  /** Bar height in px. @default 3 */
  height?: number;
  /** Stacking order. @default 9999 */
  zIndex?: number;
}

/**
 * A top-of-viewport progress bar that appears during React Router navigations
 * (including while an authorization check runs) and hides when navigation
 * settles. It only shows after {@link NavigationProgressProps.delay}, so instant
 * navigations don't flash.
 */
export function NavigationProgress({
  delay = 150,
  color = "#3b82f6",
  height = 3,
  zIndex = 9999,
}: NavigationProgressProps) {
  const pending = useNavigationPending(delay);

  if (!pending) {
    return null;
  }

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex,
      }}
    >
      <style>{KEYFRAMES}</style>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: "40%",
          left: "-40%",
          background: color,
          animation: "spa-kit-navigation-progress 1.1s ease-in-out infinite",
        }}
      />
    </div>
  );
}