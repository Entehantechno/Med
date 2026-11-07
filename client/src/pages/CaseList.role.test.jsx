/* CaseList.role.test.jsx (R88) — the list must reload when the learner role resolves.
   Regression: a deep link could mount the VP list before `user` was known, so the
   staff /cases endpoint was used for a learner and the list never refreshed. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const calls = [];
let mockUser = null;
vi.mock("../context.jsx", () => ({
  useApp: () => ({ t: (k) => k, lang: "en", user: mockUser, flag: () => true }),
}));
vi.mock("../api.js", () => ({
  api: {
    get: (path) => {
      calls.push(path);
      if (path.startsWith("/learn/vpatient")) {
        return Promise.resolve({ access: true, cases: [{ id: 14, difficulty: "easy", title: "", specialty: "Cardiology", topic: "cardio", topic_label: "Cardiology", chief: "Chest pain", age: 58, sex: "m", best: null }] });
      }
      return Promise.resolve([]);
    },
  },
}));

import CaseList from "./CaseList.jsx";

beforeEach(() => { calls.length = 0; mockUser = null; });

describe("CaseList role resolution", () => {
  it("loads the learner endpoint once the role is known, not the staff list", async () => {
    const { rerender } = render(<CaseList go={() => {}} home={() => {}} />);
    // First render: no user yet, so the staff endpoint is requested.
    expect(calls).toContain("/cases");
    mockUser = { id: 1, role: "learner" };
    rerender(<CaseList go={() => {}} home={() => {}} />);
    await waitFor(() => expect(calls).toContain("/learn/vpatient?lang=en"));
    expect(await screen.findByText("Chest pain")).toBeTruthy();
  });
});
