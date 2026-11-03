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
  it("excludes licensed guideline names except the exact v20 abbreviation definition", () => {
    const calculatorRoot = path.resolve("src/lib/neonatal-calculator");
    const uiRoot = path.resolve("src/components/neonatal-calculator");
    const files = [...sourceFiles(calculatorRoot), ...(fs.existsSync(uiRoot) ? sourceFiles(uiRoot) : [])];
    const source = files.map((file) => {
      const text = fs.readFileSync(file, "utf8");
      if (path.basename(file) !== "glossary-v20.ts") return text;
      // v20 defines this abbreviation without using the excluded dosing source.
      // Permit only this exact catalogue entry; every other occurrence in this
      // file and all other production files is still checked below.
      const definition = '["ASHP", "American Society of Health-System Pharmacists", ""],';
      expect(text.split(definition)).toHaveLength(2);
      return text.replace(definition, "");
    }).join("\n");
    expect(source.toLowerCase()).not.toContain("drugs.com");
    expect(source.toLowerCase()).not.toContain("ashp");
  });

  it("does not include an excluded guideline result field", () => {
    const result = JSON.stringify(calculateRecommendations(patient())).toLowerCase();
    expect(result).not.toContain("drugscom");
    expect(result).not.toContain("ashp");
  });
});
