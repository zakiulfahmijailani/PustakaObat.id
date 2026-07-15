# PRD — apoteq
**Product Requirements Document**  
Versi: v1  
Status: Draft  
Project: apoteq  
Owner: Zakiul Fahmi Jailani  
Date: March 2026

---

## 1. Product Overview

**apoteq** adalah platform web informasi obat yang terverifikasi untuk masyarakat Indonesia, dengan workflow editorial yang melibatkan apoteker, verifikator, dan admin.

Platform ini dikembangkan untuk menjawab kebutuhan akan informasi obat yang:
- mudah dipahami masyarakat
- dapat dipercaya
- diperiksa oleh tenaga farmasi
- terus dapat diperbarui
- tidak sekadar menjadi website statis

Selain berfungsi sebagai portal informasi publik, apoteq juga menjadi sistem kerja internal untuk:
- menyusun monografi obat
- mereview konten
- mempublikasikan informasi yang sudah diverifikasi
- menerima pertanyaan dari masyarakat

---

## 2. Background

Website awal berasal dari Google Sites “Informasi Obat — Fakultas Farmasi Universitas Andalas”. Platform awal berguna sebagai proof-of-concept, namun memiliki keterbatasan besar:
- struktur konten statis
- tidak ada login / role system
- tidak ada workflow editorial
- tidak ada sistem verifikasi berlapis
- tidak ada dashboard pengelolaan
- tidak scalable untuk penggunaan real

Dalam pengembangan berikutnya, platform harus berevolusi menjadi sistem yang benar-benar dapat digunakan oleh:
- masyarakat umum
- petugas farmasi
- apoteker
- verifikator/editorial
- admin sistem

---

## 3. Problem Statement

Masyarakat Indonesia sering mencari informasi obat dari sumber yang:
- tidak jelas kredibilitasnya
- terlalu teknis
- tidak terstruktur
- tidak terverifikasi oleh tenaga profesional

Di sisi lain, institusi farmasi atau tenaga apoteker membutuhkan media digital yang:
- mudah digunakan untuk menyusun informasi obat
- memungkinkan proses review dan publikasi
- menjaga kualitas dan akurasi informasi
- bisa berkembang menjadi sistem yang berkelanjutan

Masalah inti yang ingin diselesaikan apoteq adalah:

> Bagaimana membangun platform informasi obat yang terverifikasi, mudah diakses publik, dan dapat dikelola melalui workflow profesional oleh tenaga farmasi?

---

## 4. Product Vision

Menjadi platform informasi obat digital yang terpercaya, modern, dan mudah digunakan, dengan model kerja kolaboratif antara tenaga farmasi dan sistem editorial berbasis verifikasi.

---

## 5. Product Goals

### 5.1 Business / Strategic Goals
- Mengubah website informasi obat statis menjadi platform digital yang fungsional
- Menjadi fondasi produk kesehatan/farmasi yang bisa dikembangkan lebih jauh
- Membangun sistem yang credible untuk kebutuhan institusi atau publik
- Menyediakan basis arsitektur modern menggunakan Vercel + Supabase

### 5.2 User Goals
- Masyarakat dapat mencari dan membaca informasi obat yang jelas
- Apoteker dapat menyusun dan mengelola draft informasi obat
- Verifikator dapat mereview dan menyetujui konten
- Admin dapat mengatur user, akses, dan aktivitas sistem

### 5.3 Product Goals
- Menyediakan public drug search experience yang baik
- Menyediakan login/register multi-role
- Menyediakan workflow draft → review → publish
- Menyediakan fitur Tanya Farmasis
- Menyediakan sistem yang aman, scalable, dan maintainable

---

## 6. Target Users

## 6.1 Public / Masyarakat
Karakteristik:
- tidak wajib punya akun
- ingin tahu kegunaan, dosis, efek samping, dan peringatan obat
- butuh bahasa yang sederhana
- butuh sumber yang terpercaya

Pain points:
- hasil pencarian di internet terlalu acak
- informasi sering tidak jelas atau terlalu teknis
- sulit tahu mana yang benar-benar terverifikasi

## 6.2 Pharmacist / Apoteker
Karakteristik:
- profesional farmasi
- menyusun atau memperbarui konten obat
- menjawab pertanyaan masyarakat
- memerlukan dashboard kerja yang efisien

Pain points:
- tidak ada sistem terpusat untuk kontribusi konten
- workflow review tidak jelas
- sulit melacak draft dan hasil publish

## 6.3 Verifier
Karakteristik:
- reviewer/editorial
- bertanggung jawab menjaga mutu dan akurasi konten

Pain points:
- tidak ada queue verifikasi yang jelas
- sulit melihat perubahan draft
- sulit melacak siapa submit apa

## 6.4 Admin
Karakteristik:
- pengelola sistem
- mengelola akun dan governance

Pain points:
- tidak ada central control
- sulit memonitor aktivitas pengguna
- sulit menjaga kualitas sistem secara operasional

---

## 7. Role Definitions

