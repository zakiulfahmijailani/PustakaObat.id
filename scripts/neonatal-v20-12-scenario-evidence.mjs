// [4.5] Headless evidence for the six COMPLEMENTARY cases. Together with
// neonatal-v20-patient-screen-evidence.mjs (six original cases), this proves
// twelve (3 antibiotics x 2 modes x 2 renal states) screen/export/print cases.
// Synthetic data only; tests the local production build, NOT a deployment.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.env.NEONATAL_12_EVIDENCE_DIR;
if (!dir) throw new Error("NEONATAL_12_EVIDENCE_DIR must be set");
mkdirSync(dir, { recursive: true });
const check = (truth, message) => { if (!truth) throw new Error(message); };
const normalize = text => text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .replaceAll("≥", ">=").replaceAll("≤", "<=").replaceAll("−", "-")
  .replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
const pdfText = path => normalize(execFileSync("pdftotext", ["-layout", path, "-"], { encoding: "utf8" }));
const pdfPages = path => {
  const out = execFileSync("pdfinfo", [path], { encoding: "utf8" });
  const match = out.match(/^Pages:\s+(\d+)/m);
  check(match && +match[1] > 0, path + ": unreadable or zero-page PDF");
  return Number(match[1]);
};
const antibiotics = ["gentamisin", "amikasin", "vankomisin"];
const cases = [];
const pageErrors = [];
const browser = await chromium.launch({
  headless: true,
  ...(process.env.NEONATAL_CHROME_PATH ? { executablePath: process.env.NEONATAL_CHROME_PATH } : {}),
  args: ["--no-sandbox"],
});
try {
  for (const antibiotic of antibiotics) {
    for (const mode of ["recommendation", "evaluation"]) {
      // The original 6 cover recommendation/renal-absent and evaluation/renal-measured.
      // Cover the inverse in the additional 6, retaining both clinical workflows.
      const measured = mode === "recommendation";
      const key = antibiotic + "-" + mode + "-complement";
      const prefix = mode === "recommendation" ? "rec" : "eval";
      const activeId = mode === "recommendation" ? "recommendation-panel" : "evaluation-panel";
      const inactiveId = mode === "recommendation" ? "evaluation-panel" : "recommendation-panel";
      const page = await browser.newPage({
        viewport: { width: 1365, height: 920 }, deviceScaleFactor: 1, acceptDownloads: true,
      });
      page.on("pageerror", err => pageErrors.push(key + ": " + err.message));
      let patientPosts = 0;
      page.on("request", request => {
        if (request.method() === "POST" && (request.postData() ?? "").includes("V20-TEST-")) patientPosts++;
      });
      try {
        await page.goto("http://127.0.0.1:3000/kalkulator?mode=" + mode,
          { waitUntil: "domcontentloaded", timeout: 60_000 });
        const panel = page.locator("#" + activeId);
        await page.locator("#" + prefix + "-antibiotic").waitFor({ state: "visible", timeout: 30_000 });
        await page.locator("#" + prefix + "-antibiotic").selectOption(antibiotic);
        await page.locator("#" + prefix + "-patient-label").fill("V20-TEST-" + key);
        await page.locator("#" + prefix + "-ga").fill("32");
        await page.locator("#" + prefix + "-pna").fill("5");
        await page.locator("#" + prefix + "-weight").fill("1.5");

        const renalCheckbox = panel.getByRole("checkbox", { name: "Data fungsi ginjal tersedia" });
        check(await renalCheckbox.isChecked() === false, key + ": renal toggle not initially empty");
        if (measured) {
          await renalCheckbox.check();
          await page.locator("#" + prefix + "-scr").fill("0.6");
          await page.locator("#" + prefix + "-uop").fill("0.8");
        } else {
          check(await page.locator("#" + prefix + "-scr").isDisabled(),
            key + ": serum creatinine must be disabled when data absent");
        }

        if (mode === "evaluation") {
          await page.locator("#eval-actual-dose").fill("9");
          await page.locator("#eval-actual-hours").fill("24");
          await panel.getByRole("button", { name: "Evaluasi Pemberian" }).last().click();
        } else {
          await panel.getByRole("button", { name: "Hitung rekomendasi" }).click();
        }
        const renal = panel.locator('section[aria-label="Ringkasan fungsi ginjal"]');
        await renal.waitFor({ state: "visible", timeout: 30_000 });
        const renalText = normalize(await renal.innerText());
        if (measured) {
          check(renalText.includes("SCr 0,6 mg/dL") && renalText.includes("0,8 mL/kg/jam")
            && renalText.includes("memenuhi kriteria gangguan ginjal UNC"),
            key + ": measured renal state not reflected in screen: " + renalText);
        } else {
          check(renalText.includes("Tidak diisi (diasumsikan normal sesuai usia)"),
            key + ": missing renal assumption on screen");
        }

        const reference = panel.locator('section[aria-label="Rujukan"]');
        await reference.waitFor({ state: "visible", timeout: 30_000 });
        const clinicalText = normalize(await panel.innerText());
        check((await page.locator("footer.print-always strong").innerText()) === "Versi aturan 2026.11.03.", key + ": screen footer does not show v20 rule version");
        check(clinicalText.includes("Pedoman Rumah Sakit")
          && clinicalText.includes("Literatur Terkini (ANMF 2024)")
          && clinicalText.includes("Cara membaca rujukan"),
          key + ": missing source or interpretation on screen");
        check(!/\bnotebook\b|\bkalkulator v20\b|\bmodifier\b/i.test(clinicalText),
          key + ": legacy internal text on screen");
        if (mode === "evaluation") {
          const actual = normalize(await panel.locator('section[aria-label="Ringkasan dosis aktual"]').innerText());
          check(actual.includes("9 mg") && actual.includes("6 mg/kg per pemberian"),
            key + ": actual mg and mg/kg absent from screen: " + actual);
          check(await panel.getByRole("button", { name: "Cetak Evaluasi Pemberian" }).isVisible(),
            key + ": evaluation print button is not available");
        }

        const screenName = key + "-screen.png";
        const exportName = key + "-export.pdf";
        const printName = key + "-print.pdf";
        await page.screenshot({ path: join(dir, screenName), fullPage: true });

        const downloadPromise = page.waitForEvent("download");
        await panel.getByRole("button", {
          name: mode === "recommendation" ? "Unduh PDF Rekomendasi Dosis" : "Unduh PDF Evaluasi Pemberian",
        }).click();
        const download = await downloadPromise;
        await download.saveAs(join(dir, exportName));
        check(readFileSync(join(dir, exportName), "utf8").startsWith("%PDF-1.4"),
          key + ": downloaded file is not a PDF");
        const exported = pdfText(join(dir, exportName));
        check(exported.includes("Versi aturan: 2026.11.03"), key + ": exported PDF version does not match v20");
        check(pdfPages(join(dir, exportName)) >= 1, key + ": blank exported report");
        check(exported.includes("Fungsi ginjal") && exported.includes("Dibuat lokal:")
          && exported.includes("Cara membaca rujukan")
          && exported.includes("Pedoman Rumah Sakit") && exported.includes("mg/kg"),
          key + ": PDF export lacks patient/report content");
        if (measured) {
          check(exported.includes("SCr 0,6 mg/dL") && exported.includes("0,8 mL/kg/jam"),
            key + ": exported renal numbers differ from screen");
        } else {
          check(exported.includes("Tidak diisi (diasumsikan normal sesuai usia)"),
            key + ": exported renal assumption differs from screen");
        }
        if (mode === "evaluation") {
          check(exported.includes("9 mg") && exported.includes("6 mg/kg"),
            key + ": actual mg/kg omitted in downloaded evaluation PDF");
        }
        check(!/\bnotebook\b|\bkalkulator v20\b|\bmodifier\b/i.test(exported),
          key + ": deprecated internal terminology present in exported PDF");

        // Check the actual print button (without spawning a native dialog).
        await page.evaluate(() => {
          window.__v20PrintClickCount = 0;
          window.print = () => { window.__v20PrintClickCount += 1; };
        });
        await panel.getByRole("button", {
          name: mode === "recommendation" ? "Cetak" : "Cetak Evaluasi Pemberian",
          exact: true,
        }).click();
        await page.waitForFunction(() => window.__v20PrintClickCount === 1);
        check(await page.evaluate(() => window.__v20PrintClickCount) === 1,
          key + ": click did not initiate exactly one print action");

        // beforeprint must expand all references and afterprint must restore state.
        const disclosure = await panel.evaluate(node => {
          const items = [...node.querySelectorAll("details[data-print-expand]")];
          const initial = items.map(item => item.open);
          window.dispatchEvent(new Event("beforeprint"));
          const during = items.map(item => item.open);
          window.dispatchEvent(new Event("afterprint"));
          const restored = items.map(item => item.open);
          return { count: items.length, initial, during, restored };
        });
        check(disclosure.count >= 1 && disclosure.initial.every(v => !v)
          && disclosure.during.every(Boolean) && disclosure.restored.every(v => !v),
          key + ": print disclosures not expanded/restored " + JSON.stringify(disclosure));

        await page.emulateMedia({ media: "print" });
        const chrome = await page.evaluate(({ activeId, inactiveId }) => {
          const display = selector => {
            const el = document.querySelector(selector);
            return el ? getComputedStyle(el).display : null;
          };
          return {
            nav: display('nav[data-site-navigation="primary"]'),
            skip: display('a.skip-link[href="#main-content"]'),
            tabs: display('[role="tablist"][aria-label="Mode kalkulator"]'),
            active: display("#" + activeId),
            inactive: display("#" + inactiveId),
          };
        }, { activeId, inactiveId });
        check(chrome.nav === "none" && chrome.skip === "none" && chrome.tabs === "none"
          && chrome.active !== "none" && chrome.inactive === "none",
          key + ": site chrome or inactive panel leaked into print " + JSON.stringify(chrome));
        await page.pdf({ path: join(dir, printName), format: "A4",
          printBackground: true, preferCSSPageSize: true });
        const printed = pdfText(join(dir, printName));
        check(printed.includes("Versi aturan 2026.11.03."), key + ": printed report version does not match v20");
        check(pdfPages(join(dir, printName)) >= 1, key + ": blank print PDF");
        check(printed.includes("Pedoman Rumah Sakit")
          && printed.includes("Literatur Terkini") && printed.includes("Cara membaca rujukan")
          && printed.includes("Australasian Neonatal Medicines Formulary"),
          key + ": printable report or expanded source missing");
        check(!["Lewati navigasi", "Beranda", "Cari Obat", "Tentang Kami", "Login", "Jelajahi"]
          .some(text => printed.includes(text)), key + ": global navigation visible in printed PDF");
        if (mode === "recommendation") {
          check(printed.includes("Catatan kualitatif saja; tidak digunakan sebagai nomogram dosis.")
            && printed.includes("Rekomendasi disusun berdasarkan sumber rujukan yang tercantum"),
            key + ": expanded reference notes absent from print");
        } else {
          check(printed.includes("Evaluasi Pemberian") && printed.includes("mg/kg"),
            key + ": evaluation data absent from print");
        }
        check((await panel.locator("details[data-print-expand]").evaluateAll(items =>
          items.map(el => el.open))).every(open => !open),
          key + ": printing did not restore disclosure state");

        await page.emulateMedia({ media: "screen" });
        await page.setViewportSize({ width: 390, height: 844 });
        await renal.scrollIntoViewIfNeeded();
        const bounds = await renal.boundingBox();
        check(bounds && bounds.x >= -1 && bounds.x + bounds.width <= 391,
          key + ": mobile renal summary exceeds viewport");
        await page.screenshot({ path: join(dir, key + "-mobile.png"), fullPage: true });
        check(patientPosts === 0, key + ": case data appeared in a POST request");
        cases.push({ key, antibiotic, mode, renal: measured ? "measured" : "absent", screen: screenName,
          exportPdf: exportName, printPdf: printName,
          exportPages: pdfPages(join(dir, exportName)), printPages: pdfPages(join(dir, printName)),
          assertions: "PASS", notes: "complement to legacy six-case browser runner" });
        console.log("PASS additional browser/download/print " + key);
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
check(pageErrors.length === 0, "Browser page errors: " + pageErrors.join("; "));

// The six original cases were just executed by the preceding existing runner.
// Verify their on-disk browser, actual-export and printed-PDF evidence as well.
const all = [];
for (const antibiotic of antibiotics) {
  for (const mode of ["recommendation", "evaluation"]) {
    const key = antibiotic + "-" + mode;
    const original = {
      key, antibiotic, mode, renal: mode === "recommendation" ? "absent" : "measured",
      screen: key + "-desktop.png",
      exportPdf: key + "-export.pdf",
      printPdf: key + "-print.pdf",
      assertions: "PASS", notes: "existing full-featured browser/PDF/print runner",
    };
    for (const filename of [original.screen, original.exportPdf, original.printPdf]) {
      check(statSync(join(dir, filename)).size > 700, key + ": original evidence file missing/empty " + filename);
    }
    check(pdfText(join(dir, original.exportPdf)).includes("Versi aturan: 2026.11.03"), key + ": original exported PDF version does not match v20");
    check(pdfText(join(dir, original.printPdf)).includes("Versi aturan 2026.11.03."), key + ": original print PDF version does not match v20");
    original.exportPages = pdfPages(join(dir, original.exportPdf));
    original.printPages = pdfPages(join(dir, original.printPdf));
    all.push(original);
    const complement = cases.find(item => item.antibiotic === antibiotic && item.mode === mode);
    check(complement, key + ": complementary case missing");
    all.push(complement);
  }
}
check(all.length === 12 && cases.length === 6, "Expected exactly 12 scenario proofs");
writeFileSync(join(dir, "12-scenario-results.json"), JSON.stringify({
  suite: "v20-4.5-screen-pdf-print",
  reference: "frozen v20 notebook/XLSX oracle via CI",
  head: process.env.GITHUB_SHA ?? "local",
  scenarioCount: all.length,
  totals: { screens: 12, exportedPdfs: 12, printedPdfs: 12 },
  scenarios: all,
  pageErrors,
  checkedAt: new Date().toISOString(),
}, null, 2) + "\n");
console.log("PASS v20 4.5: 12/12 browser cases, 12 real PDF exports, 12 print PDFs, screenshots and mobile proofs");
