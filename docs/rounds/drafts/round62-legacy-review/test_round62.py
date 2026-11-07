#!/usr/bin/env python3
"""Reproducibility and non-mutation tests for the round-62 review-only release."""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / ".work"
DOCS = WORK / "proj" / "docs"
BANK = WORK / "proj" / "tools" / "master-bank"
CURATOR = WORK / "round62-legacy-review" / "curate_round62.py"
DOSSIER = DOCS / "round62-legacy-review.json"
BRIEF = WORK / "round62-legacy-review" / "legacy-queue-review-brief.md"
PARTS = (23, 24, 25, 27, 28, 29)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    results: list[str] = []
    payload_paths = {part: BANK / f"import-payload.master-preint.part{part:02d}.json" for part in PARTS}
    before = {part: digest(path) for part, path in payload_paths.items()}

    # Rebuild review artifacts from the canonical input. The curator must remain
    # read-only for all legal-bank payloads.
    run = subprocess.run([sys.executable, str(CURATOR)], cwd=ROOT, text=True, capture_output=True)
    assert run.returncode == 0, run.stderr or run.stdout
    after = {part: digest(path) for part, path in payload_paths.items()}
    assert before == after, "canonical payload hash changed during review generation"
    results.append("PASS 1/10 — هش payload شش بخش پیش/پس از curator برابر است.")

    legacy = load(DOCS / "round58-key-proposals.json")["proposals"]
    outdated = [row for row in load(DOCS / "round58-outdated-rows.json")["rows"] if row.get("apply") is True]
    expected = {(row["part"], row["local_question"]): row for row in [*legacy, *outdated]}
    assert len(legacy) == 58 and len(outdated) == 6 and len(expected) == 64
    results.append("PASS 2/10 — دامنهٔ ورودی مستقل دقیقاً ۵۸+۶=۶۴ ردیف است.")

    dossier = load(DOSSIER)
    assert dossier["schema_version"] == "round62-legacy-review/v1"
    assert dossier["status"] == "reviewed_not_applied"
    assert dossier["round"] == 62
    assert dossier["scope"]["total"] == 64
    assert dossier["scope"]["legacy_key_proposals"] == 58
    assert dossier["scope"]["legacy_outdated_apply_true"] == 6
    results.append("PASS 3/10 — وضعیت review-only، نسخهٔ schema و دامنهٔ dossier معتبرند.")

    rows = dossier["rows"]
    row_keys = {(row["part"], row["local_question"]) for row in rows}
    assert len(rows) == 64 and row_keys == set(expected)
    assert len(row_keys) == len(rows)
    results.append("PASS 4/10 — هر ۶۴ ردیف دقیقاً یک‌بار پوشش داده شده و ردیف اضافی ندارد.")

    category_counts = Counter(row["classification"] for row in rows)
    disposition_counts = Counter(row["disposition"] for row in rows)
    priority_counts = Counter(row["action_priority"] for row in rows)
    assert dict(category_counts) == {
        "candidate_remaining": 56,
        "rewrite_or_ambiguity": 6,
        "source_or_context_required": 2,
    }
    assert dict(disposition_counts) == {
        "candidate_key_change_not_applied": 55,
        "legacy_proposal_rejected_current_key_retained": 1,
        "rewrite_required_no_key_change": 6,
        "source_or_context_required_no_key_change": 2,
    }
    assert dict(priority_counts) == {"medium": 55, "high": 8, "low": 1}
    assert dossier["classification_counts"] == dict(sorted(category_counts.items()))
    assert dossier["disposition_counts"] == dict(sorted(disposition_counts.items()))
    results.append("PASS 5/10 — breakdown ۵۶/۶/۲، disposition ۵۵/۱/۶/۲ و اولویت ۵۵/۸/۱ قفل شد.")

    expected_rewrite = {(27, 133), (27, 146), (27, 151), (27, 153), (29, 191), (24, 213)}
    expected_context = {(27, 174), (29, 218)}
    actual_rewrite = {(row["part"], row["local_question"]) for row in rows if row["classification"] == "rewrite_or_ambiguity"}
    actual_context = {(row["part"], row["local_question"]) for row in rows if row["classification"] == "source_or_context_required"}
    assert actual_rewrite == expected_rewrite
    assert actual_context == expected_context
    rejected = [row for row in rows if row["disposition"] == "legacy_proposal_rejected_current_key_retained"]
    assert len(rejected) == 1 and (rejected[0]["part"], rejected[0]["local_question"]) == (27, 175)
    results.append("PASS 6/10 — شش hold بازنویسی، دو hold بافت و رد proposal 27:175 دقیق‌اند.")

    # Independently verify all question snapshots, source fields, and that no
    # recommendation has been applied to correct_index in the canonical bank.
    for row in rows:
        key = (row["part"], row["local_question"])
        source = expected[key]
        question = load(payload_paths[key[0]])["questions"][key[1] - 1]
        assert question["tags"][0] == row["id"] == source["id"]
        assert question["correct_index"] == source["current_index"] == row["legacy_current_index"]
        assert question["question_fa"] == row["question_snapshot"]["question_fa"]
        assert question["options_fa"] == row["question_snapshot"]["options_fa"]
        assert question["correct_index"] == row["question_snapshot"]["correct_index_before"]
        canonical = json.dumps(question, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
        assert hashlib.sha256(canonical).hexdigest() == row["question_snapshot"]["question_sha256"]
        assert row["legacy_proposed_index"] == source["proposed_index"]
        assert row["legacy_current_option_fa"] == source["current_option_fa"]
        if row["disposition"] == "candidate_key_change_not_applied":
            assert row["round62_key_change_needed"] is True
            assert row["round62_recommendation_index"] == source["proposed_index"]
            assert question["correct_index"] != row["round62_recommendation_index"]
        elif row["disposition"] == "legacy_proposal_rejected_current_key_retained":
            assert row["round62_key_change_needed"] is False
            assert row["round62_recommendation_index"] == question["correct_index"]
        else:
            assert row["round62_key_change_needed"] is False
            assert row["round62_recommendation_index"] is None
    results.append("PASS 7/10 — snapshot همهٔ سؤال‌ها معتبر است و هیچ یک از کلیدها اعمال نشده‌اند.")

    protected = dossier["protected_payload_sections"]
    assert protected["unchanged"] is True and protected["parts"] == list(PARTS)
    expected_hashes = {str(part): before[part] for part in PARTS}
    assert protected["before_sha256"] == expected_hashes == protected["after_sha256"]
    results.append("PASS 8/10 — هش‌های ثبت‌شده در dossier نیز با payload واقعی تطابق دارند.")

    registry = dossier["reference_registry"]
    for row in rows:
        assert row["reference_ids"], row["id"]
        for reference_id in row["reference_ids"]:
            assert reference_id in registry
            assert registry[reference_id]["url"].startswith("https://")
    assert dossier["updated_deferred_queue"]["actionable_total"] == 105
    results.append("PASS 9/10 — همهٔ ردیف‌ها مرجع ثبت‌شده دارند و صف actionable=۱۰۵ است.")

    brief = BRIEF.read_text(encoding="utf-8")
    for heading in ("کاندیدای باقی‌مانده", "نیازمند بازنویسی/رفع ابهام", "نیازمند منبع یا بافت تکمیلی", "قفل‌های انتشار"):
        assert heading in brief
    for row in rows:
        assert f"`{row['part']}:{row['local_question']}`" in brief
    assert "هیچ `correct_index`، `question_fa`، `options_fa`" in brief
    results.append("PASS 10/10 — brief فارسی، همهٔ شناسه‌ها و قفل عدم‌اعمال را پوشش می‌دهد.")

    print("ROUND62 LEGACY REVIEW — TEST RESULT")
    print("=" * 44)
    print("\n".join(results))
    print("RESULT: PASS (۱۰/۱۰)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
