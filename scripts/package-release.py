#!/usr/bin/env python3
"""Overlay application source/build on a verified previous ZIP; retain runtime data.
Reports stay outside the archive. Never package the developer's .env.
"""
import argparse,os,zipfile,re
from datetime import date
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--base',required=True);p.add_argument('--output',required=True);p.add_argument('--source',default='.work/proj');p.add_argument('--date',default=date.today().isoformat());args=p.parse_args()
src=Path(args.source);out=Path(args.output);tmp=out.with_suffix('.zip.tmp');entries={}
def excluded(n):
 return ((n.startswith('tools/') and not re.fullmatch(r'tools/[^/]+-bank/import-payload(\.[a-z0-9-]+)?(\.part\d+)?\.json',n,re.I) and n not in {'tools/convert-past-exam-csv-to-import-json.mjs','tools/past-exam-csv-template.csv'})
  or Path(n).suffix.lower() in {'.md','.doc','.docx','.log','.map'}
  or n.startswith(('docs/','reports/','server/test/','client/src/test/','client/e2e/','e2e/','.github/'))
  or re.search(r'(^|/)[^/]+\.(test|spec)\.[cm]?[jt]sx?$',n)
  or re.search(r'(^|/)(vitest|playwright)\.config\.',n)
  or n in {'scripts/audit-check.mjs','scripts/capacity-bench.mjs','scripts/check-release-zip.mjs','scripts/test_restore_question_bank.py'})
with zipfile.ZipFile(args.base) as base:
 for n in base.namelist():
  if n.endswith('/') or n.startswith('client/dist/') or n=='.env':continue
  if excluded(n):continue
  local=src/n
  retained=n.startswith(('demo-database/','tools/'))
  entries[n]=base.read(n) if retained or not local.is_file() else local.read_bytes()
for folder in ['client/dist','client/src','server/src']:
 for local in (src/folder).rglob('*'):
  if local.is_file() and not excluded(local.relative_to(src).as_posix()):
   entries[local.relative_to(src).as_posix()]=local.read_bytes()
entries['.env']=(src/'.env.ready').read_bytes()
assert not any(l.startswith(b'JWT_SECRET=') and l.split(b'=',1)[1].strip() for l in entries['.env'].splitlines())
with zipfile.ZipFile(tmp,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for n,data in sorted(entries.items()):
  assert not n.startswith('/') and '..' not in Path(n).parts
  info=zipfile.ZipInfo(n,date_time=(*map(int,args.date.split("-")),0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=(0o100755 if n.endswith(('.sh','.py')) else 0o100644)<<16;z.writestr(info,data)
with zipfile.ZipFile(tmp) as z:assert z.testzip() is None
os.replace(tmp,out);print(f'{out}: {out.stat().st_size} bytes, {len(entries)} files')
