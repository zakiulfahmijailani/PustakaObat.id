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
export const MONOGRAPH_TO_FDA_SECTION_TYPES: Record<string, string[]> = {
  indication: ['indications_and_usage'],
  dosage: ['dosage_and_administration', 'dosage_and_administration_table'],
  warnings: ['boxed_warning', 'warnings', 'warnings_and_cautions', 'precautions'],
  side_effects: ['adverse_reactions', 'adverse_reactions_table'],
  drug_interactions: ['drug_interactions'],
  specific_populations: ['use_in_specific_populations', 'pediatric_use', 'geriatric_use', 'nursing_mothers', 'labor_and_delivery'],
  pregnancy: ['pregnancy', 'pregnancy_or_breast_feeding', 'teratogenic_effects'],
  clinical_pharmacology: ['clinical_pharmacology', 'clinical_pharmacology_table'],
  mechanism: ['mechanism_of_action'],
  pharmacokinetics: ['pharmacokinetics', 'pharmacokinetics_table'],
  storage: ['storage_and_handling'],
  how_supplied: ['how_supplied', 'dosage_forms_and_strengths'],
  contraindication: ['contraindications'],
}

export function fdaSectionTypesForMonographSection(sectionType: string) {
  return MONOGRAPH_TO_FDA_SECTION_TYPES[sectionType] || []
}
