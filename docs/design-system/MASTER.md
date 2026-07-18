# PustakaObat.id UX Design System

Dokumen ini adalah sumber keputusan visual dan interaksi lintas halaman. Halaman boleh menambah kebutuhan khusus, tetapi tidak boleh mengubah prinsip keselamatan, aksesibilitas, atau arti status.

## Arah produk

- Gaya: **Accessible & Ethical Healthcare** dengan karakter pharmacy green dan trust blue.
- Motion: 2/10. Gunakan hanya untuk feedback, perpindahan state, dan orientasi.
- Density: publik 5/10; kalkulator dan workspace 7/10.
- Bahasa: jelas, langsung, dan menjelaskan singkatan pada kemunculan pertama.
- Ikon: Lucide. Jangan gunakan emoji sebagai ikon antarmuka.

## Token inti

| Peran | Token | Nilai awal |
| --- | --- | --- |
| Primary | `--color-primary` | `#14532d` |
| Primary hover | `--color-primary-hover` | `#0f3d21` |
| Trust accent | `--color-accent` | `#0369a1` |
| Background | `--color-background` | `#faf9f5` |
| Surface | `--color-surface` | `#ffffff` |
| Text | `--color-text` | `#17211b` |
| Muted text | `--color-text-muted` | `#667169` |
| Success | `--color-success` | `#287344` |
| Warning | `--color-warning` | `#a76f24` |
| Error | `--color-error` | `#b4493f` |
| Information | `--color-info` | `#3f6f8f` |

## Aturan wajib

1. Teks isi minimal 16px. Metadata sekunder boleh 12px jika kontras memenuhi.
2. Target sentuh tombol dan kontrol minimal 44×44px.
3. Semua fungsi dapat dijalankan dengan keyboard dan memiliki focus ring yang terlihat.
4. Warna tidak boleh menjadi satu-satunya penanda status; sertakan teks dan/atau ikon.
5. Form memiliki label, helper text, error dekat field, dan feedback submit.
6. Proses di bawah 500ms cukup memakai state tombol. Proses lebih lama memakai skeleton atau progress bertahap.
7. Skeleton mempertahankan bentuk konten untuk mencegah layout shift.
8. Hormati `prefers-reduced-motion`.
9. Jangan menyembunyikan peringatan klinis dengan progressive disclosure.
10. Setiap hasil klinis menampilkan sumber, versi aturan, dan batas penggunaannya.

## Pola halaman

### Publik

- Navigasi ringan dan pencarian obat mudah dijangkau.
- Pintu masuk dibagi berdasarkan tujuan pengguna.
- Monografi terverifikasi dibedakan jelas dari profil sumber WHO.
- Istilah EML, AWaRe, ATC, dan status review dijelaskan dengan bahasa biasa.

### Kalkulator

- Alur: data kasus → rekomendasi → evaluasi aktual.
- Kesalahan memindahkan fokus ke field pertama yang bermasalah.
- Hasil baru diumumkan melalui live region dan dibawa ke viewport.
- Data pasien tidak disimpan; tampilkan batas privasi sebelum input.

### Batch

- Alur: pilih file → validasi → evaluasi → ringkasan → tindak lanjut.
- Default hasil memprioritaskan baris yang perlu tindakan.
- Selalu sediakan tabel sebagai sumber angka utama; grafik hanya ringkasan.
- Filter, pencarian kode, detail baris, dan ekspor harus tersedia.

### Workspace staf

- Navigasi aktif terlihat dan tidak bergantung pada warna saja.
- Dashboard padat tetapi tetap memiliki hierarki judul, angka, dan tindakan utama.
- Tindakan editorial penting membutuhkan status, histori, dan jalur pemulihan yang jelas.

## Checklist verifikasi

- 375px, 768px, 1024px, dan 1440px.
- Zoom browser 200% tanpa kehilangan fungsi.
- Keyboard: skip link, navigasi, dialog, tab, form, tabel.
- Kontras minimum WCAG AA.
- Loading, empty, error, success, disabled, dan retry state.
- Tidak ada horizontal overflow di luar tabel data yang memang dapat digulir.
