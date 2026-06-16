import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Control React Router's navigation state without a real router.
const nav = vi.hoisted(() => ({ state: "idle" as string }));
vi.mock("react-router", () => ({
  useNavigation: () => ({ state: nav.state }),
}));

import { NavigationProgress } from "./NavigationProgress.js";

describe("NavigationProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    nav.state = "idle";
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders nothing while idle", () => {
    const { container } = render(<NavigationProgress />);
    expect(container.firstChild).toBeNull();
  });

  it("appears only after the delay during navigation", () => {
    nav.state = "loading";
    const { container } = render(<NavigationProgress delay={150} />);
    expect(container.firstChild).toBeNull();
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(container.firstChild).not.toBeNull();
  });

  it("hides again once navigation settles", () => {
    nav.state = "loading";
    const { container, rerender } = render(<NavigationProgress delay={150} />);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(container.firstChild).not.toBeNull();
    nav.state = "idle";
    rerender(<NavigationProgress delay={150} />);
    expect(container.firstChild).toBeNull();
  });
});