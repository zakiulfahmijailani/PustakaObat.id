// Browser acceptance for v20 patient-result presentation. Uses synthetic data only.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const directory = process.env.NEONATAL_SCREEN_EVIDENCE_DIR;
if (!directory) throw new Error("NEONATAL_SCREEN_EVIDENCE_DIR must be set");
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.NEONATAL_CHROME_PATH ? { executablePath: process.env.NEONATAL_CHROME_PATH } : {}),
  args: ["--no-sandbox"],
});
const check = (condition, description) => { if (!condition) throw new Error(description); };
const origin = "http://127.0.0.1:3000";
const antibiotics = ["gentamisin", "amikasin", "vankomisin"];
try {
  for (const antibiotic of antibiotics) {
    for (const mode of ["recommendation", "evaluation"]) {
      const prefix = mode === "recommendation" ? "rec" : "eval";
      const key = antibiotic + "-" + mode;
      const page = await browser.newPage({ viewport: { width: 1365, height: 920 }, deviceScaleFactor: 1 });
      try {
        await page.goto(origin + "/kalkulator?mode=" + mode, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.locator("#" + prefix + "-antibiotic").waitFor({ state: "visible", timeout: 30000 });
        await page.locator("#" + prefix + "-antibiotic").selectOption(antibiotic);
        await page.locator("#" + prefix + "-ga").fill("32");
        await page.locator("#" + prefix + "-pna").fill("5");
        await page.locator("#" + prefix + "-weight").fill("1.5");
        if (mode === "evaluation") {
          await page.getByRole("checkbox", { name: /Data fungsi ginjal tersedia/ }).check();
          await page.locator("#eval-scr").fill("0.6");
          await page.locator("#eval-uop").fill("0.8");
          await page.locator("#eval-actual-dose").fill("9");
          await page.locator("#eval-actual-hours").fill("24");
          await page.locator('#evaluation-panel button').filter({ hasText: "Evaluasi Pemberian" }).last().click();
        } else {
          await page.getByRole("button", { name: "Hitung rekomendasi" }).click();
        }
        const panel = page.locator("#" + (mode === "recommendation" ? "recommendation-panel" : "evaluation-panel"));
        const renal = panel.locator('section[aria-label="Ringkasan fungsi ginjal"]');
        await renal.waitFor({ state: "visible", timeout: 30000 });
        const text = await renal.innerText();
        if (mode === "recommendation") {
          check(text.includes("Tidak diisi (diasumsikan normal sesuai usia)"), key + ": renal-data assumption absent");
        } else {
          check(text.includes("SCr 0,6 mg/dL") && text.includes("0,8 mL/kg/jam"), key + ": measured renal values absent");
          check(text.includes("memenuhi kriteria gangguan ginjal UNC"), key + ": renal assessment absent");
          const actual = panel.locator('section[aria-label="Ringkasan dosis aktual"]');
          await actual.waitFor({ state: "visible", timeout: 30000 });
          check((await actual.innerText()).includes("9 mg (6 mg/kg per pemberian)"), key + ": actual dose not shown in mg and mg/kg");
          const statuses = await panel.locator("article dd").allInnerTexts();
          check(statuses.length >= 4, key + ": evaluation category cards missing");
          const repeats = statuses.filter(value => /^(Sesuai|Berlebih|Kurang)\s*[—-]\s*\1(?:\b|\s|\()/i.test(value.trim()));
          check(repeats.length === 0, key + ": repeated evaluation classification " + JSON.stringify(repeats));
          check(statuses.some(value => /^(Sesuai|Berlebih|Kurang)\b/i.test(value.trim())),
            key + ": no visible evaluation classification");
        }
        await page.screenshot({ path: join(directory, key + "-desktop.png"), fullPage: true });
        await page.emulateMedia({ media: "print" });
        await page.pdf({ path: join(directory, key + "-print.pdf"), format: "A4", printBackground: true, preferCSSPageSize: true });
        if (mode === "evaluation") {
          await page.emulateMedia({ media: "screen" });
          await page.setViewportSize({ width: 390, height: 844 });
          await renal.scrollIntoViewIfNeeded();
          const bounds = await renal.boundingBox();
          check(bounds && bounds.x >= -1 && bounds.x + bounds.width <= 391, key + ": renal summary clipped on mobile");
          await page.screenshot({ path: join(directory, key + "-mobile.png"), fullPage: true });
        }
        console.log("PASS v20 renal and mg/kg screen " + key);
      } finally { await page.close(); }
    }
  }
} finally { await browser.close(); }
