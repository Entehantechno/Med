// @vitest-environment jsdom
// R90: Dr Tutor shows the reply, shows the sent message at once, labels the source,
// and restores the draft when the server refuses.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor, cleanup, screen } from "@testing-library/react";

const get = vi.fn();
const post = vi.fn();
vi.mock("../api.js", () => ({ api: { get: (...a) => get(...a), post: (...a) => post(...a) } }));
vi.mock("../context.jsx", () => ({ useApp: () => ({ t: (k) => k, lang: "en" }) }));
import DrTutorChat from "./DrTutorChat.jsx";

beforeEach(() => {
  get.mockReset(); post.mockReset();
  get.mockImplementation((url) => {
    if (url.startsWith("/tutor/status")) return Promise.resolve({ enabled: true });
    if (url.startsWith("/tutor/history")) return Promise.resolve({ messages: [{ role: "user", message: "earlier question", created_at: "t" }] });
    return Promise.reject(new Error("unexpected " + url));
  });
});
afterEach(() => { cleanup(); });

async function openPanel() {
  render(<DrTutorChat contextType="general" contextId={null} />);
  const fab = await screen.findByRole("button", { name: "Dr Tutor" });
  fireEvent.click(fab);
  return screen.findByRole("log");
}

describe("Dr Tutor panel (R90)", () => {
  it("renders nothing when the tutor is disabled", async () => {
    get.mockImplementation(() => Promise.resolve({ enabled: false }));
    const { container } = render(<DrTutorChat />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(container.querySelector(".dr-tutor")).toBeNull();
  });

  it("shows the reply and labels the AI source", async () => {
    post.mockResolvedValue({ reply: "Compare the two options first.", source: "ai" });
    const log = await openPanel();
    await screen.findByText("earlier question");
    fireEvent.change(screen.getByRole("textbox", { name: "Message to Dr Tutor" }), { target: { value: "help me" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Compare the two options first.");
    expect(log.textContent).toContain("AI");
    expect(post).toHaveBeenCalledWith("/tutor/message", expect.objectContaining({ message: "help me", contextType: "general", lang: "en" }));
  });

  it("shows the learner's message before the server replies (optimistic)", async () => {
    let resolve;
    post.mockImplementation(() => new Promise((r) => { resolve = r; }));
    await openPanel();
    fireEvent.change(screen.getByRole("textbox", { name: "Message to Dr Tutor" }), { target: { value: "pending text" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("pending text")).toBeTruthy();
    expect(screen.getByText("Sending…")).toBeTruthy();
    resolve({ reply: "ok", source: "guide" });
    await screen.findByText("ok");
    expect(screen.queryByText("Sending…")).toBeNull();
  });

  it("marks a refused message as failed and restores the draft", async () => {
    post.mockRejectedValue(new Error("server"));
    await openPanel();
    const input = screen.getByRole("textbox", { name: "Message to Dr Tutor" });
    fireEvent.change(input, { target: { value: "will fail" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Failed");
    expect(screen.getByRole("alert").textContent).toContain("Not sent");
    expect(input.value).toBe("will fail");
  });

  it("says why a refused message failed: per-account limit, not a generic retry", async () => {
    const err = Object.assign(new Error("too many"), { status: 429, data: { error: "ai_rate_limited", message_en: "Wait a moment and ask again." } });
    post.mockRejectedValue(err);
    await openPanel();
    fireEvent.change(screen.getByRole("textbox", { name: "Message to Dr Tutor" }), { target: { value: "again" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Failed");
    expect(screen.getByRole("alert").textContent).toContain("Wait a moment and ask again.");
    expect(screen.getByRole("alert").textContent).not.toContain("Not sent");
  });

  it("says the tutor is off when the server reports tutor_disabled", async () => {
    post.mockRejectedValue(Object.assign(new Error("off"), { status: 403, data: { error: "tutor_disabled" } }));
    await openPanel();
    fireEvent.change(screen.getByRole("textbox", { name: "Message to Dr Tutor" }), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Failed");
    expect(screen.getByRole("alert").textContent).toContain("not available right now");
  });
});
