/* Seeds the database only if it is empty (no users).
   Safe to run on every container start — won't overwrite existing data. */
import { db, initDb, initSchema, reloadDb, persistNow } from "./db.js";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await initDb();
initSchema();
const count = db.prepare("SELECT COUNT(*) n FROM users").get()?.n ?? 0;

if (count === 0) {
  console.log("🌱 Empty database — seeding demo content…");
  // seed.js runs in a subprocess and writes the full DB to disk.
  execSync("node " + path.join(__dirname, "seed.js") + " --force", { stdio: "inherit" });
  // IMPORTANT: reload the freshly-seeded DB from disk into memory, otherwise this
  // parent process would flush its stale (empty) in-memory copy on exit and wipe it.
  await reloadDb();
  persistNow();
  const after = db.prepare("SELECT COUNT(*) n FROM users").get()?.n ?? 0;
  console.log(`✓ Seed complete — database now has ${after} users.`);
} else {
  console.log(`✓ Database already has ${count} users — skipping seed.`);
}
