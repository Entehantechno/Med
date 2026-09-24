# -*- coding: utf-8 -*-
"""Regression checks for the review-only round60 evidence docket."""
import hashlib
import json
import subprocess
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DOCS = ROOT / ".work" / "proj" / "docs"
BANK = ROOT / ".work" / "proj" / "tools" / "master-bank"
PARTS = (22, 23, 24, 25, 27, 28)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def get_question(part, local_question):
    payload = json.loads((BANK / f"import-payload.master-preint.part{part:02d}.json").read_text(encoding="utf-8"))
    return payload["questions"][local_question - 1]


def fingerprint(item, reason):
    raw = "\n".join([
        item["tags"][0],
        item["question_fa"],
        *item["options_fa"],
        str(item["correct_index"]),
        reason,
    ])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class Round60OpenEvidenceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.payload_paths = [BANK / f"import-payload.master-preint.part{part:02d}.json" for part in PARTS]
        cls.before = {path: sha256(path) for path in cls.payload_paths}
        subprocess.run([sys.executable, str(HERE / "curate_round60.py")], cwd=ROOT, check=True)
        cls.after = {path: sha256(path) for path in cls.payload_paths}
        cls.docket = json.loads((DOCS / "round60-open-evidence.json").read_text(encoding="utf-8"))

    def test_curator_is_read_only_for_canonical_payloads(self):
        self.assertEqual(self.before, self.after)
        self.assertTrue(all(row["content_mutation_allowed"] is False for row in self.docket["rows"]))
        self.assertTrue(all(row["key_mutation_allowed"] is False for row in self.docket["rows"]))

    def test_exactly_the_fifteen_open_rows_are_covered_once(self):
        disputed = json.loads((DOCS / "round58-disputed-rows.json").read_text(encoding="utf-8"))
        outdated = json.loads((DOCS / "round58-outdated-rows.json").read_text(encoding="utf-8"))
        expected = {
            (row["part"], row["local_question"])
            for row in disputed["rows"]
        }
        expected |= {
            (row["part"], row["local_question"])
            for row in outdated["rows"] if row["apply"] is False
        }
        actual = [(row["part"], row["local_question"]) for row in self.docket["rows"]]
        self.assertEqual(len(actual), 15)
        self.assertEqual(set(actual), expected)
        self.assertEqual(len(actual), len(set(actual)))

    def test_routes_and_counts_are_deliberately_non_applying(self):
        candidates = [row for row in self.docket["rows"] if row["review_route"] == "evidence_candidate_not_applied"]
        rewrites = [row for row in self.docket["rows"] if row["review_route"] == "needs_editorial_rewrite"]
        self.assertEqual(len(candidates), 6)
        self.assertEqual(len(rewrites), 9)
        self.assertEqual(self.docket["evidence_candidate_not_applied"], 6)
        self.assertEqual(self.docket["needs_editorial_rewrite"], 9)
        self.assertTrue(all(row["status"] == "reviewed_not_applied" for row in self.docket["rows"]))
        self.assertTrue(all(row["requires_independent_second_review"] is True for row in self.docket["rows"]))
        self.assertTrue(all(row["proposed_index"] is None for row in rewrites))

    def test_every_candidate_matches_the_current_payload_without_changing_it(self):
        for row in self.docket["rows"]:
            item = get_question(row["part"], row["local_question"])
            self.assertIn(row["id"], item["tags"])
            self.assertEqual(row["current_index"], item["correct_index"])
            self.assertEqual(row["current_option_fa"], item["options_fa"][item["correct_index"]])
            self.assertEqual(row["record_fingerprint_sha256"], fingerprint(item, row["original_open_reason_fa"]))
            if row["proposed_index"] is not None:
                self.assertIn(row["proposed_index"], range(len(item["options_fa"])))
                self.assertNotEqual(row["proposed_index"], item["correct_index"])
                self.assertEqual(row["proposed_option_fa"], item["options_fa"][row["proposed_index"]])

    def test_references_are_declared_and_the_human_deliverables_exist(self):
        references = self.docket["references"]
        for row in self.docket["rows"]:
            for ref in row["reference_ids"]:
                self.assertIn(ref, references)
                self.assertTrue(references[ref]["url"].startswith("https://"))
        brief = (HERE / "evidence-brief.md").read_text(encoding="utf-8")
        snapshot = (HERE / "open-records.md").read_text(encoding="utf-8")
        self.assertIn("هیچ `question_fa`، `options_fa`، `correct_index`", brief)
        self.assertEqual(snapshot.count("## "), 15)


if __name__ == "__main__":
    unittest.main(verbosity=2)
