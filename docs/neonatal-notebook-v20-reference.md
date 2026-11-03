# Acuan pengujian kalkulator neonatus v20

## Status sesudah migrasi hasil batch, 3 November 2026

Enam pemeriksaan penerimaan batch sekarang lulus: 24 kolom pasien, seluruh 660 nilai yang diperiksa Excel Cek, statistik per antibiotik, rekap di atas/di bawah rentang beserta median pasien di luar rentang, McNemar, serta seluruh paragraf narasi enam bagian. Statistik dan narasi tambahan diuji terhadap Python v20 pada 14 kelompok (kosong, kecil, semua di dalam rentang, konstan, normal, nilai berulang, dan perhitungan manual).

Pengujian penerimaan batch kini ikut `npm test`, sehingga CI biasa juga menolaknya jika berubah. Pemeriksaan historis yang mematok statistik/narasi lama diganti dengan pembanding v20; dosis, interval, kategori, dan peringatan historis yang masih berlaku tetap diperiksa. Bagian pembekuan sumber di bawah mencatat keadaan sebelum migrasi, bukan hasil terkini.

Hasil akhir tahap migrasi: 302/302 pengujian lulus. Build produksi, pemeriksaan tipe, lint berkas yang berubah, dan pemeriksaan spasi Git lulus. Laporan pengujian lokal tersedia di `.tmp/review-v20/final-batch-v20-tests.json`.

**Versi aplikasi masih 2026.11.01.** Lulus pada penerimaan batch ini belum membuktikan seluruh persyaratan v20 untuk validasi isian tambahan, tampilan browser, PDF, dan cetak. Karena pembaruan label disyaratkan setelah kepatuhan keseluruhan terbukti, poin pembaruan versi belum ditandai selesai. Tidak ada publikasi.

Mulai 3 November 2026, sumber penerimaan perubahan berikutnya adalah notebook v20, versi aturan **2026.11.03**, dan dua Excel v20 yang diberikan pengguna. Identitas berkas ada pada `tests/fixtures/neonatal/v20/manifest.json`. Berkas asli disalin tanpa perubahan byte dan tidak dibaca dari Downloads saat pengujian berjalan.

## Sumber yang dibekukan

| Peran | Salinan dalam `tests/fixtures/neonatal/v20/` | SHA256 |
| --- | --- | --- |
| Aturan dan fungsi Python | `notebook-v20.ipynb` | `d78513e5ab8cd728dc230ad7f662d06378040707e2ab08daffcaf6d237917651` |
| 34 baris input | `batch-input-v20.xlsx` | `05a52548cad9d20fdaee1ee8b1c7540b6a513785c5250bd570522ebe9864f860` |
| Hasil dan rumus pembanding | `batch-comparator-v20.xlsx` | `f0dab30f11fbfb16b2e5949456576effed52a8de630296269cf856e1d0243f31` |
| Catatan review pendukung | `review-v19-to-v20.docx` | `f5c1f3a6e7c83d3e4b7d6be307d1930d4e6ec3dd7a90859be5b347f4fca5c782` |

Manifest menyimpan nama berkas asli, ukuran byte, sidik SHA256, versi, indeks sel notebook, dan jumlah kasus yang diharapkan. Pengujian juga mematok SHA256 secara terpisah. `.gitattributes` mencegah Git mengubah akhir baris sumber biner/notebook. Pembaruan sumber harus berupa revisi yang disengaja dan dapat ditinjau, bukan regenerasi nilai harapan dari aplikasi.

Catatan review adalah bahan spesifikasi pendukung. Dokumen itu tidak dijalankan dan tidak memberi izin otomatis untuk mengubah atau memublikasikan aplikasi.

## Eksekusi acuan

`scripts/neonatal-v20-oracle.py` memverifikasi identitas sumber, lalu menjalankan sel **3, 5, 6, 8, 10, 14, 18** dari notebook yang dibekukan. Hanya baris pemasangan paket `!pip` yang dihilangkan; output tampilan ditangkap. Fungsi dosis, evaluasi, validasi, statistik, dan interpretasi berasal langsung dari Python sumber. Pengujian bawaan yang menulis Excel memakai direktori sementara khusus yang dibersihkan setelah selesai.

Data input dibaca langsung dari sheet **Data Pasien** pada Excel sumber, bukan dari salinan baris dalam kode TypeScript. Hasil **Diharapkan** pada Excel pembanding direkonsiliasi dengan Python untuk 30 pasien × 24 kolom = **720 sel**. Kolom **Tujuan uji** merupakan anotasi, bukan kolom hasil aplikasi. Daftar 22 kolom yang diperiksa sheet Cek diturunkan dari rumus MATCH pada berkas sumber. Berat Badan (kg) memang dikecualikan dari rumus Cek; bobot tetap diperiksa dalam rekonsiliasi 720 sel sumber.

Sheet Hasil Web pada salinan pembanding masih kosong. Pengujian aplikasi menerapkan aturan pencocokan kode pasien, judul kolom, dan teks terpangkas spasi pada Excel yang benar-benar dibangun oleh fungsi ekspor aplikasi. Ini bukan klaim bahwa Microsoft Excel telah membuka dan menghitung ulang rumus pada workbook yang ditempeli secara manual.

