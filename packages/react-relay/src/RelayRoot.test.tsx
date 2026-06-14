import { render, screen } from "@testing-library/react";
import { useRelayEnvironment } from "react-relay";
import { afterEach, describe, expect, it } from "vitest";
import { createRelayEnvironment } from "./createRelayEnvironment.js";
import { RelayRoot } from "./RelayRoot.js";

afterEach(() => {
  document.body.innerHTML = "";
});

function ShowsEnvironment() {
  // Throws if no environment is provided by an ancestor.
  return <span>{useRelayEnvironment() ? "has-env" : "no-env"}</span>;
}

function Suspender(): never {
  // Never resolves, so the surrounding Suspense stays in its fallback state.
  throw new Promise<void>(() => {});
}

describe("RelayRoot", () => {
  it("provides the environment to its subtree", () => {
    const environment = createRelayEnvironment();
    render(
      <RelayRoot environment={environment}>
        <ShowsEnvironment />
      </RelayRoot>,
    );
    expect(screen.getByText("has-env")).toBeInTheDocument();
  });

  it("renders the fallback while a child suspends", () => {
    const environment = createRelayEnvironment();
    render(
      <RelayRoot environment={environment} fallback={<span>loading</span>}>
        <Suspender />
      </RelayRoot>,
    );
    expect(screen.getByText("loading")).toBeInTheDocument();
  });
});