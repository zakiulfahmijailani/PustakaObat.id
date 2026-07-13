import { describe, expect, it } from "vitest";
import { determineVancomycinRenalStatus, hasAminoglycosideRenalSafetySignal } from "../renal";
import { patient } from "./fixtures";

// Rule IDs: CORE-RENAL-001, CORE-RENAL-002.
describe("UNC-derived vancomycin renal signal", () => {
  it("matches at SCr exactly 1.0", () => {
    expect(determineVancomycinRenalStatus(patient({ serumCreatinineMgDl: 1 }))).toBe("renal-impairment-criteria-met");
  });

  it("does not match at SCr 0.5 plus UOP exactly 1.0", () => {
    expect(
      determineVancomycinRenalStatus(patient({ serumCreatinineMgDl: 0.5, urineOutputMlKgHour: 1 })),
    ).toBe("no-renal-impairment-criteria-met");
  });

  it("matches at SCr 0.5 plus UOP just below 1.0", () => {
    expect(
      determineVancomycinRenalStatus(patient({ serumCreatinineMgDl: 0.5, urineOutputMlKgHour: 0.999 })),
    ).toBe("renal-impairment-criteria-met");
  });

  it("does not match normal values and never assumes normal when unavailable", () => {
    expect(determineVancomycinRenalStatus(patient())).toBe("no-renal-impairment-criteria-met");
    expect(
      determineVancomycinRenalStatus(
        patient({ renalDataAvailable: false, serumCreatinineMgDl: undefined, urineOutputMlKgHour: undefined }),
      ),
    ).toBe("data-unavailable");
  });

  it("does not claim the combined criterion is met when UOP is unavailable", () => {
    expect(
      determineVancomycinRenalStatus(
        patient({ serumCreatinineMgDl: 0.5, urineOutputMlKgHour: undefined }),
      ),
    ).toBe("no-renal-impairment-criteria-met");
  });

  it("exposes only a review signal for aminoglycosides", () => {
    expect(hasAminoglycosideRenalSafetySignal(patient({ serumCreatinineMgDl: 1 }))).toBe(true);
  });
});
