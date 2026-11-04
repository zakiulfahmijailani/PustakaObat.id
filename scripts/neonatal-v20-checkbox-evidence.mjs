// Isolated synthetic browser verification of v20 form explanations, not a deployment.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const output = process.env.NEONATAL_CHECKBOX_EVIDENCE_DIR;
if (!output) throw new Error("NEONATAL_CHECKBOX_EVIDENCE_DIR is required");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.NEONATAL_CHROME_PATH ? { executablePath: process.env.NEONATAL_CHROME_PATH } : {}),
  args: ["--no-sandbox"],
});
const antibiotics = {
  gentamisin: ["minimal 36 jam", "bertambah 12 jam", "tidak memengaruhi perhitungan gentamisin"],
  amikasin: ["bertambah 12 jam", "penambahan dilakukan sekali", "tidak memengaruhi perhitungan amikasin"],
  vankomisin: ["trough sebelum dosis ke-2", "tidak mengubah dosis atau interval", "dosis muatan 20 mg/kg"],
};
const keys = ["therapeuticHypothermia", "coxInhibitorTherapy", "severeSepsisOrHighRiskInfection"];
const assert = (value, message) => { if (!value) throw new Error(message); };
const origin = "http://127.0.0.1:3000";

try {
  for (const [antibiotic, expectations] of Object.entries(antibiotics)) {
    for (const mode of ["recommendation", "evaluation"]) {
      const prefix = mode === "recommendation" ? "rec" : "eval";
      const name = antibiotic + "-" + mode;
      const page = await browser.newPage({ viewport: { width: 1280, height: 880 } });
      try {
        await page.goto(origin + "/kalkulator?mode=" + mode, { waitUntil: "domcontentloaded", timeout: 60000 });
        const panel = page.locator("#" + mode + "-panel");
        await panel.locator("#" + prefix + "-antibiotic").waitFor({ state: "visible", timeout: 30000 });
        await panel.locator("#" + prefix + "-antibiotic").selectOption(antibiotic);

        const description = panel.getByRole("note");
        const limits = await description.innerText();
        assert(limits.includes("usia gestasi 22–43 minggu"), name + ": GA limits absent");
        assert(limits.includes("usia pascalahir 0–28 hari"), name + ": PNA limits absent");
        assert(limits.includes("berat 0,3–10 kg"), name + ": weight limits absent");
        assert(limits.includes("kreatinin serum 0–10 mg/dL"), name + ": SCr limits absent");
        assert(limits.includes("produksi urin 0–10 mL/kg/jam"), name + ": UOP limits absent");
        assert(limits.includes("bukan batas klinis"), name + ": guardrail disclaimer absent");

        for (const [index, key] of keys.entries()) {
          const checkbox = panel.locator("#" + prefix + "-" + key);
          const descriptionId = await checkbox.getAttribute("aria-describedby");
          assert(descriptionId === prefix + "-" + key + "-effect", name + ": missing checkbox description");
          const effect = await panel.locator("#" + descriptionId).innerText();
          assert(effect.includes(expectations[index]), name + ": incorrect " + key + " effect: " + effect);
        }

        const scr = panel.locator("#" + prefix + "-scr");
        const renal = panel.getByRole("checkbox", { name: "Data fungsi ginjal tersedia" });
        assert(await scr.isDisabled(), name + ": creatinine should initially be disabled");
        await renal.check();
        assert(await scr.isEnabled(), name + ": creatinine should enable when renal data checked");
        await renal.uncheck();
        assert(await scr.isDisabled(), name + ": creatinine should disable when renal data unchecked");

        await panel.locator("#" + prefix + "-ga").fill("32");
        await panel.locator("#" + prefix + "-pna").fill("5");
        await panel.locator("#" + prefix + "-weight").fill("1.5");
        await panel.locator("#" + prefix + "-therapeuticHypothermia").check();
        await panel.locator("#" + prefix + "-coxInhibitorTherapy").check();
        assert((await panel.innerText()).includes("Dua kondisi dicentang bersamaan."), name + ": combined guidance absent");
        await panel.locator("#" + prefix + "-severeSepsisOrHighRiskInfection").check();

        if (mode === "evaluation") {
          const manual = panel.getByRole("checkbox", { name: "Saya punya hasil hitung manual sebagai pembanding (opsional)" });
          assert((await panel.innerText()).includes("batas bawah dan batas atas sama"), name + ": manual guidance absent");
          await manual.check();
          assert(await panel.locator("#eval-manualDoseMinMg").isVisible(), name + ": manual fields not revealed");
          await manual.uncheck();
          assert(await panel.locator("#eval-manualDoseMinMg").count() === 0, name + ": manual fields still present");
          await panel.locator("#eval-actual-dose").fill("8");
          await panel.locator("#eval-actual-hours").fill("24");
          await panel.getByRole("button", { name: "Evaluasi Pemberian" }).last().click();
        } else {
          await panel.getByRole("button", { name: "Hitung rekomendasi" }).click();
        }
        await panel.locator('section[aria-label="Rujukan"]').waitFor({ state: "visible", timeout: 30000 });
        await page.screenshot({ path: join(output, name + "-desktop.png"), fullPage: true });
        if (mode === "recommendation") {
          await page.setViewportSize({ width: 390, height: 844 });
          await description.scrollIntoViewIfNeeded();
          const bounds = await description.boundingBox();
          assert(bounds && bounds.x >= -1 && bounds.x + bounds.width <= 391, name + ": input limits note overflows mobile");
          await page.screenshot({ path: join(output, name + "-mobile.png"), fullPage: true });
        }
        console.log("PASS checkbox and input guardrails: " + name);
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
