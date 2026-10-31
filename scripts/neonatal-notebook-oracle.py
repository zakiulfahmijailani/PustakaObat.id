"""Execute the user's unmodified v18 rules and export reproducible parity fixtures.

Only notebook package-install shell lines are omitted. No calculation function is
rewritten. Display is captured so widgets, form tests, and batch tests all run.
"""
import argparse
import contextlib
import hashlib
import io
import json
import math
import re
import sys
from pathlib import Path


def clean(value):
    if isinstance(value, dict):
        return {str(k): clean(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)):
        return [clean(v) for v in value]
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if hasattr(value, "item"):
        return clean(value.item())
    return value


def load_notebook(path):
    raw = path.read_bytes()
    nb = json.loads(raw)
    ns = {"__name__": "notebook_oracle"}
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        for index in [3, 5, 6, 8, 10, 14, 17]:
            source = "".join(nb["cells"][index]["source"])
            source = "\n".join(line for line in source.splitlines() if not line.lstrip().startswith("!pip "))
            exec(compile(source, f"notebook-cell-{index}", "exec"), ns)
            ns["display"] = lambda *a, **k: None
    checks = ns["hasil_uji"].to_dict("records")
    return ns, hashlib.sha256(raw).hexdigest(), checks


def official_input(root):
    source = (root / "src/lib/neonatal-calculator/__tests__/official-input-and-comparator-34cases.test.ts").read_text(encoding="utf-8")
    header = json.loads(re.search(r"const header = (\[.*?\]);", source, re.S)[1])
    rows = json.loads(re.search(r"const input: unknown\[\]\[\] = (\[.*?\n\]);", source, re.S)[1].replace(",\n]", "\n]"))
    return header, rows


