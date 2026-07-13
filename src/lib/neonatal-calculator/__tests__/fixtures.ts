import type { PatientInput } from "../types";

export const basePatient: PatientInput = {
  patientLabel: "Kasus A",
  antibiotic: "gentamisin",
  gestationalAgeWeeks: 32,
  postnatalAgeDays: 5,
  currentWeightKg: 1.5,
  renalDataAvailable: true,
  serumCreatinineMgDl: 0.4,
  urineOutputMlKgHour: 2,
  therapeuticHypothermia: false,
  coxInhibitorTherapy: false,
  severeSepsisOrHighRiskInfection: false,
};

export function patient(overrides: Partial<PatientInput> = {}): PatientInput {
  return { ...basePatient, ...overrides };
}
