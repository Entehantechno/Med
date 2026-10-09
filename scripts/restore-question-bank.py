#!/usr/bin/env python3
"""Restore missing bank payloads, optionally a NEW demo DB, from the active ZIP.
Never overwrites existing source files or a database. No third-party packages.
"""
import argparse
from pathlib import Path, PurePosixPath
import re
import shutil
import sqlite3
import tempfile
from zipfile import ZipFile, BadZipFile

ROOT = Path(__file__).resolve().parents[1]
BANK = re.compile(r"tools/[^/]+-bank/import-payload(?:\.[a-z0-9-]+)?(?:\.part\d+)?\.json$", re.I)
DB_ENTRY = "demo-database/medlab.db"


def active_archive():
    name = (ROOT / "ACTIVE-PACKAGE.txt").read_text(encoding="utf-8").strip()
    if Path(name).name != name or not name.endswith(".zip"):
        raise ValueError("ACTIVE-PACKAGE.txt must contain one ZIP filename, not a path")
    return ROOT / name


def restore(archive, destination, database_to=None):
    destination = Path(destination).resolve()
    count = 0
    with ZipFile(archive) as bundle:
        payloads = []
        for item in bundle.infolist():
            name = PurePosixPath(item.filename)
            if name.is_absolute() or ".." in name.parts or "\\" in item.filename:
                raise ValueError("Unsafe archive path")
            if BANK.fullmatch(item.filename) and not item.is_dir():
                if item.file_size > 128 * 1024 * 1024:
                    raise ValueError("Oversized bank payload")
                target = destination.joinpath(*name.parts)
                if not target.resolve().is_relative_to(destination):
                    raise ValueError("Unsafe destination (symlink escape)")
                payloads.append((item, target))
        if not payloads:
            raise ValueError("No question-bank payloads in the selected ZIP")
        # Check the requested DB before making any changes.
        if database_to is not None:
            database_to = Path(database_to).absolute()
            if database_to.exists() or database_to.is_symlink():
                raise FileExistsError("Refusing to overwrite an existing database")
            info = bundle.getinfo(DB_ENTRY)
            if info.file_size > 256 * 1024 * 1024:
                raise ValueError("Oversized demo database")
        for item, target in payloads:
            if target.exists():
                continue
            data = bundle.read(item)  # verifies CRC before creating destination
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("xb") as out:
                out.write(data)
            count += 1
        if database_to is not None:
            database_to.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.TemporaryDirectory(dir=database_to.parent) as tmp:
                checked = Path(tmp) / "verified.db"
                with bundle.open(DB_ENTRY) as src, checked.open("wb") as out:
                    shutil.copyfileobj(src, out)
                with sqlite3.connect(checked.as_uri() + "?mode=ro", uri=True) as db:
                    if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                        raise ValueError("Demo database failed integrity check")
                with checked.open("rb") as src, database_to.open("xb") as out:
                    shutil.copyfileobj(src, out)
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, help="Override ACTIVE-PACKAGE.txt")
    parser.add_argument("--destination", type=Path, default=ROOT / ".work" / "proj")
    parser.add_argument("--database-to", type=Path, help="Optional NEW database path; never overwrite")
    args = parser.parse_args()
    try:
        archive = args.archive or active_archive()
        count = restore(archive, args.destination, args.database_to)
    except (OSError, ValueError, KeyError, sqlite3.Error, BadZipFile) as exc:
        parser.exit(1, f"Restore failed: {exc}\n")
    print(f"Restored {count} missing bank payloads from {archive.name}; existing files unchanged.")
    if args.database_to:
        print(f"Verified demo database restored to {args.database_to}")


if __name__ == "__main__":
    main()
