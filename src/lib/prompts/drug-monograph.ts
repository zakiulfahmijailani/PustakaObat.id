export interface DrugData {
  id: string
  name: string
  generic_name?: string
  brand_names?: string[]
  drug_class?: string
  dosage_form?: string
  strength?: string
  manufacturer?: string
  registration_number?: string
  [key: string]: unknown
}

export function buildDrugMonographPrompt(drug: DrugData): string {
  const drugInfo = [
    `Nama Obat: ${drug.name}`,
    drug.generic_name ? `Nama Generik: ${drug.generic_name}` : null,
    drug.brand_names?.length ? `Nama Dagang: ${drug.brand_names.join(', ')}` : null,
    drug.drug_class ? `Kelas Obat: ${drug.drug_class}` : null,
    drug.dosage_form ? `Bentuk Sediaan: ${drug.dosage_form}` : null,
    drug.strength ? `Kekuatan/Dosis: ${drug.strength}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return `Kamu adalah asisten farmasi profesional. Tugasmu adalah membuat draft konten monograf obat dalam Bahasa Indonesia yang mudah dipahami oleh masyarakat umum (bukan tenaga medis).

Data obat:
${drugInfo}

Buatkan monograf obat lengkap dalam format JSON dengan key berikut:
- indication: Indikasi penggunaan obat (penyakit/kondisi yang diobati). Gunakan kalimat sederhana.
- dosage: Aturan pakai dan dosis umum. Sertakan dosis dewasa dan anak jika relevan.
- side_effects: Efek samping yang mungkin terjadi. Bedakan efek samping umum dan yang perlu segera ke dokter.
- contraindication: Kondisi/situasi di mana obat ini TIDAK boleh digunakan.
- warnings: Peringatan dan perhatian khusus (kehamilan, menyusui, penyakit tertentu, interaksi obat umum).
- mechanism_of_action: Cara kerja obat dalam tubuh. Gunakan bahasa yang mudah dimengerti.
- storage: Cara penyimpanan yang benar.
- pharmacokinetics: Farmakokinetik singkat (opsional, jika relevan untuk edukasi publik).

Panduan penulisan:
1. Gunakan Bahasa Indonesia yang jelas, sopan, dan mudah dipahami masyarakat awam.
2. Hindari jargon medis yang tidak perlu. Jika perlu istilah medis, sertakan penjelasannya.
3. Setiap seksi minimal 2-3 kalimat deskriptif.
4. Tambahkan catatan "Selalu konsultasikan dengan apoteker atau dokter" di seksi yang relevan.
5. Konten bersifat edukatif dan informatif, bukan pengganti konsultasi medis.
6. Pastikan informasi akurat berdasarkan literatur farmakologi standar.

PENTING: Kembalikan HANYA objek JSON yang valid, tanpa markdown, tanpa penjelasan tambahan di luar JSON.

Contoh format output:
{
  "indication": "...",
  "dosage": "...",
  "side_effects": "...",
  "contraindication": "...",
  "warnings": "...",
  "mechanism_of_action": "...",
  "storage": "...",
  "pharmacokinetics": "..."
}`
}
