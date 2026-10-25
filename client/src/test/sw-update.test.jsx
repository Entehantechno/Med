// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { isSafeToReload, markBusy } from "../lib/sw-update.js";

describe("sw-update — silent update never interrupts work", () => {
  beforeEach(() => { document.body.innerHTML = ""; delete document.body.dataset.busy; });

  it("is safe on an idle page", () => {
    expect(isSafeToReload()).toBe(true);
  });
  it("waits while an exam/lesson marked the page busy, resumes afterwards", () => {
    markBusy(true);
    expect(isSafeToReload()).toBe(false);
    markBusy(false);
    expect(isSafeToReload()).toBe(true);
  });
  it("waits while the user is typing", () => {
    const i = document.createElement("input"); document.body.appendChild(i); i.focus();
    expect(document.activeElement).toBe(i);
    expect(isSafeToReload()).toBe(false);
    i.blur();
    expect(isSafeToReload()).toBe(true);
  });
  it("waits while a dialog is open", () => {
    document.body.innerHTML = '<div class="modal-back"><div class="modal"/></div>';
    expect(isSafeToReload()).toBe(false);
  });
});
