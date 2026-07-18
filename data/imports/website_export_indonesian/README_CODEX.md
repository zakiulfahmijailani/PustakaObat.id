# Apoteq Indonesian Candidate Package — codex-id-1.0

Paket ini berisi kandidat nama, alias pencarian dwibahasa, dan draft monografi Bahasa Indonesia untuk staging/workbench Apoteq.

## Cakupan

- 99 konsep obat memiliki kandidat nama Indonesia.
- 242 alias pencarian mendukung nama/ejaan Indonesia dan Inggris.
- 31 obat berstatus core editorial candidate memiliki 364 draft bagian monografi.
- 11 evidence milik 2 obat non-kandidat disimpan terpisah dan tidak dibuatkan draft.
- 0 record boleh dipublikasikan otomatis.

## Aturan wajib importer

1. Verifikasi checksum `import_manifest.json` sebelum menulis database.
2. Upsert hanya ke staging/workbench; jangan mengubah monografi publik.
3. Pertahankan `requires_pharmacist_review=true`, `publication_eligible=false`, dan `is_public=false`.
4. Alias boleh dipakai untuk pencarian setelah kontrak indeks diperiksa, tetapi tidak mengubah identitas canonical drug.
5. Draft bagian harus ditampilkan bersama evidence ID, sumber, QC flag, dan status review.
6. Jangan menyalin `source_text` mentah ke halaman publik.
7. Publikasi memerlukan persetujuan apoteker per bagian serta workflow terpisah.

## Pemakaian AI

Model lokal hanya digunakan sekali untuk menyiapkan draft. Pencarian pengguna tidak memanggil Gemini/model lain dan tidak mengonsumsi token AI. Seluruh draft otomatis tetap memerlukan review manusia.

## Urutan baca untuk Codex

1. `README_CODEX.md`
2. `import_manifest.json`
3. `quality_report.json`
4. `drug_names_indonesian.jsonl`
5. `drug_search_alias_candidates.jsonl`
6. `indonesian_monograph_candidates.jsonl`
7. `review_apoteker.xlsx`
