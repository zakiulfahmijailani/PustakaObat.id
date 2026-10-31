# Penerimaan Kalkulator Neonatus — Prioritas 4

Acuan: *Spesifikasi Fitur — Kalkulator Antibiotik Neonatus (Versi Aturan 2026.11.01)*, bagian 9. **Dokumen ini adalah checklist pengujian internal, bukan pengganti 9 kasus dari Instruksi Admin peneliti.**

## Status bukti (31 Oktober 2026)
- [x] Tes otomatis batas PMA, usia, dan contoh amikasin dari spesifikasi ditambahkan (`acceptance-priority4.test.ts`).
- [x] Tes konstruksi Excel enam sheet dan PDF signature ditambahkan.
- [ ] Hasil CI lint, typecheck, unit tests, build dinyatakan hijau pada commit terbaru.
- [ ] File asli `uji_web_1_unggah_ke_batch.xlsx` tersedia.
- [ ] File asli `uji_web_2_pembanding.xlsx` tersedia dengan sheet `Diharapkan`, `Hasil Web`, `Cek`.
- [ ] Dokumen `Instruksi Admin` yang memuat sembilan kasus tampilan tersedia.
- [ ] Verifikasi eksploratif numerik Shapiro–Wilk, paired t-test, Wilcoxon, McNemar terhadap notebook/R/SciPy.
- [ ] Tinjauan klinis tertulis (termasuk kebijakan asumsi fungsi ginjal ketika kreatinin tidak tersedia).

## Uji wajib 34 kasus web
1. Pada versi staging, unduh template dan unggah `uji_web_1_unggah_ke_batch.xlsx`.
2. Proses batch dan unduh hasil.
3. Verifikasi 30 baris dihitung dan 4 dilewati (sesuai peneliti).
4. Salin isi sheet `Hasil per Pasien` ke `Hasil Web` dalam `uji_web_2_pembanding.xlsx`, ikuti instruksi peneliti.
5. Pastikan sheet `Cek` berbunyi persis **LULUS: hasil web sama dengan notebook**.
6. Simpan bukti (waktu, URL staging, commit SHA, tangkapan layar sheet Cek) tanpa data identitas pasien.

## Sembilan area interaksi yang perlu dicakup pada staging
Ini adalah daftar **area** yang diturunkan dari spesifikasi bagian 2–9, **bukan** sembilan kasus test-ID resmi Instruksi Admin:
1. Formulir awal: semua angka kosong, antibiotik belum dipilih, label kode kasus non-identifying.
2. Validasi gagal: 29 hari, 7 tambahan hari, angka bukan numerik, berat dalam gram, dan beberapa error tampil bersamaan.
3. Kasus amikasin 29 minggu 3 hari, PNA 3 hari, 1,1 kg = ANMF 15,4 mg tiap 48 jam.
4. Kotak peringatan merah, kuning, biru, hijau; urutan dan legenda.
5. Evaluasi pemberian mandiri tanpa hasil rekomendasi.
6. Manual opsional: centang on/off mengubah input, tabel dan PDF.
7. Pasien Baru mereset formulir; Riwayat terpisah bertambah lalu hilang setelah reload.
8. PDF rekomendasi dan evaluasi dapat dibuka, sesuai halaman aktif, angka/tata letak benar.
9. Template Batch, validasi baris, enam sheet ekspor, PDF batch serta privasi.

## Kriteria STOP (tidak boleh merge/deploy)
- Perbedaan dosis, interval, atau hasil evaluasi dari acuan notebook tanpa keputusan klinis tertulis.
- Perubahan silent pada batas nilai input.
- Data klinis diberi status normal padahal tidak ada bukti pengukuran dan belum ada kebijakan klinis yang disetujui.
- Kegagalan CLI/CI/build, ketidaksesuaian berkas pembanding, bug PDF, atau data pasien terungkap.
- Algoritma statistik hanya lolos smoke test tanpa benchmark independen.

Semua PR #4–#7 masih berupa draft/stacked; **tidak ada izin rilis implisit**.
