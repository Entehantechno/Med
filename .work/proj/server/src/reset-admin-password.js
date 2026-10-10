/* reset-admin-password.js — recovery tool for the site owner (run from a SERVER
   TERMINAL, e.g. cPanel → Terminal, never from the website).

   It gives the `admin` account a new random password, prints it ONCE, and also
   writes it to DATA_DIR/ADMIN-PASSWORD-RESET.txt (mode 0600). Existing sessions
   of the admin are signed out.

   IMPORTANT: stop the website first (cPanel → Setup Node.js App → Stop). A
   running server keeps the database in memory and would overwrite this change.
   Start the website again after the reset.

   Usage (inside the server folder):   npm run reset-admin-password -- --confirm

   The tool prints the database it changed. It must be the SAME database the website
   uses: if the website has DATA_DIR set (cPanel → Setup Node.js App → environment
   variables), set the same DATA_DIR in the terminal before running it. */
import fs from "fs";
import path from "path";
import crypto from "crypto";

if (!process.argv.includes("--confirm")) {
  console.error("Refusing to run without --confirm.");
  console.error("Stop the website first, then run:  npm run reset-admin-password -- --confirm");
  process.exit(1);
}

const { initDb, db, persistNow } = await import("./db.js");
const { hashPassword } = await import("./lib/password.js");
const { DATA_DIR, DB_PATH } = await import("./lib/paths.js");

await initDb();
const admin = db.prepare("SELECT id, username FROM users WHERE username='admin' AND role='admin'").get();
if (!admin) {
  console.error('No administrator account named "admin" was found in this database.');
  console.error("DATA_DIR used: " + DATA_DIR);
  process.exit(1);
}

const password = crypto.randomBytes(12).toString("base64url"); // 16 url-safe characters
db.prepare("UPDATE users SET password_hash=?, token_ver=COALESCE(token_ver,1)+1 WHERE id=?")
  .run(await hashPassword(password), admin.id);
persistNow({ throwOnError: true });

fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
const file = path.join(DATA_DIR, "ADMIN-PASSWORD-RESET.txt");
fs.writeFileSync(file, `admin\t${password}\n`, { mode: 0o600 });

console.log("");
console.log("✅ The administrator password was reset.");
console.log("   Database: " + DB_PATH);
console.log("   Username: admin");
console.log("   New password: " + password);
console.log("   Also saved to: " + file);
console.log("   Change it again after the first login (Admin panel).");
console.log("   Now start the website again.");
process.exit(0);
