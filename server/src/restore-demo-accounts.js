// Explicit, opt-in reset for a DEMO database only. Never run at application boot.
if (!process.argv.includes('--confirm-demo') || !process.env.DATA_DIR || !['development', 'test'].includes(process.env.NODE_ENV)) {
  console.error('Demo only: set an explicit DATA_DIR and pass --confirm-demo (not in production).');
  process.exit(1);
}
const { initDb, db, persistNow } = await import('./db.js');
const { hashPasswordSync } = await import('./lib/password.js');
await initDb();
const accounts = [
  ['admin', 'admin', null], ['teacher', 'teacher', null],
  ['40012345', 'student', '40012345'], ['learner', 'learner', null],
];
const hash = hashPasswordSync('demo');
db.transaction(() => {
  if (!db.prepare('SELECT id FROM universities WHERE id=1').get()) throw new Error('Demo university 1 is missing; seed a fresh demo database first.');
  for (const [username, role, studentNo] of accounts) {
    const existing = db.prepare('SELECT id FROM users WHERE username=?').get(username);
    const university = role === 'learner' ? null : 1;
    if (existing) {
      db.prepare('UPDATE users SET password_hash=?,role=?,status=\'active\',student_no=?,university_id=? WHERE id=?')
        .run(hash, role, studentNo, university, existing.id);
    } else {
      db.prepare('INSERT INTO users (username,password_hash,name_fa,name_en,role,status,student_no,university_id) VALUES (?,?,?,?,?,\'active\',?,?)')
        .run(username, hash, username, username, role, studentNo, university);
    }
  }
})();
persistNow({ throwOnError: true });
console.log('Restored four demo accounts. Password: demo. Do not deploy these credentials publicly.');
