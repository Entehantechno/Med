// @vitest-environment jsdom
// R89: an anonymous visitor is "ready" on the first render (the landing replaces the static
// shell at once). A returning visitor waits for /auth/me and sees a skeleton meanwhile.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import React from "react";

const meMock = vi.fn();
vi.mock("./api.js", async (orig) => {
  const real = await orig();
  return { ...real, api: { ...real.api, me: (...a) => meMock(...a), get: vi.fn(() => Promise.resolve({ flags: {} })) } };
});

import { AppProvider, useApp } from "./context.jsx";
import { AppBootSkeleton } from "./components/Skeleton.jsx";
import { setToken } from "./api.js";

function Probe({ onRender }) {
  const { ready } = useApp();
  onRender(ready);
  return <div>{ready ? "ready" : "booting"}</div>;
}

beforeEach(() => { cleanup(); meMock.mockReset(); setToken(null); localStorage.clear(); });

describe("boot readiness (R89)", () => {
  it("anonymous visitor is ready on the very first render", () => {
    const seen = [];
    render(<AppProvider><Probe onRender={(r) => seen.push(r)} /></AppProvider>);
    expect(seen[0]).toBe(true);
    expect(meMock).not.toHaveBeenCalled();
  });

  it("returning visitor is not ready until /auth/me settles", async () => {
    setToken("tok-123");
    let resolveMe;
    meMock.mockReturnValue(new Promise((r) => { resolveMe = r; }));
    const seen = [];
    render(<AppProvider><Probe onRender={(r) => seen.push(r)} /></AppProvider>);
    expect(seen[0]).toBe(false);
    await act(async () => { resolveMe({ user: { id: 1, role: "student", perms: [] } }); });
    await waitFor(() => expect(screen.getByText("ready")).toBeTruthy());
  });

  it("the boot skeleton is announced as busy status and has no spinner", () => {
    const { container } = render(<AppBootSkeleton />);
    const el = screen.getByRole("status");
    expect(el.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector(".spinner")).toBeNull();
  });
});
