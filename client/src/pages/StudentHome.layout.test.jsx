/* R99 — student dashboard layout guards.
   Problem found in the R98 review: with one module the grid used `grid-1`, so the classes card
   stretched across the full page width with its chevron far from the content ("long box").
   The new layout has one primary "next action" hero, a side column of compact stats, and
   module cards that size to their content. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

let mockData = {};
vi.mock("../context.jsx", () => ({
  useApp: () => ({
    t: (k) => k, lang: "en", user: { name_en: "Ali", name_fa: "علی", role: "student" },
    toggleLang: () => {}, logout: () => {}, theme: "light", toggleTheme: () => {}, flag: () => true,
  }),
}));
vi.mock("../api.js", () => ({
  api: {
    get: (path) => Promise.resolve(path in mockData ? mockData[path] : []),
  },
  loadFailKind: () => "network",
  loadFailText: () => "",
}));

import StudentHome from "./StudentHome.jsx";

beforeEach(() => { mockData = {}; });

describe("student dashboard layout (R99)", () => {
  it("a single module is not stretched to the full width (no grid-1 wrapper)", async () => {
    mockData = { "/classes": [{ id: 1, name: "Histology" }] };
    const { container } = render(<StudentHome go={() => {}} />);
    await waitFor(() => expect(screen.getByText("modClasses")).toBeTruthy());
    expect(container.querySelector(".grid-1")).toBeNull();
  });

  it("the primary module is the hero, with an explicit action button", async () => {
    mockData = { "/classes": [{ id: 1, name: "Histology" }] };
    const { container } = render(<StudentHome go={() => {}} />);
    await waitFor(() => expect(container.querySelector(".sd-hero")).not.toBeNull());
    const hero = container.querySelector(".sd-hero");
    expect(hero.textContent).toContain("modClasses");
    expect(hero.querySelector("button.btn")?.textContent).toContain("enterClass");
  });

  it("an open exam is the hero and its action goes to exams", async () => {
    const go = vi.fn();
    mockData = { "/exams": [{ id: 9, title_en: "Midterm", state: "open", duration_min: 30, ends_at: null }] };
    const { container } = render(<StudentHome go={go} />);
    await waitFor(() => expect(container.querySelector(".sd-hero")).not.toBeNull());
    expect(container.querySelector(".sd-hero").textContent).toContain("activeExams");
    expect(container.querySelector(".sd-hero button.btn-accent")).not.toBeNull();
  });

  it("the progress tile is informational (not a button), the link tiles are buttons", async () => {
    mockData = { "/classes": [{ id: 1, name: "Histology" }], "/reports/my": [{ id: 1 }] };
    const { container } = render(<StudentHome go={() => {}} />);
    await waitFor(() => expect(container.querySelector(".sd-stats")).not.toBeNull());
    const stats = container.querySelector(".sd-stats");
    expect(stats.querySelectorAll("button.sd-stat").length).toBe(2);
    expect(stats.querySelector("div.sd-stat")?.textContent).toContain("myProgress");
  });

  it("the module list sizes its cards to content (auto-fit), not a fixed column count", async () => {
    mockData = {
      "/exams": [{ id: 9, title_en: "Midterm", state: "open", duration_min: 30, ends_at: null }],
      "/classes": [{ id: 1, name: "Histology" }],
    };
    const { container } = render(<StudentHome go={() => {}} />);
    await waitFor(() => expect(container.querySelector(".sd-mods")).not.toBeNull());
    expect(container.querySelector(".grid-2")).toBeNull();
    expect(container.querySelector(".sd-mods")?.textContent).toContain("modClasses");
  });
});
