/* topic-key.test.js — the shared card/case topic key (flashcards <-> virtual patient).
   Pure functions: no database, no HTTP. */
import { describe, it, expect } from "vitest";
import { topicKeyOf, topicKeyFromText, topicLabel, TOPIC_KEYS } from "../src/lib/topic-key.js";
import { TOPICS, BASIC_TOPICS } from "../src/data/preinternship.js";

describe("topic keys match the TOPICS slugs", () => {
  it("every key is a real topic slug, and every slug has a key", () => {
    const slugs = [...TOPICS, ...BASIC_TOPICS].map((t) => t.slug).sort();
    expect(TOPIC_KEYS.map((t) => t.key).sort()).toEqual(slugs);
  });
});

describe("bank cards (chapter and subject text)", () => {
  it("maps chapter names in English and Persian", () => {
    expect(topicKeyOf({ source_meta: { chapter_en: "Cardiology" } })).toBe("cardio");
    expect(topicKeyOf({ source_meta: { chapter_fa: "قلب" } })).toBe("cardio");
    expect(topicKeyOf({ source_meta: { chapter_en: "Pulmonology & Toxicology" } })).toBe("pulmo");
    expect(topicKeyOf({ category_en: "Hematology & Oncology" })).toBe("heme");
    expect(topicKeyOf({ category_en: "Obstetrics & Gynecology" })).toBe("obgyn");
  });

  it("uses the chapter before the broader subject", () => {
    expect(topicKeyOf({ source_meta: { subject_en: "Internal Medicine", chapter_en: "Nephrology" } })).toBe("nephro");
  });

  it("falls back to the subject when there is no chapter", () => {
    expect(topicKeyOf({ source_meta: { subject_en: "Urology", chapter_en: "" } })).toBe("uro");
  });

  it("leaves a general internal-medicine card unlinked rather than guessing", () => {
    expect(topicKeyOf({ source_meta: { subject_en: "Internal Medicine", chapter_en: "" } })).toBe("");
  });

  it("prefers an explicit slug over text", () => {
    expect(topicKeyOf({ topic: "endo", source_meta: { chapter_en: "Cardiology" } })).toBe("endo");
  });

  it("ignores an unknown explicit slug and reads the text", () => {
    expect(topicKeyOf({ topic: "not-a-topic", source_meta: { chapter_en: "Neurology" } })).toBe("neuro");
  });
});

describe("matching is on whole words", () => {
  it("does not treat 'patient' as the ENT key", () => {
    expect(topicKeyFromText("Patient history")).toBe("");
    expect(topicKeyFromText("ENT")).toBe("ent");
  });

  it("GI bleeding is gastroenterology, not hematology", () => {
    expect(topicKeyFromText("خونریزی گوارشی")).toBe("gi");
  });

  it("is case-insensitive and tolerates Arabic yeh and kaf", () => {
    expect(topicKeyFromText("CARDIOLOGY")).toBe("cardio");
    expect(topicKeyFromText("نفرولوژی")).toBe("nephro");
    expect(topicKeyFromText("اورولوژی")).toBe("uro");
  });
});

describe("virtual-patient cases (specialty text)", () => {
  it("maps the specialty a case is listed under", () => {
    expect(topicKeyOf({ specialty_en: "Cardiology", specialty_fa: "قلب و عروق" })).toBe("cardio");
    expect(topicKeyOf({ specialty_fa: "گوارش" })).toBe("gi");
  });

  it("leaves a generic emergency specialty unlinked unless the case names a topic", () => {
    expect(topicKeyOf({ specialty_en: "Internal Medicine - Emergency" })).toBe("");
    expect(topicKeyOf({ specialty_en: "Internal Medicine - Emergency", topic: "cardio" })).toBe("cardio");
  });
});

describe("labels", () => {
  it("returns the label in the requested language, or empty for an unknown key", () => {
    expect(topicLabel("cardio", "en")).toBe("Cardiology");
    expect(topicLabel("cardio", "fa")).toBe("قلب و عروق");
    expect(topicLabel("nope", "fa")).toBe("");
  });
});
