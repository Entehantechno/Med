// @vitest-environment jsdom
// R93: the custom-test runner keeps the same hook order when its card list empties.
// Before the fix an early `return null` sat above a useEffect, so a re-render with no
// current card threw "Rendered fewer hooks than expected".
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

vi.mock("../../api.js", () => ({ api: { get: vi.fn(() => Promise.resolve({})), post: vi.fn(() => Promise.resolve({})) } }));
vi.mock("../../context.jsx", () => ({ useApp: () => ({ t: (k) => k, lang: "en" }) }));
import { Runner } from "./CustomTest.jsx";

const card = (id) => ({ id, type: "mcq", q: `question ${id}`, options: [{ text: "a", correct: true }, { text: "b", correct: false }], difficulty: 1 });
const baseTest = (cards) => ({ id: 7, config: { mode: "tutor" }, cards, answers: {}, startedAt: null, durationS: 0 });

afterEach(() => cleanup());

describe("custom test runner (R93)", () => {
  it("re-renders without a hook-order error when the card list becomes empty and back", () => {
    const noop = () => {};
    const { rerender, container } = render(<Runner test={baseTest([card(1), card(2)])} setTest={noop} onFinish={noop} onQuit={noop} />);
    expect(container.textContent).toContain("question 1");
    expect(() => rerender(<Runner test={baseTest([])} setTest={noop} onFinish={noop} onQuit={noop} />)).not.toThrow();
    expect(container.textContent).toBe("");
    expect(() => rerender(<Runner test={baseTest([card(3)])} setTest={noop} onFinish={noop} onQuit={noop} />)).not.toThrow();
    expect(container.textContent).toContain("question 3");
  });
});
