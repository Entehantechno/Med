// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isSafeToReload, markBusy, initSwUpdate } from "../lib/sw-update.js";
import { isDocumentStale } from "../lib/build-check.js";

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

  // R64 regressions: a hidden tab with unfinished work must not reload, and busy
  // screens are counted so nested screens do not release each other.
  const setVisibility = (value) => Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
  const restoreVisibility = () => { delete document.visibilityState; };
  it("does not reload a hidden tab that is busy with an exam", () => {
    setVisibility("hidden");
    try {
      markBusy(true);
      expect(isSafeToReload()).toBe(false);
      markBusy(false);
      expect(isSafeToReload()).toBe(true);
    } finally { restoreVisibility(); }
  });
  it("reloads a hidden tab that has no work in progress", () => {
    setVisibility("hidden");
    try { expect(isSafeToReload()).toBe(true); } finally { restoreVisibility(); }
  });
  it("stays busy until every nested busy screen has ended", () => {
    markBusy(true);
    markBusy(true);
    markBusy(false);
    expect(isSafeToReload()).toBe(false);
    markBusy(false);
    expect(isSafeToReload()).toBe(true);
  });

  // R64: a stale lazy chunk while work is open is not a reason to reload now.
  it("does not set the preload reload guard while work is in progress", () => {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register: async () => undefined, addEventListener: () => {}, controller: null },
    });
    initSwUpdate();
    markBusy(true);
    try {
      const ev = new Event("vite:preloadError", { cancelable: true });
      window.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
      expect(window.sessionStorage.getItem("medlab_preload_reload")).toBeNull();
    } finally { markBusy(false); }
  });

  // R94: a controllerchange must not reload a document that already runs the deployed build.
  describe("isDocumentStale (R94: no second boot for a current document)", () => {
    const loadEntry = (src) => {
      document.head.querySelectorAll('script[type="module"]').forEach((n) => n.remove());
      if (src === null) return;
      const s = document.createElement("script");
      s.type = "module"; s.src = src; document.head.appendChild(s);
    };
    afterEach(() => { vi.unstubAllGlobals(); loadEntry(null); });

    it("is not stale when the served HTML names the same entry script", async () => {
      loadEntry("/assets/index-AAA111.js");
      vi.stubGlobal("fetch", vi.fn(async () => new Response('<script type="module" src="/assets/index-AAA111.js"></script>', { status: 200 })));
      expect(await isDocumentStale()).toBe(false);
    });
    it("is stale when the server has a newer entry script", async () => {
      loadEntry("/assets/index-AAA111.js");
      vi.stubGlobal("fetch", vi.fn(async () => new Response('<script type="module" src="/assets/index-BBB222.js"></script>', { status: 200 })));
      expect(await isDocumentStale()).toBe(true);
    });
    it("is stale when the check fails, so the old behaviour is kept", async () => {
      loadEntry("/assets/index-AAA111.js");
      vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
      expect(await isDocumentStale()).toBe(true);
    });
    it("is stale when the page has no built entry script (dev server)", async () => {
      loadEntry(null);
      const f = vi.fn(async () => new Response("", { status: 200 }));
      vi.stubGlobal("fetch", f);
      expect(await isDocumentStale()).toBe(true);
      expect(f).not.toHaveBeenCalled();
    });
  });
});
