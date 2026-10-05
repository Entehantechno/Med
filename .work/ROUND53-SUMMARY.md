# Round 53 — publication summary (2026-09-22, rebuilt after two sandbox resets)

- Scope: paediatrics part27 rows 26-220 (195) + part28 rows 1-5 (5) = 200; enriched 148 (143 + 5) with 139 shared clinical units (topics merged across near-duplicate vignettes)
- Deferred NEW: part27 52 rows (needs-final-review, protected text untouched) → docs/round53-deferred.json (cumulative queue 82 + 52 = 134)
- Content files: tools/round53_items.py, tools/round53_lessons.py, tools/enrich_round53.py
- Fixture: server/test/fixtures/round53-preservation.json (baseline MED-School-100-round52.zip state)
- Tests: npx vitest run test/master-bank.test.js → 49/49 green (round53 boundary suite + part28 hash chain + round52 suite chained)
- Release: MED-School-100-round53.zip (19.1 MB, 989 files) — check-release-zip passed (54 bank payloads, 79 markers); round52 zip deleted
- Pushes: c0c546e (content+payloads+fixture+defer queue), 536d5bc (test patch), this commit (zip + docs)
- Final zip sha256: b0cdbb3bb68edd33371d76739b0547a9642830f38d70ae2363b65bcf5ddb986b
