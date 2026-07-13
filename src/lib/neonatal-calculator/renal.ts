import { RENAL_THRESHOLDS } from "./constants";
import type { PatientInput, RenalStatus } from "./types";

export function determineVancomycinRenalStatus(input: PatientInput): RenalStatus {
  if (!input.renalDataAvailable || input.serumCreatinineMgDl === undefined) {
    return "data-unavailable";
  }
  const highCreatinine =
    input.serumCreatinineMgDl >= RENAL_THRESHOLDS.serumCreatinineHighMgDl;
  const combinedSignal =
    input.serumCreatinineMgDl >=
      RENAL_THRESHOLDS.serumCreatinineWithLowUrineOutputMgDl &&
    input.urineOutputMlKgHour !== undefined &&
    input.urineOutputMlKgHour < RENAL_THRESHOLDS.lowUrineOutputMlKgHour;
  return highCreatinine || combinedSignal
    ? "renal-impairment-criteria-met"
    : "no-renal-impairment-criteria-met";
}

export function hasAminoglycosideRenalSafetySignal(input: PatientInput): boolean {
  return determineVancomycinRenalStatus(input) === "renal-impairment-criteria-met";
}
