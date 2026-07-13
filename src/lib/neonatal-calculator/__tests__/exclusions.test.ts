import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { calculateRecommendations } from "../recommendation-engine";
import { patient } from "./fixtures";

// Rule ID: EXCL-LIC-001.
function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") return [];
      return sourceFiles(fullPath);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

describe("production exclusions", () => {
  it("contains no excluded licensed guideline names in production calculator source", () => {
    const calculatorRoot = path.resolve("src/lib/neonatal-calculator");
    const uiRoot = path.resolve("src/components/neonatal-calculator");
    const files = [...sourceFiles(calculatorRoot), ...(fs.existsSync(uiRoot) ? sourceFiles(uiRoot) : [])];
    const source = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
    expect(source.toLowerCase()).not.toContain("drugs.com");
    expect(source.toLowerCase()).not.toContain("ashp");
  });

  it("does not include an excluded guideline result field", () => {
    expect(JSON.stringify(calculateRecommendations(patient())).toLowerCase()).not.toContain("drugscom");
  });
});
