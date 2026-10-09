import importlib.util
import sqlite3
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

spec = importlib.util.spec_from_file_location('restore', Path(__file__).with_name('restore-question-bank.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class RestoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.zip = self.root / 'package.zip'
        self.bank = 'tools/master-bank/import-payload.master-preint.part01.json'
        db = self.root / 'source.db'
        connection = sqlite3.connect(db)
        connection.execute('CREATE TABLE example (id INTEGER)')
        connection.commit()
        connection.close()
        with ZipFile(self.zip, 'w') as z:
            z.writestr(self.bank, '{"questions":[]}')
            z.write(db, module.DB_ENTRY)

    def test_missing_only_and_database_opt_in(self):
        dest = self.root / 'source'
        self.assertEqual(module.restore(self.zip, dest), 1)
        (dest / self.bank).write_text('local changes')
        self.assertEqual(module.restore(self.zip, dest), 0)
        self.assertEqual((dest / self.bank).read_text(), 'local changes')
        self.assertFalse((dest / module.DB_ENTRY).exists())
        target = self.root / 'new.db'
        module.restore(self.zip, dest, target)
        with sqlite3.connect(target) as db:
            self.assertEqual(db.execute('pragma integrity_check').fetchone()[0], 'ok')
        with self.assertRaises(FileExistsError):
            module.restore(self.zip, dest, target)

    def test_rejects_unsafe_archive_before_writing(self):
        with ZipFile(self.zip, 'a') as z:
            z.writestr('../escape', 'bad')
        with self.assertRaises(ValueError):
            module.restore(self.zip, self.root / 'dest')
        self.assertFalse((self.root / 'dest').exists())

    def test_rejects_symlink_escape(self):
        dest = self.root / 'dest'
        dest.mkdir()
        (dest / 'tools').symlink_to(self.root, target_is_directory=True)
        with self.assertRaises(ValueError):
            module.restore(self.zip, dest)

    def test_rejects_invalid_database_without_creating_target(self):
        with ZipFile(self.zip, 'w') as z:
            z.writestr(self.bank, '{}')
            z.writestr(module.DB_ENTRY, 'not a database')
        target = self.root / 'new.db'
        with self.assertRaises(sqlite3.DatabaseError):
            module.restore(self.zip, self.root / 'dest', target)
        self.assertFalse(target.exists())

if __name__ == '__main__':
    unittest.main()
