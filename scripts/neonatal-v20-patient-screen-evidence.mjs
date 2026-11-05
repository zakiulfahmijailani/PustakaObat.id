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
          await page.locator("#eval-actual-dose").fill("0");
          await page.locator('#evaluation-panel button').filter({ hasText: "Evaluasi Pemberian" }).last().click();
          const doseError = await page.locator("#eval-actual-dose-error").innerText();
          check(doseError === "Dosis aktual per pemberian (mg) harus lebih dari 0.", key + ": actual dose error uses wrong field label: " + doseError);
          await page.locator("#eval-actual-dose").fill("9");
          await page.locator('#evaluation-panel button').filter({ hasText: "Evaluasi Pemberian" }).last().click();
        } else {
          await page.locator("#rec-ga").fill("21");
          await page.getByRole("button", { name: "Hitung rekomendasi" }).click();
          const gaError = await page.locator("#rec-ga-error").innerText();
          check(gaError === "Usia gestasi saat lahir — minggu harus 22–43 minggu.", key + ": gestation error uses wrong field label: " + gaError);
          await page.locator("#rec-ga").fill("32");
          await page.locator("#rec-antibiotic").selectOption("");
          await page.getByRole("button", { name: "Hitung rekomendasi" }).click();
          const antibioticError = await page.locator("#rec-antibiotic-error").innerText();
          check(antibioticError === "Pilih antibiotik yang didukung: Gentamisin, Amikasin, atau Vankomisin.", key + ": antibiotic error missing: " + antibioticError);
          await page.locator("#rec-antibiotic").selectOption(antibiotic);
          await page.getByRole("button", { name: "Hitung rekomendasi" }).click();
        }
        const panel = page.locator("#" + (mode === "recommendation" ? "recommendation-panel" : "evaluation-panel"));
        const expectedReferenceTitles = ["Pedoman Rumah Sakit", "Literatur Terkini (ANMF 2024)"];
        const recommendationTable = mode === "evaluation"
          ? panel.locator('section[aria-labelledby="evaluation-recommendation-heading"] table')
          : panel.locator("table").first();
        const tableHeadings = await recommendationTable.locator("thead th").allInnerTexts();
        check(tableHeadings[1] === expectedReferenceTitles[0] && tableHeadings[2] === expectedReferenceTitles[1],
          key + ": recommendation table reference titles differ: " + JSON.stringify(tableHeadings));
        const shapeDoseNotes = await recommendationTable.locator('[data-reference-shape="dose"]').allInnerTexts();
        const shapeIntervalNotes = await recommendationTable.locator('[data-reference-shape="interval"]').allInnerTexts();
        check(shapeDoseNotes.length === 2 && shapeIntervalNotes.length === 2,
          key + ": expected one dose and interval shape explanation per reference");
        check(shapeDoseNotes.every(value => /Nilai dosis tunggal|Rentang dosis|Dosis numerik tidak tersedia/.test(value)),
          key + ": missing dose range/single explanation " + JSON.stringify(shapeDoseNotes));
        check(shapeIntervalNotes.every(value => /Nilai interval tunggal|Rentang interval kontinu|Rentang interval informatif|Opsi interval terpisah|Dosis tunggal/.test(value)),
          key + ": missing interval shape explanation " + JSON.stringify(shapeIntervalNotes));
        const tableContext = await recommendationTable.locator("xpath=..").innerText();
        check(tableContext.includes("Cara membaca rujukan:"), key + ": reference reading guidance missing");
        if (antibiotic === "gentamisin") {
          check(shapeDoseNotes[0].includes("Rentang dosis") && shapeDoseNotes[1].includes("Nilai dosis tunggal"),
            key + ": gentamicin expected reference dose shapes not shown");
        }
        if (antibiotic === "amikasin") {
          check(shapeDoseNotes[0].includes("Nilai dosis tunggal"), key + ": amikacin single dose value not explained");
        }
        if (antibiotic === "vankomisin" && mode === "evaluation") {
          check(shapeIntervalNotes[0].includes("Dosis tunggal (tanpa interval rutin)"),
            key + ": renal vancomycin must not be presented as routine interval");
        }
        if (mode === "evaluation") {
          const evaluationShapeNotes = await panel.locator("[data-evaluation-reference-shape]").allInnerTexts();
          check(evaluationShapeNotes.length === 2 && evaluationShapeNotes.every(value => value.includes("Bentuk rujukan:")),
            key + ": evaluation cards missing shape explanations");
          const evaluationCardHeadings = await panel.locator("article > h3").allInnerTexts();
          check(JSON.stringify(evaluationCardHeadings) === JSON.stringify(expectedReferenceTitles),
            key + ": evaluation card titles differ from the table: " + JSON.stringify(evaluationCardHeadings));
        }
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
          const categoryColors = await panel.locator("[data-evaluation-category]").evaluateAll(elements => {
            const semanticClasses = { Sesuai: "text-success", Berlebih: "text-error", Kurang: "text-warning" };
            const probe = document.createElement("strong");
            document.body.append(probe);
            const colors = {};
            for (const [category, className] of Object.entries(semanticClasses)) {
              probe.className = className;
              colors[category] = getComputedStyle(probe).color;
            }
            probe.remove();
            return elements.map(element => {
              const category = element.getAttribute("data-evaluation-category");
              return {
                category, location: element.closest("#actual-evaluation-summary") ? "summary" : "card",
                text: element.textContent?.trim(),
                expectedClass: semanticClasses[category],
                hasExpectedClass: element.classList.contains(semanticClasses[category]),
                expectedColor: colors[category],
                actualColor: getComputedStyle(element).color,
              };
            });
          });
          check(categoryColors.some(item => item.location === "summary"), key + ": missing colored summary categories");
          check(categoryColors.some(item => item.location === "card"), key + ": missing colored card categories");
          check(categoryColors.every(item => item.expectedClass && item.hasExpectedClass && item.expectedColor === item.actualColor && item.category === item.text),
            key + ": dose/frequency semantic category colors inconsistent " + JSON.stringify(categoryColors));
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
