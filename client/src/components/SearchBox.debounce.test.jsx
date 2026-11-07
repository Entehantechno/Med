// @vitest-environment jsdom
// R89: typing fires one search and one suggestion request after the typing pauses,
// not one per keystroke.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import React, { useState } from "react";

vi.mock("../context.jsx", () => ({ useApp: () => ({ t: (k) => k, lang: "en" }) }));
import SearchBox from "./SearchBox.jsx";

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); });

function Harness({ onSearch, suggest }) {
  const [v, setV] = useState("");
  return <SearchBox value={v} onChange={setV} onSearch={onSearch} suggest={suggest} storageKey="t" />;
}

describe("SearchBox debounce (R89)", () => {
  it("one suggestion request and one search after a burst of keystrokes", async () => {
    const onSearch = vi.fn();
    const suggest = vi.fn(() => Promise.resolve([]));
    const { container } = render(<Harness onSearch={onSearch} suggest={suggest} />);
    const input = container.querySelector("input");
    fireEvent.focus(input);
    for (const v of ["c", "ca", "car", "card", "cardi", "cardio"]) fireEvent.change(input, { target: { value: v } });
    await act(() => new Promise((r) => setTimeout(r, 600)));
    expect(onSearch.mock.calls.map((c) => c[0])).toEqual(["cardio"]);
    expect(suggest.mock.calls.map((c) => c[0])).toEqual(["cardio"]);
  });
});