Oracle juga mengembalikan 113 pengujian bawaan notebook, statistik dan interpretasi Python, 30 profil input asli, serta 1.242 profil tambahan untuk batas usia, data ginjal, dan kombinasi kondisi klinis. Pengujian dosis dan interval aplikasi terhadap 1.272 profil ini tidak menyesuaikan nilai harapan dengan hasil aplikasi.

## Dua pemeriksaan dengan arti berbeda

### Integritas sumber dan regresi dosis

```powershell
python -m pip install -r tests/fixtures/neonatal/requirements.txt
npm run test:neonatal:v20:reference
```

Lima pengujian ini juga termasuk dalam `npm test` biasa. Pemeriksaan mencakup sidik sumber, seluruh 113 pengujian notebook, rekonsiliasi 720 sel pembanding, kode pasien diterima/ditolak, serta dosis dan interval pada 1.272 profil.

**Lulus pada pemeriksaan ini berarti acuan utuh dan dosis/interval yang diuji cocok. Lulus tidak berarti seluruh aplikasi sudah sesuai v20.**

### Penerimaan hasil batch aplikasi terhadap v20

```powershell
npm run test:neonatal:v20
```

Perintah ini menjalankan lima pemeriksaan sumber di atas serta pengujian penerimaan batch tersendiri dalam `tests/neonatal-v20-acceptance.test.ts`. Cakupannya:

- 24 judul kolom hasil pasien;
- 660 pemeriksaan dari aturan Cek asli (30 pasien × 22 kolom), dengan pencocokan berdasarkan kode pasien dan judul kolom, serta pemeriksaan himpunan pasien;
- n, p, statistik uji, dan median terhadap hasil Python per antibiotik;
- jumlah di atas/di bawah rentang dan median yang diekspor;
- jumlah pasangan dan nilai p McNemar, keseluruhan serta per antibiotik;
- seluruh judul bagian, jenis paragraf, dan teks interpretasi dari Python v20.

Pemeriksaan penerimaan ini sengaja **belum lulus** pada tahap pembekuan acuan: aplikasi masih mempunyai judul kolom, metode statistik, dan narasi versi sebelumnya. Kegagalan harus terlihat dan perintah harus mengembalikan status gagal. Tidak ada `skip`, `todo`, pembaruan nilai harapan dari aplikasi, atau penanda bahwa kegagalan dianggap lulus.

Konfigurasi `vitest.neonatal-v20.config.ts` membuat pemeriksaan ini dapat dijalankan terpisah selama pekerjaan v20 dikerjakan bertahap. CI yang menjalankan `npm test` otomatis memeriksa sumber baru dan regresi dosis; CI itu belum merupakan gerbang penerimaan v20 lengkap. Sebelum menyatakan hasil batch sesuai v20, `npm run test:neonatal:v20` harus lulus.

`PYTHON` dapat menunjuk interpreter yang sudah memiliki dependensi acuan. Interpreter harus memakai SciPy 1.17.1 karena pemilihan metode Wilcoxon dipengaruhi versi SciPy. Oracle mencatat versi NumPy, pandas, SciPy, dan openpyxl yang benar-benar dipakai. Saat pemeriksaan lokal awal, versinya adalah NumPy 2.5.4, pandas 3.0.1, SciPy 1.17.1, openpyxl 3.1.5; instalasi bersih memakai daftar dependensi proyek yang dipatok di `requirements.txt`.

## Fungsi acuan lama

Notebook v18 dan fragmen interpretasi v19 tetap utuh. Pengujian lama tetap berjalan pada tahap ini untuk memastikan penambahan acuan tidak mengubah hasil aplikasi. Saat statistik/narasi dimigrasikan pada pekerjaan berikutnya, pengujian yang sengaja mematok perilaku lama perlu ditinjau sesuai perubahan v20; hasil statistik atau kalimat lama tidak boleh dipaksakan sebagai syarat penerimaan versi baru. Pengujian klinis yang tidak berubah tetap dipertahankan.

## Batas tahap ini

Hasil verifikasi lokal 3 November 2026: **287/287** pengujian regresi biasa lulus; pemeriksaan tipe dan lint pada sumber yang berubah lulus. Perintah penerimaan v20 menghasilkan **5 pengujian sumber lulus dan 6 pengujian batch gagal** karena perbedaan yang tercantum di atas. Empat salinan sumber identik dengan aslinya; perubahan satu byte pada masing-masing salinan sementara ditolak oleh pemeriksaan integritas.

Tidak ada perubahan pada mesin dosis, validasi aplikasi, statistik aplikasi, teks pengguna, versi aturan yang tampil, atau publikasi. Pemeriksaan penerimaan batch belum mencakup seluruh skenario isian tambahan, katalog peringatan, tampilan browser, 12 skenario review, PDF, atau cetak. Pemeriksaan tersebut tetap menjadi pekerjaan verifikasi berikutnya. Kesamaan perangkat lunak dengan acuan bukan validasi klinis independen.
