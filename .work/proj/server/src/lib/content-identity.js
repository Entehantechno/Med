import { isDeepStrictEqual } from 'node:util';
// Stable public identity is separate from a local integer PK and from row order.
// The permanent registry reserves deleted identities/source keys. No content or
// answers are stored in tombstones. Full SQLite backups preserve this registry.
export function masterSourceKey(question) {
  const tags = question?.source_meta?.tags || question?.tags || [];
  const tag = Array.isArray(tags) ? tags.find(t => typeof t === 'string' && /^(?:QB|RES(?:-QB)?|TB(?:-P[0-9]+)?)-[0-9]+$/.test(t)) : null;
  return tag ? `medschool:master-bank:${tag}` : null;
}

export function ensureContentIdentity(db) {
  db.exec('SAVEPOINT content_identity_migration');
  try { migrateIdentity(db); db.exec('RELEASE content_identity_migration'); }
  catch (e) { db.exec('ROLLBACK TO content_identity_migration'); db.exec('RELEASE content_identity_migration'); throw e; }
}

function migrateIdentity(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS content_identity_registry (
    public_code TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    source_key TEXT,
    deleted_at TEXT,
    UNIQUE(kind, source_key)
  )`);
  for (const table of ['cases', 'flashcards']) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    if (!cols.includes('public_code')) db.exec(`ALTER TABLE ${table} ADD COLUMN public_code TEXT`);
    if (!cols.includes('source_key')) db.exec(`ALTER TABLE ${table} ADD COLUMN source_key TEXT`);
    const prefix = table === 'cases' ? "'VP-'" : "CASE WHEN json_valid(data_json) AND json_extract(data_json,'$.track')='learn' THEN 'Q-' ELSE 'FC-' END";
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_public_code ON ${table}(public_code);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_source_key ON ${table}(source_key);
      CREATE TRIGGER IF NOT EXISTS ${table}_identity_no_reuse BEFORE INSERT ON ${table}
      WHEN EXISTS(SELECT 1 FROM ${table} WHERE id=NEW.id)
        OR (NEW.public_code IS NOT NULL AND EXISTS(SELECT 1 FROM content_identity_registry WHERE public_code=NEW.public_code))
        OR (NEW.source_key IS NOT NULL AND EXISTS(SELECT 1 FROM content_identity_registry WHERE kind='${table}' AND source_key=NEW.source_key))
      BEGIN SELECT RAISE(ABORT, 'content_identity_reserved'); END;
      CREATE TRIGGER IF NOT EXISTS ${table}_identity_assignment_guard BEFORE UPDATE OF public_code,source_key ON ${table}
      WHEN (OLD.public_code IS NULL AND NEW.public_code IS NOT NULL AND EXISTS(SELECT 1 FROM content_identity_registry WHERE public_code=NEW.public_code))
        OR (OLD.source_key IS NULL AND NEW.source_key IS NOT NULL AND EXISTS(SELECT 1 FROM content_identity_registry WHERE kind='${table}' AND source_key=NEW.source_key))
      BEGIN SELECT RAISE(ABORT, 'content_identity_reserved'); END;
      CREATE TRIGGER IF NOT EXISTS ${table}_identity_immutable BEFORE UPDATE OF public_code ON ${table}
      WHEN OLD.public_code IS NOT NULL AND NEW.public_code IS NOT OLD.public_code
      BEGIN SELECT RAISE(ABORT, 'content_code_immutable'); END;
      CREATE TRIGGER IF NOT EXISTS ${table}_source_immutable BEFORE UPDATE OF source_key ON ${table}
      WHEN OLD.source_key IS NOT NULL AND NEW.source_key IS NOT OLD.source_key
      BEGIN SELECT RAISE(ABORT, 'content_source_immutable'); END;
      CREATE TRIGGER IF NOT EXISTS ${table}_identity_new AFTER INSERT ON ${table}
      WHEN NEW.public_code IS NULL BEGIN
        UPDATE ${table} SET public_code=(${prefix}) || lower(hex(randomblob(16))) WHERE id=NEW.id;
      END;
      CREATE TRIGGER IF NOT EXISTS ${table}_identity_explicit AFTER INSERT ON ${table}
      WHEN NEW.public_code IS NOT NULL BEGIN
        INSERT INTO content_identity_registry(public_code,kind,entity_id,source_key)
        VALUES(NEW.public_code,'${table}',NEW.id,NEW.source_key);
      END;
      CREATE TRIGGER IF NOT EXISTS ${table}_identity_assign AFTER UPDATE OF public_code ON ${table}
      WHEN OLD.public_code IS NULL AND NEW.public_code IS NOT NULL BEGIN
        INSERT INTO content_identity_registry(public_code,kind,entity_id,source_key)
        VALUES(NEW.public_code,'${table}',NEW.id,NEW.source_key);
      END;
      CREATE TRIGGER IF NOT EXISTS ${table}_source_assign AFTER UPDATE OF source_key ON ${table}
      WHEN OLD.source_key IS NULL AND NEW.source_key IS NOT NULL BEGIN
        UPDATE content_identity_registry SET source_key=NEW.source_key WHERE public_code=NEW.public_code;
      END;
      CREATE TRIGGER IF NOT EXISTS ${table}_identity_retire AFTER DELETE ON ${table} BEGIN
        UPDATE content_identity_registry SET deleted_at=datetime('now') WHERE public_code=OLD.public_code;
      END;`);
    db.exec(`UPDATE ${table} SET public_code=(${prefix}) || lower(hex(randomblob(16))) WHERE public_code IS NULL`);
  }
  // One-time legacy binding: authored edits later cannot change the source key.
  const done = db.prepare("SELECT value FROM settings WHERE key='content_identity_backfill_v1'").get();
  if (!done) {
    const claimed = new Set(db.prepare("SELECT source_key FROM content_identity_registry WHERE kind='flashcards' AND source_key IS NOT NULL").all().map(r => r.source_key));
    for (const row of db.prepare(`SELECT id,json_extract(data_json,'$.source_meta.tags') tags
      FROM flashcards WHERE source_key IS NULL AND json_valid(data_json)
      AND json_extract(data_json,'$.source_meta.kind')='past_exam_import'`).all()) {
      let tags; try { tags = JSON.parse(row.tags || '[]'); } catch { continue; }
      const key = masterSourceKey({tags});
      if (!key || claimed.has(key)) continue; // intentional legacy copies retain independent codes
      db.prepare('UPDATE flashcards SET source_key=? WHERE id=?').run(key, row.id);
      claimed.add(key);
    }
    db.prepare("INSERT INTO settings(key,value) VALUES ('content_identity_backfill_v1','1')").run();
  }
}

// Preserve historical encounters. Archive duplicate competitive copies instead
// of deleting them; move unique legacy cases into the academic tenant 1.
export function universityOnlyCases(db) {
  const rows = db.prepare('SELECT id,data_json,university_id,active FROM cases').all();
  const academic = rows.filter(r => { try { return JSON.parse(r.data_json).track !== 'learn'; } catch { return false; } });
  for (const row of rows) {
    let d; try { d = JSON.parse(row.data_json); } catch { continue; }
    if (d.track !== 'learn') continue;
    const {track: _oldTrack, ...content} = d;
    const match = academic.find(r => { const {track: _track, ...other} = JSON.parse(r.data_json); return isDeepStrictEqual(content,other); });
    d.track = 'uni';
    d.retired_competitive_copy = !!match;
    db.prepare('UPDATE cases SET data_json=?,university_id=?,active=? WHERE id=?')
      .run(JSON.stringify(d), match?.university_id || 1, match ? 0 : row.active, row.id);
  }
}
