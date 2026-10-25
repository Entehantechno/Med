import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api.js", () => ({ api: { post: vi.fn() } }));
import { api } from "../api.js";
import {
  loadLessonFields, applyLessonFields, resolveSummaryBullets, summaryLoading,
  resolveMindmapLabels, mindmapRequests, lessonCacheKey,
} from "./lesson-translate.js";

// Fake server: translates every requested card, echoing the hash it was given.
function serverFor(hashByCard) {
  return vi.fn(async (path, body) => {
    const translations = {}, hashes = {}, failed = [];
    for (const id of body.cardIds) {
      translations[id] = { lead: `${body.to}:lead:${id}`, points: [`${body.to}:p:${id}`] };
      hashes[id] = hashByCard[id] ?? `h${id}`;
    }
    return { ok: true, to: body.to, translations, hashes, failed };
  });
}

beforeEach(() => { api.post.mockReset(); });

describe("lesson translation cache", () => {
  it("translates once, then serves the cached text for the same language and source", async () => {
    api.post.mockImplementation(serverFor({ 9101: "hA" }));
    const req = { cardId: 9101, to: "fa", hash: "hA" };
    const first = await loadLessonFields(req);
    expect(first.lead).toBe("fa:lead:9101");
    const again = await loadLessonFields(req);
    expect(again.lead).toBe("fa:lead:9101");
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("switching language and back restores the earlier translation with no AI call", async () => {
    api.post.mockImplementation(serverFor({ 9102: "hB" }));
    await loadLessonFields({ cardId: 9102, to: "fa", hash: "hB" });
    await loadLessonFields({ cardId: 9102, to: "en", hash: "hB" });
    expect(api.post).toHaveBeenCalledTimes(2);
    // back to fa: cached, no new request
    const back = await loadLessonFields({ cardId: 9102, to: "fa", hash: "hB" });
    expect(back.lead).toBe("fa:lead:9102");
    expect(api.post).toHaveBeenCalledTimes(2);
  });

  it("a changed source hash is never served a stale translation", async () => {
    api.post.mockImplementation(serverFor({ 9103: "hNEW" }));
    await expect(loadLessonFields({ cardId: 9103, to: "fa", hash: "hOLD" })).rejects.toThrow("translation_failed");
    expect(lessonCacheKey(9103, "fa", "hOLD")).not.toBe(lessonCacheKey(9103, "fa", "hNEW"));
  });

  it("batches concurrent cards into requests of at most 8", async () => {
    api.post.mockImplementation(serverFor({}));
    const ids = Array.from({ length: 10 }, (_, i) => 9200 + i);
    await Promise.all(ids.map((id) => loadLessonFields({ cardId: id, to: "en", hash: `h${id}` })));
    expect(api.post).toHaveBeenCalledTimes(2);
    for (const [, body] of api.post.mock.calls) expect(body.cardIds.length).toBeLessThanOrEqual(8);
  });
});

describe("applying a translation", () => {
  const micro = {
    lead: "EN lead", golden: "", points: ["EN p1"], options: [], source: "Book", high_yield: undefined,
    pending: { cardId: 1, from: "en", to: "fa", fields: ["lead", "points"], hash: "x" },
  };
  it("fills only the pending fields and clears pending", () => {
    const out = applyLessonFields(micro, { lead: "سرنخ", points: ["نکتهٔ یک"] });
    expect(out.lead).toBe("سرنخ");
    expect(out.points).toEqual(["نکتهٔ یک"]);
    expect(out.source).toBe("Book");       // not pending: untouched
    expect(out.pending).toBeNull();
  });
  it("leaves a micro-lesson without pending fields as it is", () => {
    const plain = { lead: "لید فارسی", pending: null };
    expect(applyLessonFields(plain, { lead: "x" })).toBe(plain);
  });
});

describe("summary bullets", () => {
  const pend = (id) => ({ cardId: id, to: "fa", hash: `h${id}`, fields: ["golden"] });
  const items = [
    { cardId: 1, field: "golden", text: "طلایی یک", pending: null },
    { cardId: 2, field: "golden", text: null, pending: pend(2) },
    { cardId: 3, field: "lead", text: "لید سه", pending: null },
    { cardId: 4, field: "points0", text: null, pending: { ...pend(4), fields: ["points"] } },
    { cardId: 5, field: "golden", text: "طلایی یک", pending: null }, // duplicate
  ];
  it("shows native bullets at once and translated ones in lesson order, deduplicated", () => {
    const byCard = { 2: { status: "ready", fields: { golden: "طلایی دو" } }, 4: { status: "ready", fields: { points: ["نکتهٔ چهار"] } } };
    expect(resolveSummaryBullets(items, byCard)).toEqual(["طلایی یک", "طلایی دو", "لید سه", "نکتهٔ چهار"]);
    expect(summaryLoading(items, byCard)).toBe(false);
  });
  it("waits for pending items and reports loading; a failed item is skipped", () => {
    expect(resolveSummaryBullets(items, {})).toEqual(["طلایی یک", "لید سه"]);
    expect(summaryLoading(items, {})).toBe(true);
    const failed = { 2: { status: "failed" }, 4: { status: "failed" } };
    expect(resolveSummaryBullets(items, failed)).toEqual(["طلایی یک", "لید سه"]);
    expect(summaryLoading(items, failed)).toBe(false);
  });
});

describe("mind-map labels", () => {
  const map = {
    topic: { slug: "t" },
    branches: [{
      lesson: "L1", children: [
        { label: "طلای بومی", kind: "golden" },
        { label: null, kind: "golden", pending: true, cardId: 7, field: "golden", to: "fa", hash: "h7" },
        { label: null, kind: "point", pending: true, cardId: 7, field: "points", index: 1, to: "fa", hash: "h7" },
      ],
    }],
  };
  it("lists one request per card with the pending fields", () => {
    expect(mindmapRequests(map)).toEqual([{ cardId: 7, to: "fa", hash: "h7", fields: ["golden", "points"] }]);
  });
  it("fills pending labels from the translation and keeps native labels", () => {
    const out = resolveMindmapLabels(map, { 7: { status: "ready", fields: { golden: "طلای هفت", points: ["یک", "دو"] } } });
    const kids = out.branches[0].children;
    expect(kids[0].label).toBe("طلای بومی");
    expect(kids[1].label).toBe("طلای هفت");
    expect(kids[2].label).toBe("دو");
    expect(kids[2].pending).toBe(false);
  });
  it("shows a loading state while translating and a failed state after a failure", () => {
    const loading = resolveMindmapLabels(map, {}).branches[0].children;
    expect(loading[1].label).toBeNull();
    expect(loading[1].loading).toBe(true);
    const failed = resolveMindmapLabels(map, { 7: { status: "failed" } }).branches[0].children;
    expect(failed[1].failed).toBe(true);
  });
});
