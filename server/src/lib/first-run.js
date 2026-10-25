// Provision the shipped demo ONLY when no destination database exists.
// Never import/reset over a retained installation. An atomic hard link publishes
// the complete image without replacing a database created by another process.
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
export function installBundledDemo({dbPath, dataDir, bundleDir}) {
  if (fs.existsSync(dbPath)) return {installed:false, reason:'existing_database'};
  const source=path.join(bundleDir,'medlab.db');
  if (!fs.existsSync(source)) return {installed:false,reason:'no_bundle'};
  fs.mkdirSync(path.dirname(dbPath),{recursive:true,mode:0o700});
  const temp=dbPath+'.bootstrap-'+process.pid+'-'+randomUUID();
  try {
    fs.copyFileSync(source,temp,fs.constants.COPYFILE_EXCL);
    fs.chmodSync(temp,0o600);
    const fd=fs.openSync(temp,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    const uploads=path.join(bundleDir,'uploads');
    if(fs.existsSync(uploads)) {
      fs.mkdirSync(path.join(dataDir,'uploads'),{recursive:true,mode:0o700});
      for(const entry of fs.readdirSync(uploads,{withFileTypes:true})) if(entry.isFile()) {
        try{fs.copyFileSync(path.join(uploads,entry.name),path.join(dataDir,'uploads',entry.name),fs.constants.COPYFILE_EXCL);}catch(e){if(e.code!=='EEXIST')throw e;}
      }
    }
    try{fs.linkSync(temp,dbPath);}catch(e){if(e.code==='EEXIST')return {installed:false,reason:'existing_database'};throw e;}
    return {installed:true};
  }finally{try{fs.unlinkSync(temp);}catch{}}
}
