import sectionMapping from './section-mapping.json'

export const MONOGRAPH_SECTION_LABELS: Record<string, string> = {
  indication: 'Indikasi',
  dosage: 'Dosis dan penggunaan',
  warnings: 'Peringatan',
  side_effects: 'Efek samping',
  drug_interactions: 'Interaksi obat',
  specific_populations: 'Populasi khusus',
  pregnancy: 'Kehamilan',
  clinical_pharmacology: 'Farmakologi klinis',
  mechanism: 'Mekanisme kerja',
  pharmacokinetics: 'Farmakokinetik',
  storage: 'Penyimpanan',
  how_supplied: 'Sediaan',
  contraindication: 'Kontraindikasi',
}

/** FDA label fields that may substantiate one Indonesian monograph section. */
export const MONOGRAPH_TO_FDA_SECTION_TYPES: Record<string, string[]> = sectionMapping

export function fdaSectionTypesForMonographSection(sectionType: string) {
  return MONOGRAPH_TO_FDA_SECTION_TYPES[sectionType] || []
}
