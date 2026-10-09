import {beforeAll,it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import {db,initDb,durableTransaction} from '../src/db.js';
import {createApp} from '../src/app.js';
let app;
const login=password=>request(app).post('/api/auth/login').send({username:'admin',password});
const set=password=>durableTransaction(()=>db.prepare("UPDATE users SET password_hash=?,status='active' WHERE username='admin'").run(bcrypt.hashSync(password,8)));
beforeAll(async()=>{execFileSync(process.execPath,['src/seed.js','--force'],{stdio:'ignore'});await initDb();app=createApp();},60000);
it('rejects both default passwords after the administrator sets a custom password, without changing the credential',async()=>{
 set('Private-admin-password-34!');const before=db.prepare("SELECT password_hash FROM users WHERE username='admin'").get().password_hash;
 for(const p of ['demo','admin123']){const r=await login(p);expect(r.status).toBe(401);expect(r.body.token).toBeUndefined();expect(r.headers['set-cookie']).toBeUndefined();}
 expect(db.prepare("SELECT password_hash FROM users WHERE username='admin'").get().password_hash).toBe(before);
 expect((await login('Private-admin-password-34!')).status).toBe(200);
});
it('accepts the actual demo credential but not a different historical default',async()=>{set('demo');expect((await login('admin123')).status).toBe(401);expect((await login('demo')).status).toBe(200);});
it('accepts admin123 only when it is actually the stored credential',async()=>{set('admin123');expect((await login('demo')).status).toBe(401);expect((await login('admin123')).status).toBe(200);});
it('does not repair a corrupt hash using a publicly known default',async()=>{durableTransaction(()=>db.prepare("UPDATE users SET password_hash='corrupt' WHERE username='admin'").run());for(const p of ['demo','admin123'])expect((await login(p)).status).toBe(401);expect(db.prepare("SELECT password_hash FROM users WHERE username='admin'").get().password_hash).toBe('corrupt');});
