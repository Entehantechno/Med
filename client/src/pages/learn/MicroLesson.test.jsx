import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../context.jsx", () => ({ useApp: () => ({ lang: "fa", t: (k) => k }) }));
vi.mock("../../api.js", () => ({ api: { post: vi.fn() } }));
import { api } from "../../api.js";
import { MicroLesson } from "./QuestionTypes.jsx";

afterEach(() => { cleanup(); api.post.mockReset(); });

const pendingMicro = (cardId) => ({
  lead: "Lead written only in English",
  golden: "Golden tip written only in English",
  points: [],
  options: [],
  source: "",
  pending: { cardId, from: "en", to: "fa", fields: ["lead", "golden"], hash: `h${cardId}` },
});

describe("درسنامه in the site language", () => {
  it("hides the other-language text while translating, then shows the translation", async () => {
    api.post.mockResolvedValue({
      ok: true, to: "fa", failed: [],
      translations: { 88001: { lead: "لید فارسی", golden: "طلایی فارسی" } },
      hashes: { 88001: "h88001" },
    });
    render(<MicroLesson micro={pendingMicro(88001)} defaultOpen />);
    expect(screen.queryByText("Lead written only in English")).toBeNull();
    expect(screen.getByText(/در حال ترجمهٔ این درسنامه/)).toBeTruthy();
    await waitFor(() => expect(screen.getByText("لید فارسی")).toBeTruthy());
    expect(screen.queryByText("Lead written only in English")).toBeNull();
    expect(screen.queryByText(/در حال ترجمهٔ این درسنامه/)).toBeNull();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post.mock.calls[0][0]).toBe("/learn/lessons/translate");
    expect(api.post.mock.calls[0][1]).toEqual({ to: "fa", cardIds: [88001] });
  });

  it("when translation fails, shows the original text with a clear notice (no silent mix)", async () => {
    api.post.mockRejectedValue(Object.assign(new Error("ai"), { status: 503 }));
    render(<MicroLesson micro={pendingMicro(88002)} defaultOpen />);
    await waitFor(() => expect(screen.getByText(/ترجمهٔ هوش مصنوعی انجام نشد/)).toBeTruthy());
    expect(screen.getByText("Lead written only in English")).toBeTruthy();
  });

  it("does not spend a translation until the lesson is opened", async () => {
    api.post.mockResolvedValue({
      ok: true, to: "fa", failed: [],
      translations: { 88003: { lead: "لید سه", golden: "طلایی سه" } },
      hashes: { 88003: "h88003" },
    });
    render(<MicroLesson micro={pendingMicro(88003)} defaultOpen={false} />);
    await new Promise((r) => setTimeout(r, 150));
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(document.querySelector(".micro-toggle"));
    await waitFor(() => expect(screen.getByText("لید سه")).toBeTruthy());
    expect(api.post).toHaveBeenCalledTimes(1);
  });
});
