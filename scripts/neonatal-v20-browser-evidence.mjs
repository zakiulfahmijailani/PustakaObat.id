// Synthetic, local-only browser acceptance for the v20 Rujukan component.
// This is not a deployment or a clinical validation.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const out = process.env.NEONATAL_BROWSER_EVIDENCE_DIR;
if (!out) throw new Error("NEONATAL_BROWSER_EVIDENCE_DIR is required");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.NEONATAL_CHROME_PATH ? { executablePath: process.env.NEONATAL_CHROME_PATH } : {}),
  args: ["--no-sandbox"],
});
const antibiotics = ["gentamisin", "amikasin", "vankomisin"];
const labels = [
  "Pedoman Rumah Sakit:",
  "Literatur Terkini:",
  "Peringatan tambahan:",
  "Ketetapan tim peneliti (bukan dari pedoman):",
];
const check = (condition, description) => {
  if (!condition) throw new Error(description);
};
const origin = "http://127.0.0.1:3000";
try {
  for (const antibiotic of antibiotics) {
    for (const mode of ["recommendation", "evaluation"]) {
      const fileBase = antibiotic + "-" + mode;
      const page = await browser.newPage({ viewport: { width: 1365, height: 950 }, deviceScaleFactor: 1 });
      page.on("pageerror", error => console.error("PAGE ERROR " + fileBase + ":", error.message));
      try {
        await page.goto(origin + "/kalkulator?mode=" + mode, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.locator("#" + (mode === "recommendation" ? "rec" : "eval") + "-antibiotic").waitFor({ state: "visible", timeout: 30000 });
        await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => undefined);
        const prefix = mode === "recommendation" ? "rec" : "eval";
        await page.locator("#" + prefix + "-antibiotic").selectOption(antibiotic);
        await page.locator("#" + prefix + "-ga").fill("32");
        await page.locator("#" + prefix + "-pna").fill("5");
        await page.locator("#" + prefix + "-weight").fill("1.5");
        if (mode === "evaluation") {
          await page.locator("#eval-actual-dose").fill("8");
          await page.locator("#eval-actual-hours").fill("24");
          await page.locator('#evaluation-panel button').filter({ hasText: "Evaluasi Pemberian" }).last().click();
        } else {
          await page.getByRole("button", { name: "Hitung rekomendasi" }).click();
        }
        const section = page.locator("#" + (mode === "recommendation" ? "recommendation-panel" : "evaluation-panel"));
        const reference = section.locator('section[aria-label="Rujukan"]');
        await reference.waitFor({ state: "visible", timeout: 30000 });
        const content = await reference.innerText();
        for (const label of labels) check(content.includes(label), fileBase + ": missing " + label);
        check(content.includes("Evans RE") && content.includes("Papile LA"), fileBase + ": additional sources absent");
        check(content.includes("ANMF") || content.includes("Australasian Neonatal"), fileBase + ": ANMF absent");
        check(content.includes("kriteria kesesuaian"), fileBase + ": research attribution absent");
        check(!/\bSPO\b/.test(content), fileBase + ": outdated SPO present");
        if (antibiotic === "vankomisin") {
          check(content.includes("UNC Medical Center"), fileBase + ": UNC source missing");
          check(!content.includes("PNPK Tata Laksana"), fileBase + ": PNPK misattributed to vancomycin");
        } else {
          check(content.includes("Panduan Praktik Klinik (PPK)") && content.includes("PNPK Tata Laksana"), fileBase + ": PPK/PNPK source missing");
        }
        await reference.scrollIntoViewIfNeeded();
        await page.screenshot({ path: join(out, fileBase + "-screen.png"), fullPage: true });
        await page.emulateMedia({ media: "print" });
        await page.pdf({ path: join(out, fileBase + "-print.pdf"), format: "A4", printBackground: true, preferCSSPageSize: true });
        await page.emulateMedia({ media: "screen" });
        if (mode === "recommendation") {
          await page.setViewportSize({ width: 390, height: 844 });
          await reference.scrollIntoViewIfNeeded();
          const rect = await reference.boundingBox();
          check(rect && rect.x >= -1 && rect.x + rect.width <= 391, fileBase + ": reference box exceeds mobile viewport");
          await page.screenshot({ path: join(out, fileBase + "-mobile.png"), fullPage: true });
        }
        console.log("PASS browser + print " + fileBase + " (" + content.length + " chars)");
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
