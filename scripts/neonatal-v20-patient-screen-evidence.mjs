// Browser acceptance for v20 patient-result presentation. Uses synthetic data only.
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
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
const normalize = value => value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
  .replaceAll("≥", ">=").replaceAll("≤", "<=").replaceAll("−","-")
  .replace(/[^\x20-\x7E]/g, ch => ch === "–" || ch === "—" ? "-" : " ")
  .replace(/\s+/g," ").trim();
const pdfTexts = raw => normalize([...raw.matchAll(/\((.*)\) Tj/g)]
  .map(match => match[1].replace(/\\([\\()])/g,"$1")).join(" "));
const cssColorToPdf = rgbString => {
  const rgb = rgbString.match(/\d+(?:\.\d+)?/g)?.slice(0,3).map(Number);
  check(rgb?.length === 3, "Cannot read browser computed RGB " + rgbString);
  return rgb.map(n => Number((n / 255).toFixed(4)).toString()).join(" ");
};
const antibiotics = ["gentamisin", "amikasin", "vankomisin"];
try {
  for (const antibiotic of antibiotics) {
    for (const mode of ["recommendation", "evaluation"]) {
      const prefix = mode === "recommendation" ? "rec" : "eval";
      const key = antibiotic + "-" + mode;
      const page = await browser.newPage({ viewport: { width: 1365, height: 920 }, deviceScaleFactor: 1, acceptDownloads: true });
      try {
        await page.goto(origin + "/kalkulator?mode=" + mode, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.locator("#" + prefix + "-antibiotic").waitFor({ state: "visible", timeout: 30000 });
        await page.locator("#" + prefix + "-antibiotic").selectOption(antibiotic);
        await page.locator("#" + prefix + "-ga").fill("32");
        await page.locator("#" + prefix + "-pna").fill("5");
        await page.locator("#" + prefix + "-weight").fill("1.5");
        if (mode === "recommendation") {
          const renalHelp = await page.locator("#recommendation-panel").getByText("Data ginjal tidak tersedia;").first().innerText();
          check(renalHelp.includes("ketetapan tim peneliti") && !/notebook/i.test(renalHelp),
            key + ": renal guidance still exposes notebook term");
          await page.locator("#rec-therapeuticHypothermia").check();
          await page.locator("#rec-coxInhibitorTherapy").check();
          const combined = await page.getByRole("status").filter({ hasText: "Dua kondisi dicentang bersamaan." }).innerText();
          check(!/kalkulator v20/i.test(combined),
            key + ": combined therapy hint still exposes internal release version");
          await page.locator("#rec-coxInhibitorTherapy").uncheck();
          await page.locator("#rec-therapeuticHypothermia").uncheck();
        }
        if (mode === "evaluation") {
          check(await page.getByRole("button", { name: "Cetak Evaluasi Pemberian" }).count() === 0,
            key + ": evaluation print action must not appear before calculation");
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
        await recommendationTable.locator("thead th").first().waitFor({ state: "visible", timeout: 30000 });
        const displayedCopy = await panel.textContent();
        check(!/\bnotebook\b|\bkalkulator v20\b|\bmodifier\b|sumber dan batas aturan produksi/i.test(displayedCopy),
          key + ": user-facing screen still contains old internal terminology");
        if (mode === "recommendation") {
          check(displayedCopy.includes("Konteks klinis"),
            key + ": recommendation screen missing clinical context heading");
          check(displayedCopy.includes("Rekomendasi disusun berdasarkan sumber rujukan yang tercantum"),
            key + ": user-facing reference attribution not rendered");
        }
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
          const printButton = page.getByRole("button", { name: "Cetak Evaluasi Pemberian" });
          check(await printButton.count() === 1 && await printButton.isVisible(),
            key + ": missing evaluation print button next to PDF export");
          // Capture the actual click-triggered print request without opening a system dialog.
          await page.evaluate(() => {
            window.__v20PrintClicks = 0;
            window.print = () => { window.__v20PrintClicks += 1; };
          });
          await printButton.click();
          await page.waitForFunction(() => window.__v20PrintClicks === 1);
          check(await page.evaluate(() => window.__v20PrintClicks) === 1,
            key + ": print action must invoke window.print exactly once");
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
        // Download the real programmatic PDF (not Chromium print) and compare against live screen values.
        const beforePdf = await page.evaluate(() => ({
          at: Date.now(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }));
        const downloadPromise = page.waitForEvent("download");
        await page.getByRole("button", { name: mode === "recommendation" ? "Unduh PDF Rekomendasi Dosis" : "Unduh PDF Evaluasi Pemberian" }).click();
        const exported = await downloadPromise;
        const afterPdf = await page.evaluate(() => Date.now());
        const exportedPath = join(directory, key + "-export.pdf");
        await exported.saveAs(exportedPath);
        const rawPdf = readFileSync(exportedPath, "utf8");
        check(rawPdf.startsWith("%PDF-1.4"), key + ": downloaded report is not a PDF");
        const pdfPlain = pdfTexts(rawPdf);
        check(!/\bnotebook\b|\bkalkulator v20\b|\bmodifier\b|sumber dan batas aturan produksi/i.test(pdfPlain),
          key + ": exported PDF still contains old internal terminology");
        check(pdfPlain.includes("Konteks klinis:"),
          key + ": exported PDF missing clinical context");
        const extracted = normalize(execFileSync("pdftotext", ["-layout", exportedPath, "-"], { encoding: "utf8" }));
        const pageCount = (rawPdf.match(/\/Type \/Page\b/g) || []).length;
        const stampCount = (rawPdf.match(/\(Dibuat lokal:/g) || []).length;
        check(pageCount > 0 && pageCount === stampCount,
          key + ": full timestamp must repeat on each PDF page (" + stampCount + "/" + pageCount + ")");
        const stampFor = instant => "Dibuat lokal: " + new Intl.DateTimeFormat("id-ID", {
          weekday: "long", day: "numeric", month: "long", year: "numeric",
          hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
          timeZone: beforePdf.timeZone, timeZoneName: "short",
        }).format(new Date(instant)) + " (" + beforePdf.timeZone + ")";
        const expectedStamps = [];
        for (let second = Math.floor(beforePdf.at / 1000) - 1;
             second <= Math.floor(afterPdf / 1000) + 1; second++) {
          expectedStamps.push(normalize(stampFor(second * 1000)));
        }
        check(expectedStamps.some(stamp => pdfPlain.includes(stamp)),
          key + ": exported timestamp must match browser's local date, time and zone " + beforePdf.timeZone);
        check(extracted.includes("Dibuat lokal:") && extracted.includes("pukul"),
          key + ": PDF text extraction missing complete localized date/time");
        const doseCells = recommendationTable.locator("tbody tr").first().locator("td");
        for (let col = 0; col < 2; col++) {
          const cell = doseCells.nth(col);
          const total = normalize(await cell.locator("strong").first().innerText());
          const perKg = normalize(await cell.locator("div").first().innerText());
          const shape = normalize(await cell.locator('[data-reference-shape="dose"] strong').innerText());
          check(pdfPlain.includes(total), key + ": PDF dose does not match on-screen total for column " + col + ": " + total);
          check(pdfPlain.includes(perKg), key + ": PDF mg/kg does not match on-screen value for column " + col + ": " + perKg);
          check(pdfPlain.includes(shape), key + ": PDF missing on-screen dose reference shape " + shape);
          const intervalShape = normalize(await recommendationTable.locator("tbody tr").nth(1).locator("td").nth(col).locator('[data-reference-shape="interval"] strong').innerText());
          check(pdfPlain.includes(intervalShape), key + ": PDF missing interval reference shape " + intervalShape);
        }
        const renalText = normalize((await renal.innerText()).replace(/^Fungsi ginjal/, "").trim());
        check(pdfPlain.includes(renalText), key + ": PDF and screen renal summaries differ: " + renalText);
        check(extracted.includes("Pedoman Rumah Sakit") && extracted.includes("mg/kg"), key + ": exported PDF text extraction missing reference or mg/kg");
        check(pdfPlain.includes("Cara membaca rujukan:"), key + ": PDF lacks screen's reference interpretation");
        if (mode === "evaluation") {
          const actual = normalize((await panel.locator('[aria-label="Ringkasan dosis aktual"] dd').innerText()).split(", interval")[0].split(", diberikan")[0]);
          check(pdfPlain.includes(actual), key + ": PDF and screen actual mg/kg differ: " + actual);
          const categories = await panel.locator("[data-evaluation-category]").evaluateAll(elements => {
            const result = {};
            for (const element of elements) {
              const category = element.dataset.evaluationCategory;
              if (category && !result[category]) result[category] = getComputedStyle(element).color;
            }
            return result;
          });
          for (const [category, computed] of Object.entries(categories)) {
            const color = cssColorToPdf(computed);
            const match = new RegExp(color.replaceAll(".", "\\.") + " rg\\n[^\\n]+ Td\\n\\(" + category + "\\) Tj");
            check(match.test(rawPdf), key + ": PDF category color does not equal browser " + category + " " + computed);
          }
        }
        const screenNavigation = page.locator('nav[data-site-navigation="primary"]');
        check(await screenNavigation.count() === 1 && await screenNavigation.isVisible(),
          key + ": site navigation should remain visible during normal screen use");
        await page.screenshot({ path: join(directory, key + "-desktop.png"), fullPage: true });
        await page.emulateMedia({ media: "print" });
        const printChrome = await page.evaluate(() => {
          const state = selector => {
            const element = document.querySelector(selector);
            return element ? getComputedStyle(element).display : null;
          };
          return {
            navigation: state('nav[data-site-navigation="primary"]'),
            skipLink: state('a.skip-link[href="#main-content"]'),
            siteFooter: state('footer:not(.print-always)'),
            tabList: state('[role="tablist"][aria-label="Mode kalkulator"]'),
          };
        });
        check(Object.values(printChrome).every(value => value === "none"),
          key + ": site navigation/accessibility chrome leaked into print layout: " + JSON.stringify(printChrome));
        const printPanels = await page.evaluate(() => {
          const ids = ["recommendation-panel", "evaluation-panel"];
          return Object.fromEntries(ids.map(id => {
            const element = document.getElementById(id);
            return [id, { hidden: element.hidden, display: getComputedStyle(element).display }];
          }));
        });
        const activeId = mode === "evaluation" ? "evaluation-panel" : "recommendation-panel";
        const inactiveId = mode === "evaluation" ? "recommendation-panel" : "evaluation-panel";
        check(printPanels[activeId].display !== "none" && printPanels[inactiveId].hidden && printPanels[inactiveId].display === "none",
          key + ": print must show only the active result panel: " + JSON.stringify(printPanels));
        const printedPath = join(directory, key + "-print.pdf");
        await page.pdf({ path: printedPath, format: "A4", printBackground: true, preferCSSPageSize: true });
        const printText = normalize(execFileSync("pdftotext", ["-layout", printedPath, "-"], { encoding: "utf8" }));
        for (const siteLabel of ["Lewati navigasi", "Beranda", "Cari Obat", "Tentang Kami", "Login", "Jelajahi"]) {
          check(!printText.includes(siteLabel),
            key + ": global navigation text found in printed PDF: " + siteLabel);
        }
        check(printText.includes("Pedoman Rumah Sakit") && printText.includes("Literatur Terkini"),
          key + ": printable patient report disappeared while hiding navigation");
        if (mode === "evaluation") {
          await page.emulateMedia({ media: "screen" });
          await page.setViewportSize({ width: 390, height: 844 });
          const menuButton = page.getByRole("button", { name: "Buka menu navigasi" });
          await menuButton.click();
          check(await page.getByRole("dialog", { name: "Menu navigasi" }).isVisible(),
            key + ": mobile site menu must work on screen before print");
          await page.emulateMedia({ media: "print" });
          const mobilePrint = await page.evaluate(() => ({
            nav: getComputedStyle(document.querySelector('nav[data-site-navigation="primary"]')).display,
            skip: getComputedStyle(document.querySelector(".skip-link")).display,
            bodyOverflow: getComputedStyle(document.body).overflow,
          }));
          check(mobilePrint.nav === "none" && mobilePrint.skip === "none" && mobilePrint.bodyOverflow === "visible",
            key + ": mobile navigation overlay or scroll lock leaks into print: " + JSON.stringify(mobilePrint));
          const mobilePrintPath = join(directory, key + "-mobile-print.pdf");
          await page.pdf({ path: mobilePrintPath, format: "A4", printBackground: true, preferCSSPageSize: true });
          const mobilePrintText = normalize(execFileSync("pdftotext", ["-layout", mobilePrintPath, "-"], { encoding: "utf8" }));
          check(!["Lewati navigasi", "Beranda", "Cari Obat", "Tentang Kami", "Login"].some(word => mobilePrintText.includes(word)),
            key + ": mobile menu text leaked into printed PDF");
          check(mobilePrintText.includes("Pedoman Rumah Sakit") && mobilePrintText.includes("Literatur Terkini"),
            key + ": mobile print lost evaluation report");
          await page.emulateMedia({ media: "screen" });
          await page.getByRole("button", { name: "Tutup menu navigasi" }).click();
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
