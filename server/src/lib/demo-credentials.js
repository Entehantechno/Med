/* demo-credentials.js — the shipped demo database (and `npm run seed`) gives every
   demo account the public password "demo", including the administrator. A public
   installation must never keep that password.

   - Fresh install (bundle or seed): every account whose password is still "demo"
     gets a random password. The new passwords are written ONCE to a 0600 file in
     DATA_DIR (never into the code or the zip).
   - Existing installation: nothing is changed automatically (that could lock real
     users out). The server logs a loud warning instead, and the admin changes the
     password from the admin panel. */
import { db } from "../db.js";
import { verifyPassword } from "./password.js";

/* Existing installation: warn, never change. Run in the background after boot. */
export async function warnIfDefaultAdminPassword() {
  const admin = db.prepare("SELECT id, password_hash FROM users WHERE username='admin' AND role='admin'").get();
  if (!admin?.password_hash) return;
  try {
    if (await verifyPassword("demo", admin.password_hash)) {
      console.error("⚠⚠⚠ [security] The administrator account still has the public demo password. Change it now in Admin → Users (or rotate it), before the site is public.");
    }
  } catch { /* ignore */ }
}
