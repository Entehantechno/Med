import { it, expect, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
it("app boots when localStorage throws (Safari private / cookies blocked)", async () => {
  const thrower = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("SecurityError"); }, removeItem() { throw new Error("SecurityError"); } };
  Object.defineProperty(window, "localStorage", { value: thrower, configurable: true });
  const { AppProvider } = await import("../context.jsx");
  let err = null;
  try { render(<AppProvider><div>ok</div></AppProvider>); } catch (e) { err = e; }
  expect(err).toBeNull();
});
