#!/usr/bin/env python3
"""Restore only missing, unchanged tools/data from the delivered checkpoint.
The bank is carried once in the ZIP instead of a second 72 MB source patch.
Existing working files are never overwritten.
"""
from pathlib import Path, PurePosixPath
from zipfile import ZipFile

root = Path(__file__).resolve().parents[1]
archive = root / "MED-School-102-ACADEMIC-FINAL.zip"
destination = root / ".work" / "proj"
count = 0
with ZipFile(archive) as bundle:
    for item in bundle.infolist():
        name = PurePosixPath(item.filename)
        if not name.parts or name.parts[0] != "tools" or item.is_dir():
            continue
        if name.is_absolute() or ".." in name.parts or "\\" in item.filename:
            raise ValueError("Unsafe archive path")
        if item.file_size > 128 * 1024 * 1024:
            raise ValueError("Oversized data file")
        target = destination.joinpath(*name.parts)
        if target.exists():
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.resolve().is_relative_to(destination.resolve()):
            raise ValueError("Unsafe destination")
        target.write_bytes(bundle.read(item))
        count += 1
print(f"Restored {count} missing tooling/data files; existing files were unchanged.")
