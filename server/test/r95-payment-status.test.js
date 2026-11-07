// R95 — a payment gateway that is not configured is a service-unavailable state (503),
// not a bad upstream response (502). Written to FAIL before the helper existed.
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { gatewayErrorStatus } from "../src/lib/zarinpal.js";

const read = (rel) => fs.readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8");

describe("R95 gatewayErrorStatus", () => {
  it("maps a missing gateway configuration to 503", () => {
    expect(gatewayErrorStatus("gateway_not_configured")).toBe(503);
    expect(gatewayErrorStatus("mock_disabled")).toBe(503);
  });
  it("keeps 502 for genuine upstream failures", () => {
    expect(gatewayErrorStatus("verify failed")).toBe(502);
    expect(gatewayErrorStatus("gateway error")).toBe(502);
    expect(gatewayErrorStatus(undefined)).toBe(502);
  });
  it("the payment and store checkout routes use the helper instead of a hard-coded 502", () => {
    for (const f of ["server/src/routes/payments.js", "server/src/routes/store.js"]) {
      const src = read(f);
      expect(src).toMatch(/gatewayErrorStatus\(pay\.error\)/);
      expect(src).not.toMatch(/res\.status\(502\)\.json\(\{ error: pay\.error/);
    }
  });
});
