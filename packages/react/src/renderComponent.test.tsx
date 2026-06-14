import { act } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderComponent } from "./renderComponent.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderComponent", () => {
  it("renders into the element with the given id", () => {
    const mount = document.createElement("div");
    mount.id = "app";
    document.body.appendChild(mount);

    act(() => renderComponent(<span>hello</span>, "app"));

    expect(mount.textContent).toBe("hello");
  });

  it("defaults to the 'root' element id", () => {
    const mount = document.createElement("div");
    mount.id = "root";
    document.body.appendChild(mount);

    act(() => renderComponent(<span>hi</span>));

    expect(mount.textContent).toBe("hi");
  });

  it("throws when the target element does not exist", () => {
    expect(() => renderComponent(<span>nope</span>, "missing")).toThrow(
      /id of missing/,
    );
  });
});