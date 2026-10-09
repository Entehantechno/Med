import request from 'supertest';
import {expect} from 'vitest';
import {db} from '../../src/db.js';
import {signToken} from '../../src/lib/auth.js';
import {referenceSnapshotForPolicy} from '../../src/lib/reference-governance.js';
// Synthetic approval belongs only to isolated test DBs, never to shipped data.
export async function approveTestReference(app,caseId=1) {
 const admin=signToken(db.prepare("SELECT * FROM users WHERE username='admin'").get());
 const teacher=signToken(db.prepare("SELECT * FROM users WHERE username='teacher'").get());
 const ref=await request(app).post('/api/academic/references').set('Authorization',`Bearer ${admin}`).send({code:`test-${Date.now()}-${Math.random()}`,title_en:'Synthetic test reference',rights_status:'metadata_only'});expect(ref.status).toBe(201);
 const policy=await request(app).post('/api/academic/policies').set('Authorization',`Bearer ${teacher}`).send({course_code:`test-${Date.now()}`,course_name_en:'Synthetic teaching fixture',reference_id:ref.body.reference.id,source_anchor:'Synthetic section 1',status:'approved',content_mode:'teacher_authored',teaching_basis_en:'Synthetic faculty-authored testing material. Ask about symptom onset and review the chart. Not medical guidance.'});expect(policy.status).toBe(201);expect(policy.body.policy.ready).toBe(true);
 const snapshot=referenceSnapshotForPolicy(policy.body.policy.id);expect(snapshot.ready).toBe(true);
 db.prepare('UPDATE cases SET reference_policy_id=?,reference_snapshot_json=? WHERE id=?').run(policy.body.policy.id,JSON.stringify(snapshot),caseId);
 return snapshot;
}
