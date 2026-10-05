# -*- coding: utf-8 -*-
"""Regression checks for the read-only round61 remaining-review docket."""
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
PARTS = (22, 23, 24, 25, 28)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def get_question(part, local_question):
    payload = json.loads((BANK / f"import-payload.master-preint.part{part:02d}.json").read_text(encoding="utf-8"))
    return payload["questions"][local_question - 1]


def fingerprint(question, defect):
    raw = "\n".join([
        question["tags"][0],
        question["question_fa"],
        *question["options_fa"],
        str(question["correct_index"]),
        defect,
    ])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class Round61RemainingReviewTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.payloads = [BANK / f"import-payload.master-preint.part{part:02d}.json" for part in PARTS]
        cls.before = {path: digest(path) for path in cls.payloads}
        subprocess.run([sys.executable, str(HERE / "curate_round61.py")], cwd=ROOT, check=True)
        cls.after = {path: digest(path) for path in cls.payloads}
        cls.docket = json.loads((DOCS / "round61-remaining-review.json").read_text(encoding="utf-8"))

    def test_curator_is_read_only_for_every_relevant_payload(self):
        self.assertEqual(self.before, self.after)
        self.assertTrue(all(row["content_mutation_allowed"] is False for row in self.docket["rows"]))
        self.assertTrue(all(row["key_mutation_allowed"] is False for row in self.docket["rows"]))
        self.assertTrue(all(row["status"] == "reviewed_not_applied" for row in self.docket["rows"]))

    def test_all_and_only_round59_broken_rows_are_covered_once(self):
        round59 = json.loads((DOCS / "round59-broken-recovery.json").read_text(encoding="utf-8"))
        expected = {(row["part"], row["local_question"]) for row in round59["rows"]}
        actual = [(row["part"], row["local_question"]) for row in self.docket["rows"]]
        self.assertEqual(len(actual), 27)
        self.assertEqual(set(actual), expected)
        self.assertEqual(len(actual), len(set(actual)))

    def test_route_counts_capture_the_final_safe_disposition(self):
        counts = {}
        for row in self.docket["rows"]:
            counts[row["review_route"]] = counts.get(row["review_route"], 0) + 1
        expected = {
            "source_artifact_required": 13,
            "editorial_rewrite_required": 12,
            "editorial_copy_deduplication_only": 1,
            "evidence_candidate_not_applied": 1,
        }
        self.assertEqual(counts, expected)
        for route, count in expected.items():
            self.assertEqual(self.docket[route], count)

    def test_source_blocked_rows_have_no_invented_key_and_exact_recovery_contract(self):
        rows = [row for row in self.docket["rows"] if row["review_route"] == "source_artifact_required"]
        self.assertEqual(len(rows), 13)
        for row in rows:
            self.assertIsNone(row["proposed_index"])
            self.assertIsNone(row["proposed_option_fa"])
            self.assertTrue(row["artifact_kind_fa"])
            self.assertTrue(row["minimum_artifact_fields_fa"])
            self.assertEqual(row["reference_ids"], [])
            question = get_question(row["part"], row["local_question"])
            self.assertIsNone(question.get("image"))
            self.assertIsNone(question.get("media"))
            self.assertIsNone((question.get("micro") or {}).get("media"))

    def test_only_the_zoster_row_has_a_new_nonapplying_key_candidate(self):
        candidates = [row for row in self.docket["rows"] if row["review_route"] == "evidence_candidate_not_applied"]
        self.assertEqual(len(candidates), 1)
        candidate = candidates[0]
        self.assertEqual((candidate["part"], candidate["local_question"], candidate["id"]), (25, 96, "QB-05583"))
        self.assertEqual(candidate["proposed_index"], 1)
        question = get_question(25, 96)
        self.assertEqual(candidate["current_index"], question["correct_index"])
        self.assertEqual(candidate["proposed_option_fa"], question["options_fa"][1])
        self.assertNotEqual(candidate["proposed_index"], question["correct_index"])
        self.assertTrue(candidate["requires_independent_second_review"])

    def test_measles_copy_row_keeps_current_key_and_only_flags_duplicate_choice(self):
        row = next(row for row in self.docket["rows"] if (row["part"], row["local_question"]) == (25, 136))
        self.assertEqual(row["review_route"], "editorial_copy_deduplication_only")
        self.assertIsNone(row["proposed_index"])
        question = get_question(25, 136)
        self.assertEqual(question["correct_index"], 0)
        self.assertEqual(question["options_fa"][2], question["options_fa"][3])
        self.assertEqual(row["current_index"], 0)

    def test_fingerprints_references_and_aggregate_queue_are_consistent(self):
        refs = self.docket["references"]
        for row in self.docket["rows"]:
            question = get_question(row["part"], row["local_question"])
            self.assertIn(row["id"], question["tags"])
            self.assertEqual(row["current_index"], question["correct_index"])
            self.assertEqual(row["current_option_fa"], question["options_fa"][question["correct_index"]])
            self.assertEqual(row["record_fingerprint_sha256"], fingerprint(question, row["original_defect_fa"]))
            for ref in row["reference_ids"]:
                self.assertIn(ref, refs)
                self.assertTrue(refs[ref]["url"].startswith("https://"))
        aggregate = self.docket["aggregate_deferred_queue"]
        self.assertEqual(sum(aggregate.values()), 106)
        self.assertEqual(aggregate["round61_evidence_candidate_not_applied"], 1)
        self.assertEqual(aggregate["editorial_copy_deduplication_only"], 1)
        provenance = self.docket["source_provenance"]
        self.assertEqual(provenance["status"], "no_provenance_safe_primary_artifact_found")
        self.assertEqual(provenance["external_lead"], "official_booklet_index")

    def test_human_report_has_all_protective_sections(self):
        text = (HERE / "remaining-review-brief.md").read_text(encoding="utf-8")
        self.assertIn("هیچ `question_fa`، `options_fa`، `correct_index`", text)
        self.assertIn("### ۱۳ نیاز منبع اولیه", text)
        self.assertIn("## ۱۴ نتیجهٔ تحریریه/شواهد", text)
        self.assertIn("تنها پیشنهاد تازهٔ کلید (`25:96 → 1`) **اعمال‌نشده**", text)
        self.assertEqual(text.count("#### "), 13)


if __name__ == "__main__":
    unittest.main(verbosity=2)