| Role | Login | Tujuan utama |
|------|------|--------------|
| Public | Tidak wajib | Mencari dan membaca informasi obat |
| Pharmacist | Ya | Menyusun draft obat dan menjawab pertanyaan |
| Verifier | Ya | Mereview dan mempublikasikan konten |
| Admin | Ya | Mengelola user, akses, dan sistem |

---

## 8. Scope Summary

## 8.1 In Scope for MVP
- public homepage
- public drug search page
- public drug detail page
- login/register
- approval status user
- pharmacist dashboard
- verifier dashboard
- admin basic dashboard
- create/edit drug draft
- submit for review
- approve/reject content
- Tanya Farmasis
- audit logs dasar
- deployment via Vercel
- Supabase backend + Auth + Postgres + RLS

## 8.2 Out of Scope for MVP
- teleconsultation/video call
- chat real-time
- payment
- prescription upload OCR
- online pharmacy checkout
- AI chatbot untuk user akhir
- mobile app native
- advanced analytics

---

## 9. Core User Flows

## 9.1 Public user mencari obat
1. User membuka homepage
2. User memasukkan nama obat di search
3. User melihat hasil obat yang sudah published
4. User membuka detail obat
5. User membaca informasi obat dan disclaimer

## 9.2 Apoteker Reviewer registrasi
1. Apoteker membuka halaman register
2. Login dengan akun Google yang emailnya terverifikasi
3. Melengkapi nama, identitas profesi/STRA, SIPA, dan institusi
4. Sistem membuat profil reviewer dengan status pending approval
5. Admin menyetujui akun
6. Reviewer login dengan Google dan masuk dashboard

## 9.3 Pharmacist membuat draft obat
1. Pharmacist login
2. Membuka dashboard
3. Klik “Buat Draft Obat”
4. Mengisi metadata obat
5. Mengisi section monograph
6. Menyimpan draft
7. Submit untuk review

## 9.4 Verifier memproses review
1. Verifier login
2. Membuka queue verifikasi
3. Memilih draft
4. Membaca isi draft
5. Approve atau reject/request revision
6. Jika approve, status published

## 9.5 Public user bertanya ke farmasis
1. Public membuka halaman Tanya Farmasis
2. Menulis pertanyaan
3. Mengirim pertanyaan
4. Pharmacist melihat inbox pertanyaan
5. Pharmacist menjawab
6. Jawaban dapat dipublikasikan ke halaman publik

---

## 10. Feature Requirements

## 10.1 Public Website

### F1. Homepage
Harus memiliki:
- hero section
- search input obat
- deskripsi singkat platform
- trust signals / verified content explanation
- CTA ke halaman obat dan Tanya Farmasis

### F2. Public Drug Search
Harus memiliki:
- search by nama obat
- filter kategori
- hasil hanya konten published
- empty state
- loading state

### F3. Drug Detail
Harus menampilkan:
- nama obat
- kategori / kelas obat
- ringkasan
- indikasi
- dosis
- efek samping
- kontraindikasi
- interaksi
- peringatan
- info reviewer / verified by
- tanggal update
- disclaimer

### F4. Public Questions
Harus memiliki:
- form submit pertanyaan
- optional nama
- optional email
- optional relasi ke obat
- success state yang jelas

---

## 10.2 Authentication

### F5. Register
Registrasi publik hanya untuk role `reviewer`. Role `admin` harus
dipraotorisasi melalui proses bootstrap/internal.

Field minimal:
- full name
- email Google terverifikasi
- institution
- identitas profesi/STRA
- SIPA number (opsional sesuai kebijakan)

### F6. Login
Harus mendukung:
- Google OAuth melalui Auth.js
- redirect berdasarkan role
- error messaging
- pending approval handling

### F7. Approval Status
User yang belum active harus diarahkan ke halaman pending approval.

---

## 10.3 Pharmacist Features

### F8. Dashboard Overview
Harus menampilkan:
- jumlah draft
- jumlah published
- pertanyaan pending
- quick actions

### F9. Drug Draft Management
Pharmacist bisa:
- membuat draft baru
- edit draft milik sendiri
- melihat status draft
- submit untuk review

### F10. Answer Questions
Pharmacist bisa:
- melihat pertanyaan masuk
- menjawab pertanyaan
- mengatur publish/non-publish jawaban

---

## 10.4 Verifier Features

### F11. Verification Queue
Verifier bisa:
- melihat semua draft status review
- filter/sort queue
- membuka detail draft

### F12. Review Actions
Verifier bisa:
- approve
- reject
- request revision

### F13. Reviewer Notes
Verifier dapat menambahkan catatan review.

---

## 10.5 Admin Features

### F14. User Management
Admin bisa:
- melihat daftar user
- approve user
- suspend user
- filter berdasarkan role/status

### F15. System Oversight
Admin bisa:
- melihat semua konten
- melihat semua pertanyaan
- melihat audit log

---

## 11. Content Model

Konten inti platform berbentuk **drug monograph**.

Setiap obat minimal memiliki:
- nama
- slug
- kategori
- drug class
- status
- sections

Section obat minimal:
- indication
- dosage
- side effects
- contraindication
- interactions
- warnings
- references

Model section-based dipilih karena:
- fleksibel
- mudah dikembangkan
- mudah di-version
- cocok untuk workflow editorial