def recommendation(ns, patient):
    drug = {"gentamisin": "Gentamisin", "amikasin": "Amikasin", "vankomisin": "Vankomisin"}[patient["antibiotic"]]
    h = ns["bangun_rekomendasi"](drug, patient["gestationalAgeWeeks"] + patient.get("gestationalAgeDays", 0) / 7,
        patient["postnatalAgeDays"], patient["currentWeightKg"], scr=patient.get("serumCreatinineMgDl"),
        uop=patient.get("urineOutputMlKgHour"), hipotermia=patient.get("therapeuticHypothermia", False),
        cox_inhibitor=patient.get("coxInhibitorTherapy", False), sepsis_berat=patient.get("severeSepsisOrHighRiskInfection", False))
    return {"pmaWeeks": h["pma_minggu"], "rsDose": h["rs_rentang_mg"], "rsPerKg": h["rs_rentang_per_kg"],
        "rsInterval": [h["rs"]["interval_min"], h["rs"]["interval_max"]], "litDose": h["lit_rentang_mg"],
        "litPerKg": h["lit_rentang_per_kg"], "litInterval": h["lit_interval_rentang"],
        "renalAvailable": h["data_ginjal_tersedia"], "renalAssumedNormal": not h["data_ginjal_tersedia"] and h["ginjal_normal"],
        "renalHighRisk": h["risiko_ginjal_tinggi"],
        "warnings": [[level, title] for level, title, _body in ns["_peringatan_rekomendasi"](h)]}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("notebook", nargs="?", type=Path, default=Path(__file__).resolve().parent.parent / "tests/fixtures/neonatal/notebook-v18.ipynb")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    ns, sha, checks = load_notebook(args.notebook)
    header, rows = official_input(root)
    import pandas as pd
    records, warnings = ns["proses_dataframe"](pd.DataFrame(rows, columns=header), ns["bangun_rekomendasi"], ns["_kategori_dosis"], ns["_fmt_num"])
    extra_rows = []
    for drug in ["Gentamisin", "Amikasin", "Vankomisin"]:
        for weight in [0.3,0.301,0.999,1.001,1.003,1.005,1.007,1.111,1.723,3.451,10]:
            for dose_factor in [0.999,1,1.001]:
                dose = (5 if drug == "Gentamisin" else 15) * weight * dose_factor
                record = dict(zip(header, rows[0]))
                record.update(kode_pasien=f"EDGE-{len(extra_rows)+1}",antibiotik=drug,usia_gestasi_lahir_minggu=33,
                    usia_pascalahir_hari=8,berat_badan_kg=weight,kreatinin_serum_mg_dl=0.6,produksi_urin_ml_kg_jam=2,
                    dosis_aktual_mg=dose,dosis_manual_min_mg=dose,dosis_manual_max_mg=dose*1.5,
                    frekuensi_aktual_jam=36,frekuensi_manual_min_jam=24,frekuensi_manual_max_jam=48)
                extra_rows.append([record.get(key) for key in header])
    extra_records, extra_warnings = ns["proses_dataframe"](pd.DataFrame(extra_rows,columns=header), ns["bangun_rekomendasi"], ns["_kategori_dosis"], ns["_fmt_num"])
    # Exact age-band boundaries, renal thresholds, and all modifier combinations.
    patients = []
    for drug in ["gentamisin", "amikasin", "vankomisin"]:
        for ga, day in [(22,0),(28,6),(29,0),(29,6),(30,0),(34,6),(35,0),(36,6),(37,0),(40,6),(41,0),(43,0)]:
            for pna in [0,2,3,7,8,14,15,28]:
                for modifier in ["none", "hypothermia", "cox", "both"]:
                    p = {"antibiotic": drug, "gestationalAgeWeeks": ga, "gestationalAgeDays": day, "postnatalAgeDays": pna,
                         "currentWeightKg": 1.38, "renalDataAvailable": False, "therapeuticHypothermia": modifier in ["hypothermia", "both"],
                         "coxInhibitorTherapy": modifier in ["cox", "both"]}
                    patients.append({"input": p, "expected": recommendation(ns, p)})
        for scr in [0,0.49,0.5,0.99,1,1.01]:
            for uop in [None,0,0.99,1,1.01]:
                p = {"antibiotic": drug, "gestationalAgeWeeks": 30, "gestationalAgeDays": 0, "postnatalAgeDays": 10,
                     "currentWeightKg": 1.45, "renalDataAvailable": True, "serumCreatinineMgDl": scr}
                if uop is not None: p["urineOutputMlKgHour"] = uop
                patients.append({"input": p, "expected": recommendation(ns, p)})
    cohorts = []
    for name, values in [
        ("zero", [7.5]*6), ("constant", [8.5]*6),
        *[(f"ties-{n}", [7.5 + (0 if i < n-3 else (i % 2 + 1)) for i in range(n)]) for n in [3,13,14,20,50,51]],
        ("normal", [7.5 + i*0.07 for i in range(25)]),
        ("no-ties", [7.5 + i**3/100000 for i in range(51)]),
    ]:
        cohort_rows = []
        for i, dose in enumerate(values):
            rec = dict(zip(header, rows[0]))
            rec.update(kode_pasien=f"{name}-{i}", antibiotik="Gentamisin",
                usia_gestasi_lahir_minggu=35, usia_pascalahir_hari=8, berat_badan_kg=1,
                dosis_aktual_mg=dose,frekuensi_aktual_jam=24)
            cohort_rows.append([rec.get(key) for key in header])
        cohort_records, _ = ns["proses_dataframe"](pd.DataFrame(cohort_rows, columns=header), ns["bangun_rekomendasi"], ns["_kategori_dosis"], ns["_fmt_num"])
        cohorts.append({"name":name,"rows":cohort_rows,"statistics":ns["hitung_statistik"](cohort_records)})
    import scipy
    result = {"source": {"filename": args.notebook.name, "sha256": sha, "ruleVersion": ns["VERSI_ATURAN"], "scipyVersion": scipy.__version__,
                         "executedCells": [3,5,6,8,10,14,17]}, "notebookChecks": checks,
              "header": header, "inputRows": rows, "batchRecords": records, "batchWarnings": warnings,
              "statistics": ns["hitung_statistik"](records), "summary": ns["ringkasan_kesesuaian"](records),
              "recommendations": patients,"extraInputRows":extra_rows,"extraRecords":extra_records,"extraWarnings":extra_warnings,"cohorts":cohorts}
    print(json.dumps(clean(result), ensure_ascii=False, allow_nan=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
