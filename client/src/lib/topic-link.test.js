/* topic-link.test.js (R88) — URL state for flashcard <-> virtual-patient links. */
import { describe, it, expect } from "vitest";
import { parseTopicHash, topicHash, topicLabel, isTopicKey, TOPIC_LABELS, TOPIC_TABS } from "./topic-link.js";

describe("parseTopicHash", () => {
  it("reads a flashcard or VP topic link", () => {
    expect(parseTopicHash("#flashcards?topic=cardio")).toEqual({ tab: "flashcards", key: "cardio" });
    expect(parseTopicHash("#vpatient?topic=gi")).toEqual({ tab: "vpatient", key: "gi" });
  });

  it("opens the tab without a filter when the topic is missing or unknown", () => {
    expect(parseTopicHash("#vpatient")).toEqual({ tab: "vpatient", key: null });
    expect(parseTopicHash("#flashcards?topic=not-a-topic")).toEqual({ tab: "flashcards", key: null });
    expect(parseTopicHash("#vpatient?topic=__proto__")).toEqual({ tab: "vpatient", key: null });
  });

  it("ignores every other hash, so Browse and reference links are unaffected", () => {
    expect(parseTopicHash("#browse?q=heart")).toBeNull();
    expect(parseTopicHash("")).toBeNull();
    expect(parseTopicHash(undefined)).toBeNull();
    expect(parseTopicHash("#flashcardsX?topic=cardio")).toBeNull();
  });
});

describe("topicHash", () => {
  it("builds a link that parseTopicHash reads back", () => {
    for (const tab of TOPIC_TABS) {
      expect(parseTopicHash(topicHash(tab, "endo"))).toEqual({ tab, key: "endo" });
    }
  });

  it("falls back to the bare tab hash without a valid key, and refuses unknown tabs", () => {
    expect(topicHash("vpatient", "")).toBe("#vpatient");
    expect(topicHash("vpatient", "bogus")).toBe("#vpatient");
    expect(topicHash("browse", "cardio")).toBe("");
  });
});

describe("topic labels", () => {
  it("resolves Persian and English labels and rejects unknown keys", () => {
    expect(topicLabel("cardio", "en")).toBe("Cardiology");
    expect(topicLabel("cardio", "fa")).toBe("قلب و عروق");
    expect(topicLabel("nope", "en")).toBe("");
    expect(isTopicKey("constructor")).toBe(false);
    expect(Object.keys(TOPIC_LABELS).length).toBeGreaterThan(30);
  });
});