---

## 12. Functional Requirements

## 12.1 Public Access
- public hanya dapat melihat konten status published
- public tidak dapat melihat draft/review content

## 12.2 Authenticated Access
- pharmacist hanya dapat edit draft sendiri
- verifier dapat review semua draft
- admin dapat mengakses semua data yang relevan

## 12.3 Security
- semua tabel menggunakan RLS
- role dicek di server dan database
- service role key tidak boleh terekspos ke client

## 12.4 Validation
- semua input divalidasi dengan Zod
- client validation + server validation

---

## 13. Non-Functional Requirements

### Performance
- public pages cepat diakses
- drug detail SSR-friendly
- pencarian terasa ringan
- deployment optimal di Vercel

### Security
- RLS aktif
- auth aman
- data sensitif tidak bocor
- role checks berlapis

### Maintainability
- code modular
- structure predictable
- AI-friendly codebase
- migration-based DB management

### Accessibility
- semantic HTML
- keyboard accessible
- proper focus states
- contrast AA
- mobile-first usability

---

## 14. UX Requirements

- UI harus terasa trusted dan professional
- warna mendekati tone website asli (warm off-white + teal)
- tidak boleh terlalu “startup SaaS neon”
- public pages harus text-first dan search-first
- dashboard harus ringkas dan jelas
- trust signals harus terlihat jelas
- bahasa UI utama: Bahasa Indonesia

---

## 15. Success Metrics

## 15.1 Product Success
- public dapat mencari obat dan membaca detail tanpa hambatan
- pharmacist dapat membuat draft tanpa friction besar
- verifier dapat menyelesaikan review flow end-to-end
- admin dapat approve akun dan melihat aktivitas

## 15.2 MVP Success Indicators
- minimal 1 alur lengkap dari draft → publish berjalan
- minimal 1 alur Tanya Farmasis berjalan
- auth multi-role berjalan
- deployment production berjalan stabil

## 15.3 Future Metrics
- jumlah published drug entries
- waktu rata-rata review draft
- jumlah pertanyaan yang dijawab
- engagement public search
- repeat usage

---

## 16. Risks

### R1. Complex role management
Mitigasi:
- gunakan profiles + RLS sejak awal
- hindari role logic di client saja

### R2. Overbuilding terlalu cepat
Mitigasi:
- fokus pada MVP
- tahan fitur chat/payment/AI dulu

### R3. Public content quality inconsistency
Mitigasi:
- workflow reviewer wajib
- audit logs
- publish hanya lewat verifier/admin approval

### R4. UI jadi terlalu generic
Mitigasi:
- ikuti UX-GUIDELINES
- gunakan tone warna yang sesuai
- utamakan readability dan trust

---

## 17. Assumptions

- user pharmacist dan verifier bersedia login
- admin akan mengelola approval user
- public users tidak wajib membuat akun untuk MVP
- konten obat akan dikelola manual oleh tenaga farmasi, bukan auto-generated
- Vercel + Supabase cukup untuk MVP dan early growth

---

## 18. Release Plan

## Phase 1 — Foundation
- setup Next.js
- setup Supabase
- auth
- schema
- public shell

## Phase 2 — Public Product
- drug listing
- drug detail
- homepage
- Tanya Farmasis form

## Phase 3 — Internal Workflow
- pharmacist dashboard
- create/edit draft
- verifier queue
- approve/reject

## Phase 4 — Governance
- admin panel
- user approvals
- audit logs

---

## 19. MVP Definition

MVP dianggap selesai jika:

- public bisa mencari dan membaca obat published
- pharmacist bisa register/login
- admin bisa approve akun pharmacist/verifier
- pharmacist bisa membuat dan submit draft
- verifier bisa approve draft jadi published
- public bisa mengirim pertanyaan
- pharmacist bisa menjawab pertanyaan
- semua berjalan di Vercel + Supabase

---

## 20. Technical Stack Decision

### Frontend
- Next.js 15
- TypeScript
- Tailwind CSS
- Lucide React

### Backend
- Supabase Auth
- Supabase Postgres
- Supabase Storage

### Deployment
- Vercel

Dipilih karena:
- cepat untuk MVP
- scalable
- DX bagus
- cocok untuk App Router modern
- mudah dipahami oleh AI-assisted development workflow

---

## 21. Open Questions

Hal-hal ini perlu diputuskan saat implementasi:
- apakah email wajib untuk public question submission?
- apakah SIPA wajib saat register pharmacist atau bisa diisi belakangan?
- apakah verifier boleh juga membuat draft?
- apakah jawaban Tanya Farmasis harus selalu di-review sebelum publish?
- apakah references section akan support markdown saja atau rich text editor?

---

## 22. Final Product Statement

apoteq adalah platform informasi obat yang menggabungkan:
- akses publik yang mudah
- kepercayaan melalui verifikasi
- workflow profesional untuk tenaga farmasi
- arsitektur modern yang siap dikembangkan

Fokus utama v1 bukan menjadi super app kesehatan, tetapi menjadi:
**platform informasi obat yang benar-benar usable, credible, dan operasional.**
