# -*- coding: utf-8 -*-
"""Regression checks for the read-only round63 rewrite-specification dossier."""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import unittest
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DOCS = ROOT / ".work" / "proj" / "docs"
BANK = ROOT / ".work" / "proj" / "tools" / "master-bank"
PARTS = (23, 24, 25, 27, 28, 29)
DOSSIER = DOCS / "round63-rewrite-specification.json"
BRIEF = HERE / "rewrite-specification-brief.md"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical_hash(value: object) -> str:
    text = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def question(part: int, local_question: int) -> dict:
    payload = json.loads((BANK / f"import-payload.master-preint.part{part:02d}.json").read_text(encoding="utf-8"))
    return payload["questions"][local_question - 1]


class Round63RewriteSpecificationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.payloads = [BANK / f"import-payload.master-preint.part{part:02d}.json" for part in PARTS]
        cls.before = {path: digest(path) for path in cls.payloads}
        subprocess.run([sys.executable, str(HERE / "curate_round63.py")], cwd=ROOT, check=True)
        cls.after = {path: digest(path) for path in cls.payloads}
        cls.dossier = json.loads(DOSSIER.read_text(encoding="utf-8"))

    def test_curator_is_read_only_for_all_relevant_canonical_payloads(self) -> None:
        self.assertEqual(self.before, self.after)
        protected = self.dossier["protected_payload_sections"]
        self.assertTrue(protected["unchanged"])
        self.assertEqual(protected["before_sha256"], protected["after_sha256"])
        self.assertEqual(protected["parts"], list(PARTS))
        self.assertEqual(protected["after_sha256"], {str(part): self.after[BANK / f"import-payload.master-preint.part{part:02d}.json"] for part in PARTS})

    def test_scope_is_all_and_only_the_27_prior_rewrite_records(self) -> None:
        r60 = json.loads((DOCS / "round60-open-evidence.json").read_text(encoding="utf-8"))
        r61 = json.loads((DOCS / "round61-remaining-review.json").read_text(encoding="utf-8"))
        r62 = json.loads((DOCS / "round62-legacy-review.json").read_text(encoding="utf-8"))
        expected = set()
        expected |= {(r["part"], r["local_question"]) for r in r60["rows"] if r["review_route"] == "needs_editorial_rewrite"}
        expected |= {(r["part"], r["local_question"]) for r in r61["rows"] if r["review_route"] == "editorial_rewrite_required"}
        expected |= {(r["part"], r["local_question"]) for r in r62["rows"] if r["classification"] == "rewrite_or_ambiguity"}
        actual = [(r["part"], r["local_question"]) for r in self.dossier["rows"]]
        self.assertEqual(len(expected), 27)
        self.assertEqual(len(actual), 27)
        self.assertEqual(set(actual), expected)
        self.assertEqual(len(actual), len(set(actual)))
        self.assertNotIn((25, 136), set(actual))
        self.assertEqual(self.dossier["scope"], {
            "round60_editorial_rewrite": 9,
            "round61_editorial_rewrite": 12,
            "round62_rewrite_or_ambiguity": 6,
            "total": 27,
        })

    def test_no_key_recommendation_or_replacement_text_is_smuggled_into_the_dossier(self) -> None:
        forbidden = {
            "proposed_index", "proposed_option_fa", "proposed_question_fa",
            "replacement_question_fa", "replacement_options_fa", "options_replacement_fa",
        }
        for row in self.dossier["rows"]:
            self.assertFalse(row["content_mutation_allowed"])
            self.assertFalse(row["key_mutation_allowed"])
            self.assertFalse(row["rewrite_text_proposed"])
            self.assertIsNone(row["correct_index_recommendation"])
            self.assertTrue(forbidden.isdisjoint(row))
            self.assertIn("مجوز مستقل و صریح کاربر", row["authorization_gate_fa"])
            self.assertGreaterEqual(len(row["minimum_context_fa"]), 3)
            self.assertGreaterEqual(len(row["option_design_rules_fa"]), 3)

    def test_each_snapshot_still_exactly_matches_the_canonical_question(self) -> None:
        for row in self.dossier["rows"]:
            item = question(row["part"], row["local_question"])
            snapshot = row["question_snapshot"]
            self.assertEqual(row["id"], item["tags"][0])
            self.assertEqual(snapshot["question_fa"], item["question_fa"])
            self.assertEqual(snapshot["options_fa"], item["options_fa"])
            self.assertEqual(snapshot["correct_index_before"], item["correct_index"])
            self.assertEqual(snapshot["question_sha256"], canonical_hash(item))

    def test_primary_blocker_and_priority_counts_are_complete(self) -> None:
        categories = Counter(row["primary_blocker"] for row in self.dossier["rows"])
        priorities = Counter(row["action_priority"] for row in self.dossier["rows"])
        self.assertEqual(dict(categories), {
            "missing_or_corrupt_decision_data": 7,
            "nonunique_or_undefined_construct": 10,
            "protocol_safety_or_guideline_drift": 10,
        })
        self.assertEqual(dict(priorities), {"high": 14, "medium": 13})
        self.assertEqual(self.dossier["primary_blocker_counts"], dict(sorted(categories.items())))
        self.assertEqual(self.dossier["action_priority_counts"], dict(sorted(priorities.items())))
        self.assertTrue(all(row["primary_blocker_fa"] for row in self.dossier["rows"]))
        self.assertTrue(all(row["action_priority_fa"] in {"بالا", "متوسط"} for row in self.dossier["rows"]))

    def test_sources_are_https_and_used_by_every_record(self) -> None:
        registry = self.dossier["reference_registry"]
        self.assertGreaterEqual(len(registry), 20)
        for row in self.dossier["rows"]:
            self.assertTrue(row["reference_ids"])
            for ident in row["reference_ids"]:
                self.assertIn(ident, registry)
                ref = registry[ident]
                self.assertTrue(ref["url"].startswith("https://"))
                self.assertTrue(ref["title_fa"])
                self.assertTrue(ref["use_fa"])
        self.assertIn("cdc_immunization_best_practices", registry)
        self.assertIn("figo_vbac_2025", registry)

    def test_queue_and_exclusions_stay_explicit(self) -> None:
        self.assertEqual(self.dossier["status"], "reviewed_not_applied")
        self.assertEqual(self.dossier["round"], 63)
        self.assertEqual(self.dossier["review_date"], "2026-09-24")
        self.assertEqual(self.dossier["upstream_queue_status"]["actionable_total_unchanged"], 105)
        exclusions = "\n".join(self.dossier["exclusions_fa"])
        self.assertIn("۱۵ مورد", exclusions)
        self.assertIn("55", exclusions.replace("۵۵", "55"))
        self.assertIn("25:136", exclusions)

    def test_human_brief_explains_the_nonapplying_contract(self) -> None:
        text = BRIEF.read_text(encoding="utf-8")
        self.assertIn("هیچ متن سؤال، گزینه، کلید", text)
        self.assertIn("۱۴ بالا", text)
        self.assertIn("۱۳ متوسط", text)
        self.assertIn("دادهٔ تصمیم‌ساز مفقود یا مخدوش", text)
        self.assertIn("بازبینی بالینی دوم", text)
        self.assertEqual(text.count("### `"), 27)


if __name__ == "__main__":
    unittest.main(verbosity=2)
