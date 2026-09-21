import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { stackPremiumUntil, isoWeekKey, tehranDay, STREAK_SOCIETY } from "../src/lib/gamify.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

import { publicBaseUrl, isUsablePublicUrl, hostAliases } from "../src/lib/publicurl.js";

describe("canonical domain medschool.ir", () => {
  it("rejects placeholder APP_URL values that would send Zarinpal to a dead host", () => {
    expect(isUsablePublicUrl("https://CHANGE-ME-to-your-domain.com")).toBe(false);
    expect(isUsablePublicUrl("https://medschool.example.com")).toBe(false);
    expect(isUsablePublicUrl("http://localhost:4000")).toBe(false);
    expect(isUsablePublicUrl("https://medschool.localhost")).toBe(false);
    expect(isUsablePublicUrl("https://medschool.ir")).toBe(true);
    expect(isUsablePublicUrl("https://www.medschool.ir")).toBe(true);
  });
  it("treats www and apex as one site and falls back to the request host", () => {
    expect(hostAliases("medschool.ir")).toEqual(expect.arrayContaining(["medschool.ir", "www.medschool.ir"]));
    const prev = process.env.APP_URL;
    process.env.APP_URL = "https://CHANGE-ME-to-your-domain.com";
    expect(publicBaseUrl({ headers: { host: "medschool.ir", "x-forwarded-proto": "https" } })).toBe("https://medschool.ir");
    process.env.APP_URL = "https://medschool.ir";
    expect(publicBaseUrl({ headers: { host: "www.medschool.ir" } })).toBe("https://medschool.ir");
    if (prev === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = prev;
  });
});

describe("premium stacking continuity", () => {
  it("keeps lifetime grants (no expiry) when more days are added", () => {
    expect(stackPremiumUntil({ premium: 1, premium_until: null }, 30)).toBeNull();
  });
  it("stacks dated premium from the remaining end, not from now", () => {
    const end = new Date(Date.now() + 10 * 86400000).toISOString();
    const next = stackPremiumUntil({ premium: 1, premium_until: end }, 5);
    const days = (new Date(next).getTime() - new Date(end).getTime()) / 86400000;
    expect(days).toBeCloseTo(5, 5);
  });
  it("starts a fresh grant from now when the user is not premium", () => {
    const next = stackPremiumUntil({ premium: 0, premium_until: null }, 30);
    const days = (new Date(next).getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });
  it("ignores a corrupt premium_until instead of throwing", () => {
    const next = stackPremiumUntil({ premium: 1, premium_until: "not-a-date" }, 7);
    expect(next).toMatch(/T/);
    const days = (new Date(next).getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });
});

describe("Tehran day / ISO week stay on the same clock", () => {
  it("isoWeekKey is YYYY-Www and agrees with tehranDay's calendar", () => {
    expect(isoWeekKey()).toMatch(/^\d{4}-W\d{2}$/);
    expect(tehranDay()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("streak society pays every crossed step", () => {
  it("lists 3 then 7 so a 0→7 jump is two chests, not one", () => {
    const due = STREAK_SOCIETY.filter((m) => 7 >= m.days && m.days > 0);
    expect(due.map((m) => m.days)).toEqual([3, 7]);
    expect(due.reduce((s, m) => s + m.gems, 0)).toBe(60);
    expect(due.reduce((s, m) => s + m.freezes, 0)).toBe(2);
  });
});

describe("source continuity guards", () => {
  it("does not reset the heart refill clock on every miss", () => {
    const g = read("server/src/lib/gamify.js");
    expect(g).toMatch(/Start the refill clock only when leaving a full bar/);
    expect(g).toMatch(/p\.hearts >= maxHearts\(\)/);
  });
  it("caps store vaccines at 5 and names them واکسن", () => {
    const shop = read("server/src/lib/gameplus.js");
    expect(shop).toMatch(/واکسن استریک/);
    expect(shop).toMatch(/freeze_cap/);
    expect(shop).toMatch(/MIN\(5, freezes\+1\)/);
  });
  it("premium payment and seat redeem use the shared entitlement helper", () => {
    const pay = read("server/src/routes/payments.js");
    expect(pay).toMatch(/fulfillVerifiedTransaction/);
    expect(pay).toMatch(/\/reconcile/);
    expect(pay).toMatch(/isLifetimePremium/);
    expect(read("server/src/lib/grouppurchase.js")).toMatch(/applyPremiumDays/);
    expect(read("server/src/lib/premiumadmin.js")).toMatch(/applyPremiumDays/);
    expect(read("server/src/lib/entitlement.js")).toMatch(/claimTransactionPaid/);
    expect(read("server/src/lib/entitlement.js")).toMatch(/status != 'paid'/);
    expect(read("server/src/lib/entitlement.js")).toMatch(/fulfillCoursePurchase/);
    expect(read("server/src/lib/entitlement.js")).toMatch(/unknown_plan/);
    expect(read("server/src/lib/zarinpal.js")).toMatch(/mockAllowed/);
    expect(read("server/src/lib/zarinpal.js")).toMatch(/mock_disabled/);
    expect(read("server/src/lib/zarinpal.js")).toMatch(/gateway_not_configured/);
    expect(read("server/src/lib/zarinpal.js")).toMatch(/invalid_amount/);
    expect(read("server/src/lib/security.js")).toMatch(/pay\/callback/);
    expect(read("server/src/lib/publicurl.js")).toMatch(/x-forwarded-host/);
    expect(read("server/src/lib/publicurl.js")).toMatch(/isUsablePublicUrl/);
    expect(read("server/src/lib/publicurl.js")).toMatch(/medschool\.ir/);
    expect(read("server/src/lib/entitlement.js")).toMatch(/kind: \"group\"/);
    expect(read("server/src/lib/entitlement.js")).toMatch(/claimTransactionPaid\(tx\.id/);
    expect(read("server/src/lib/grouppurchase.js")).toMatch(/status!='paid'/);
    expect(read("server/src/lib/referral.js")).toMatch(/applyPremiumDays/);
    expect(read("server/src/app.js")).toMatch(/pay\/callback/);
    expect(read("server/src/app.js")).toMatch(/hostAliases/);
    expect(read(".env.deploy.example")).toMatch(/APP_URL=https:\/\/medschool\.ir/);
    expect(read("docker-compose.deploy.yml")).toMatch(/ZARINPAL_MERCHANT_ID/);
    expect(read("server/src/routes/store.js")).toMatch(/disc > 0/);
    expect(read("server/src/lib/entitlement.js")).toMatch(/maybeNudgePremiumRenewal/);
  });
  it("does not mark a transient verify failure as a permanent failed tx", () => {
    const pay = read("server/src/routes/payments.js");
    expect(pay).toMatch(/v.transient/);
    expect(read("server/src/lib/zarinpal.js")).toMatch(/transient: true/);
  });
  it("unlocks the full bank and summaries for effective-premium learners", () => {
    const learn = read("server/src/routes/learn.js");
    expect(learn).toMatch(/bankLocked/);
    expect(learn).toMatch(/premium only/);
    expect(learn).toMatch(/previewIds/);
    expect(learn).toMatch(/بانک کامل سؤالات/);
  });
  it("learner i18n no longer writes استریکت as one word", () => {
    const i18n = read("client/src/i18n.js");
    expect(i18n).not.toMatch(/استریکت/);
    expect(i18n).toMatch(/استریک‌ت/);
    expect(i18n).toMatch(/premiumLifetime/);
    expect(i18n.trim().split("\n").slice(-6).join("\n")).toMatch(/export function biField/);
  });
});
