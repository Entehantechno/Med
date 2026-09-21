#!/usr/bin/env node
/* audit-check.mjs — fail a release when a production dependency carries a
   HIGH or CRITICAL advisory. Run from BOTH workspaces: node ../../scripts/audit-check.mjs
   Exit code 0 when clean (or only dev/optional moderate noise). */
import { execSync } from "child_process";

const cwd = process.argv[2] || process.cwd();
let out = "";
try {
  out = execSync("npm audit --json --omit=dev", { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (e) {
  out = e.stdout?.toString?.() || e.message;   // npm audit exits 1 when findings exist
}
let report;
try { report = JSON.parse(out); } catch { console.error("[audit] could not parse npm audit output"); process.exit(2); }
const meta = report.metadata?.vulnerabilities || {};
const high = Number(meta.high || 0), critical = Number(meta.critical || 0);
console.log(`[audit] prod dependencies — critical: ${critical}, high: ${high}, moderate: ${meta.moderate || 0}, low: ${meta.low || 0}`);
if (critical > 0 || high > 0) {
  const bad = [];
  for (const [name, v] of Object.entries(report.vulnerabilities || {})) {
    if ((v.severity === "high" || v.severity === "critical") && !v.isDirect && (v.depType || "prod") !== "dev") bad.push(`${name} (${v.severity})`);
    else if ((v.severity === "high" || v.severity === "critical")) bad.push(`${name} (${v.severity})`);
  }
  console.error("[audit] BLOCKED — run `npm audit` for details:\n  " + bad.slice(0, 20).join("\n  "));
  process.exit(1);
}
console.log("✅ npm audit gate passed (no high/critical in production deps)");
