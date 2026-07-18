export interface Profile {
  id: string
  full_name: string | null
  role: 'pharmacist' | 'verifier' | 'admin'
  sipa_number: string | null
  institution: string | null
  is_active: boolean
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface DrugCategory {
  id: string
  name: string
  slug: string
  description: string | null
  created_at: string
}

export interface Drug {
  id: string
  name: string
  brand_names: string[]
  slug: string
  category_id: string | null
  drug_class: string | null
  summary: string | null
  status: 'draft' | 'review' | 'published' | 'archived'
  submitted_by: string | null
  verified_by: string | null
  published_at: string | null
  created_at: string
  updated_at: string
  // For joined data in mock
  drug_categories?: { name: string; slug: string } | null
  verifier?: { full_name: string; institution: string } | null
  sections?: { id: string; section_type: string; content: string }[]
}

export const MOCK_CATEGORIES: DrugCategory[] = [
  { id: '1', name: 'Antibiotik', slug: 'antibiotik', description: 'Obat untuk mengatasi infeksi bakteri.', created_at: new Date().toISOString() },
  { id: '2', name: 'Analgesik', slug: 'analgesik', description: 'Obat pereda nyeri dan demam.', created_at: new Date().toISOString() },
  { id: '3', name: 'Antihistamin', slug: 'antihistamin', description: 'Obat untuk meredakan gejala alergi.', created_at: new Date().toISOString() },
  { id: '4', name: 'Antivirus', slug: 'antivirus', description: 'Obat untuk infeksi virus.', created_at: new Date().toISOString() },
  { id: '5', name: 'Suplemen', slug: 'suplemen', description: 'Vitamin dan mineral tambahan.', created_at: new Date().toISOString() },
]
export const MOCK_PROFILES: Profile[] = [
  { 
    id: 'user-1', 
    full_name: 'Budi Santoso, Apt.', 
    role: 'pharmacist', 
    sipa_number: '123/SIPA/2023', 
    institution: 'Apotek Sehat', 
    is_active: true, 
    avatar_url: null, 
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString() 
  },
  { 
    id: 'user-2', 
    full_name: 'Siti Aminah, Apt.', 
    role: 'verifier', 
    sipa_number: '456/SIPA/2023', 
    institution: 'RS Medika', 
    is_active: true, 
    avatar_url: null, 
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  { 
    id: 'user-3', 
    full_name: 'Admin Apoteq', 
    role: 'admin', 
    sipa_number: null, 
    institution: 'Apoteq Central', 
    is_active: true, 
    avatar_url: null, 
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  { 
    id: 'user-4', 
    full_name: 'Andi Pratama, Apt.', 
    role: 'pharmacist', 
    sipa_number: '789/SIPA/2024', 
    institution: 'Puskesmas Maju', 
    is_active: false, 
    avatar_url: null, 
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
]

export const MOCK_DRUGS: Drug[] = [
  {
    id: 'd1',
    name: 'Amoxicillin',
    brand_names: ['Amoxsan', 'Kalmoxillin', 'Opimox'],
    slug: 'amoxicillin',
    category_id: '1',
    drug_class: 'Penisilin',
    summary: 'Antibiotik spektrum luas yang digunakan untuk mengobati berbagai infeksi bakteri.',
    status: 'published',
    submitted_by: 'user-1',
    verified_by: 'user-2',
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    drug_categories: { name: 'Antibiotik', slug: 'antibiotik' },
    verifier: { full_name: 'Siti Aminah, Apt.', institution: 'RS Medika' },
    sections: [
      { id: 's1', section_type: 'indication', content: 'Digunakan untuk mengobati infeksi bakteri pada telinga, hidung, tenggorokan, saluran kemih, dan kulit.' },
      { id: 's2', section_type: 'dosage', content: 'Dewasa: 250-500 mg setiap 8 jam. Anak-anak: 20-40 mg/kgBB/hari dibagi dalam 3 dosis.' },
      { id: 's3', section_type: 'side_effects', content: 'Mual, muntah, diare, ruam kulit, dan reaksi alergi.' },
      { id: 's4', section_type: 'warnings', content: 'Hati-hati pada pasien dengan riwayat alergi penisilin. Selesaikan seluruh dosis meskipun gejala sudah membaik.' }
    ]
  },
  {
    id: 'd2',
    name: 'Paracetamol',
    brand_names: ['Panadol', 'Sanmol', 'Biogesic'],
    slug: 'paracetamol',
    category_id: '2',
    drug_class: 'Analgesik & Antipiretik',
    summary: 'Obat yang digunakan untuk meredakan nyeri ringan hingga sedang dan menurunkan demam.',
    status: 'published',
    submitted_by: 'user-1',
    verified_by: 'user-2',
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    drug_categories: { name: 'Analgesik', slug: 'analgesik' },
    verifier: { full_name: 'Siti Aminah, Apt.', institution: 'RS Medika' },
    sections: [
      { id: 's5', section_type: 'indication', content: 'Meredakan sakit kepala, sakit gigi, nyeri otot, dan menurunkan demam.' },
      { id: 's6', section_type: 'dosage', content: 'Dewasa: 500-1000 mg setiap 4-6 jam (maksimal 4g/hari).' },
      { id: 's7', section_type: 'warnings', content: 'Hindari penggunaan bersama alkohol karena risiko kerusakan hati.' }
    ]
  },
  {
    id: 'd3',
    name: 'Cetirizine',
    brand_names: ['Incidal', 'Ryzen', 'Ozen'],
    slug: 'cetirizine',
    category_id: '3',
    drug_class: 'Antihistamin Gen-2',
    summary: 'Obat untuk meredakan gejala alergi seperti pilek, bersin, dan gatal-gatal.',
    status: 'published',
    submitted_by: 'user-4',
    verified_by: 'user-2',
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    drug_categories: { name: 'Antihistamin', slug: 'antihistamin' },
    verifier: { full_name: 'Siti Aminah, Apt.', institution: 'RS Medika' },
    sections: [
      { id: 's8', section_type: 'indication', content: 'Rhinitis alergi musiman dan kronis, urtikaria idiopatik kronis.' },
      { id: 's9', section_type: 'dosage', content: 'Dewasa & Anak > 6 th: 10 mg sekali sehari atau 5 mg dua kali sehari.' }
    ]
  }
]
