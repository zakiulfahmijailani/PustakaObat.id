# Tugas integrasi paket Bahasa Indonesia Apoteq

Integrasikan paket `apoteq_indonesian_codex_v1` ke repository Apoteq sebagai data **staging/workbench**, bukan sebagai konten publik.

## Sebelum mengubah kode

1. Baca `README_CODEX.md`, `import_manifest.json`, dan `quality_report.json`.
2. Verifikasi semua checksum dalam manifest.
3. Pelajari skema staging, importer v2.2, halaman admin/reviewer, dan indeks pencarian yang sudah ada.
4. Pertahankan seluruh data WHO, evidence sumber, autentikasi, dan halaman publik yang sekarang.

## Implementasi yang diminta

- Buat migration yang additive bila skema belum dapat menyimpan nama Indonesia, alias dwibahasa, draft per bagian, QC flag, dan keputusan reviewer.
- Buat importer idempotent untuk tiga file utama:
  - `drug_names_indonesian.jsonl`
  - `drug_search_alias_candidates.jsonl`
  - `indonesian_monograph_candidates.jsonl`
- Tampilkan draft, evidence ID, sumber, QC flag, missing information, dan safety notes di workbench reviewer.
- Sediakan kolom keputusan apoteker per bagian: belum direview, perlu revisi, dan disetujui.
- Gunakan alias Indonesia dan Inggris untuk pencarian tanpa memanggil AI pada saat pengguna mencari.
- Jangan mengganti canonical drug ID atau membuat duplikat konsep obat.
- Pastikan pencarian `amoxicillin` dan `amoksisilin` menuju konsep obat yang sama.

## Larangan

- Jangan mengimpor langsung ke tabel monografi publik.
- Jangan mengubah `publication_eligible`, `is_public`, atau status hidden menjadi aktif.
- Jangan menampilkan raw source text sebagai konten pasien.
- Jangan menerbitkan bagian yang hanya berstatus `draft_ai`.
- Jangan menjalankan migration atau importer terhadap Neon production tanpa konfirmasi eksplisit pengguna setelah dry-run dan verifikasi target database.

## Verifikasi akhir

- 99 nama Indonesia.
- 242 alias pencarian tanpa duplicate key.
- 31 obat kandidat editorial.
- 364 draft bagian monografi.
- 0 fatal QC.
- 0 record publishable.
- Import kedua menghasilkan seluruh record `unchanged`.
- Unit test membuktikan pencarian nama Inggris dan Indonesia mengembalikan drug ID yang sama.
