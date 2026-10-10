/* users-role-migrate.js — widen the users.role CHECK constraint to include the
   newer roles (e.g. 'support') on databases created by older schema versions.

   SQLite cannot alter a CHECK constraint, so the table is rebuilt. The rebuild
   keeps EVERY existing column (email, university_id, token_ver, …), every
   index and trigger on the table, and the row count is verified before the
   old table is dropped. The whole rebuild runs in one transaction: any failure
   rolls back and leaves the original table in place. */
const ROLE_LIST = "'student','teacher','admin','learner','content_manager','support'";
const TMP = "users_role_migrating";

export function migrateUsersRoleCheck(db) {
  const usersSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get()?.sql || "";
  if (!usersSql || usersSql.includes("'support'")) return { migrated: false };
  const newDdl = usersSql
    .replace(/CHECK\s*\(\s*role\s+IN\s*\([^)]*\)\s*\)/i, `CHECK(role IN (${ROLE_LIST}))`)
    .replace(/^(\s*CREATE\s+TABLE\s+)(?:IF\s+NOT\s+EXISTS\s+)?("?)users\2(\s*\()/i, `$1${TMP}$3`);
  if (newDdl === usersSql || !newDdl.includes(TMP)) throw new Error("users_role_migration_unrecognised_schema");

  const oldCols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  const indexes = db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='users' AND sql IS NOT NULL").all().map((r) => r.sql);
  const triggers = db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND tbl_name='users' AND sql IS NOT NULL").all().map((r) => r.sql);
  const rowsBefore = Number(db.prepare("SELECT COUNT(*) AS n FROM users").get()?.n) || 0;

  db.exec("PRAGMA foreign_keys=OFF;");
  db.exec("BEGIN;");
  try {
    db.exec(newDdl + ";");
    const newCols = db.prepare(`PRAGMA table_info(${TMP})`).all().map((c) => c.name);
    const common = oldCols.filter((c) => newCols.includes(c));
    db.exec(`INSERT INTO ${TMP} (${common.join(",")}) SELECT ${common.join(",")} FROM users;`);
    const rowsAfter = Number(db.prepare(`SELECT COUNT(*) AS n FROM ${TMP}`).get()?.n) || 0;
    if (rowsAfter !== rowsBefore) throw new Error(`users_role_migration_row_mismatch:${rowsBefore}->${rowsAfter}`);
    db.exec("DROP TABLE users;");
    db.exec(`ALTER TABLE ${TMP} RENAME TO users;`);
    for (const sql of indexes) db.exec(sql + ";");
    for (const sql of triggers) db.exec(sql + ";");
    db.exec("COMMIT;");
    db.exec("PRAGMA foreign_keys=ON;");
    return { migrated: true, rows: rowsAfter, columnsKept: common.length, columnsLost: oldCols.filter((c) => !newCols.includes(c)) };
  } catch (e) {
    try { db.exec("ROLLBACK;"); } catch (_) { /* nothing open */ }
    db.exec("PRAGMA foreign_keys=ON;");
    throw e;
  }
}
