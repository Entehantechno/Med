// Explicit academic provisioning; same safe operation used at application boot.
import {initDb,initSchema} from './db.js';
import {ensureEmergencyCases} from './lib/emergency-provision.js';
await initDb();initSchema();
const result=ensureEmergencyCases(process.env.UNIVERSITY_ID?{universityId:process.env.UNIVERSITY_ID}:{});
if(result.reason==='university_missing')throw new Error('University required');
console.log(result);
