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
        const warningBox = section.locator('[aria-label="Peringatan klinis"]');
        await warningBox.waitFor({ state: "visible", timeout: 30000 });
        const warningCards = warningBox.locator(":scope > div");
        check(await warningCards.count() >= 1, fileBase + ": clinical warning missing");
        const warningText = await warningBox.innerText();
        check(warningText.includes("Hasil dihitung dengan ASUMSI fungsi ginjal normal sesuai usia"), fileBase + ": notebook v20 renal message absent");
        check(!warningText.includes("Data produksi urin tidak tersedia. Kriteria kombinasi SCr/UOP"), fileBase + ": legacy warning visible");
        const palette = await warningCards.first().evaluate(el => getComputedStyle(el).backgroundColor);
        check(palette === (antibiotic === "vankomisin" ? "rgb(248, 215, 218)" : "rgb(255, 243, 205)"), fileBase + ": wrong warning background " + palette);
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

  // Skenario ginjal nyata dari notebook v20: kreatinin 1,1 mg/dL,
  // produksi urin 1,8 mL/kg/jam pada usia pascalahir 2 hari.
  for (const antibiotic of antibiotics) {
    for (const mode of ["recommendation", "evaluation"]) {
      const key = "renal-" + antibiotic + "-" + mode;
      const prefix = mode === "recommendation" ? "rec" : "eval";
      const page = await browser.newPage({ viewport: { width: 1365, height: 950 }, deviceScaleFactor: 1 });
      try {
        await page.goto(origin + "/kalkulator?mode=" + mode, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.locator("#" + prefix + "-antibiotic").waitFor({state:"visible",timeout:30000});
        await page.locator("#" + prefix + "-antibiotic").selectOption(antibiotic);
        await page.locator("#" + prefix + "-ga").fill("26");
        await page.locator("#" + prefix + "-pna").fill("2");
        await page.locator("#" + prefix + "-weight").fill("0.9");
        await page.getByRole("checkbox", { name: "Data fungsi ginjal tersedia" }).check();
        await page.locator("#" + prefix + "-scr").fill("1.1");
        await page.locator("#" + prefix + "-uop").fill("1.8");
        if (mode === "evaluation") {
          await page.locator("#eval-actual-dose").fill("8");
          await page.locator("#eval-actual-hours").fill("24");
          await page.locator('#evaluation-panel button').filter({hasText:"Evaluasi Pemberian"}).last().click();
        } else {
          await page.getByRole("button", { name:"Hitung rekomendasi" }).click();
        }
        const panel = page.locator("#" + (mode === "recommendation" ? "recommendation-panel" : "evaluation-panel"));
        const warnings = panel.locator('[aria-label="Peringatan klinis"]');
        await warnings.waitFor({state:"visible",timeout:30000});
        const warningText = await warnings.innerText();
        check(warningText.includes("Kemungkinan gangguan fungsi ginjal"), key + ": warning title absent");
        check(warningText.includes("UNC (2023)") && warningText.includes("keputusan tim peneliti"), key + ": UNC/research provenance absent");
        check(warningText.includes("ANMF, gangguan ginjal"), key + ": canonical ANMF warning absent");
        check(warningText.includes("Evans dkk., 2023"), key + ": neonatal creatinine caveat absent");
        const firstColor = await warnings.locator(":scope > div").first().evaluate(el => getComputedStyle(el).backgroundColor);
        check(firstColor === "rgb(248, 215, 218)", key + ": renal warning is not red: " + firstColor);
        const notes = await panel.locator("tr").filter({hasText:"Catatan klinis dan sumber"}).innerText();
        check(notes.includes("ANMF, gangguan ginjal"), key + ": ANMF renal note absent from recommendation table");
        if (antibiotic === "vankomisin") {
          check(notes.includes("UNC (2023): tahan dosis berikutnya"), key + ": UNC single-dose instruction absent");
        }
        await page.screenshot({path:join(out,key+"-screen.png"),fullPage:true});
        await page.emulateMedia({media:"print"});
        await page.pdf({path:join(out,key+"-print.pdf"),format:"A4",printBackground:true,preferCSSPageSize:true});
        console.log("PASS renal browser + print " + key);
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
