/* digits.js — Persian (۰-۹) and Arabic-Indic (٠-٩) digits are treated as the
   same as ASCII 0-9 everywhere an account identifier or password is compared.
   Student numbers and usernames are stored in ASCII digits; any input in another
   digit set is converted before lookup, hashing or comparison. */
const FA = "۰۱۲۳۴۵۶۷۸۹";
const AR = "٠١٢٣٤٥٦٧٨٩";

export function toAsciiDigits(s) {
  if (s == null) return "";
  return String(s)
    .replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)));
}

export function hasNonAsciiDigits(s) {
  return /[۰-۹٠-٩]/.test(String(s ?? ""));
}

/* One-time, idempotent: rewrite stored usernames / student numbers that were saved
   with Persian or Arabic digits to ASCII. A row is skipped when the ASCII value is
   already taken, so no account is merged or overwritten. Returns counts. */
export function normalizeAccountDigits(db) {
  const out = { usernames: 0, studentNos: 0, skipped: 0 };
  const rows = db.prepare("SELECT id, username, student_no FROM users").all()
    .filter((r) => hasNonAsciiDigits(r.username) || hasNonAsciiDigits(r.student_no));
  const taken = db.prepare("SELECT 1 FROM users WHERE (username = ? OR student_no = ?) AND id != ? LIMIT 1");
  const setUser = db.prepare("UPDATE users SET username=? WHERE id=?");
  const setNo = db.prepare("UPDATE users SET student_no=? WHERE id=?");
  db.transaction(() => {
    for (const r of rows) {
      const u = hasNonAsciiDigits(r.username) ? toAsciiDigits(r.username) : null;
      const n = hasNonAsciiDigits(r.student_no) ? toAsciiDigits(r.student_no) : null;
      if (u && u !== r.username && taken.get(u, u, r.id)) { out.skipped++; }
      else if (u && u !== r.username) { setUser.run(u, r.id); out.usernames++; }
      if (n && n !== r.student_no) {
        if (taken.get(n, n, r.id)) out.skipped++;
        else { setNo.run(n, r.id); out.studentNos++; }
      }
    }
  })();
  return out;
}

const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";
export function toPersianDigits(s) {
  return String(s ?? "").replace(/[0-9]/g, (d) => PERSIAN[Number(d)]);
}

/* Candidate spellings of a typed password for verification: as typed, ASCII digits,
   and Persian digits (hashes created before normalisation may use Persian digits). */
export function passwordVariants(pw) {
  const raw = String(pw ?? "");
  return [...new Set([raw, toAsciiDigits(raw), toPersianDigits(toAsciiDigits(raw))])];
}
