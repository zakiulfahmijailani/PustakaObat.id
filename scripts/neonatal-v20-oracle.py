"""Execute the frozen v20 notebook against the original input/comparator XLSX.

Never reads Downloads or derives expectations from TypeScript. Package-install
shell lines are omitted and display output is captured. Built-in notebook tests
write only into a private temporary directory, which is removed before exit.
"""
import contextlib
import hashlib
import io
import importlib.util
import json
import math
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "tests/fixtures/neonatal/v20"
legacy_spec = importlib.util.spec_from_file_location("legacy_notebook_oracle", ROOT / "scripts/neonatal-notebook-oracle.py")
legacy = importlib.util.module_from_spec(legacy_spec)
legacy_spec.loader.exec_module(legacy)
clean, recommendation = legacy.clean, legacy.recommendation


def verified_sources():
    raw = (FIXTURES / "manifest.json").read_bytes()
    manifest = json.loads(raw)
    files = {}
    for entry in manifest["files"]:
        path = FIXTURES / entry["path"]
        content = path.read_bytes()
        digest = hashlib.sha256(content).hexdigest()
        if len(content) != entry["bytes"] or digest != entry["sha256"]:
            raise ValueError(f"Frozen v20 source changed: {entry['path']}")
        files[entry["role"]] = {**entry, "actualSha256": digest}
    return manifest, files, hashlib.sha256(raw).hexdigest()


def load_notebook(manifest, files):
    notebook = json.loads((FIXTURES / files["notebook"]["path"]).read_bytes())
    namespace = {"__name__": "notebook_v20_oracle"}
    # The notebook self-tests use tempfile.gettempdir() for an XLSX export.
    # Isolate those files from the caller and concurrent legacy oracle runs.
    previous_tempdir = tempfile.tempdir
    with tempfile.TemporaryDirectory(prefix="neonatal-v20-") as temporary:
        try:
            tempfile.tempdir = temporary
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                for index in manifest["executedCells"]:
                    cell = notebook["cells"][index]
                    if cell["cell_type"] != "code":
                        raise ValueError(f"v20 cell {index} is not executable code")
                    source = "".join(cell["source"])
                    source = "\n".join(
                        line for line in source.splitlines()
                        if not line.lstrip().startswith("!pip ")
                    )
                    exec(compile(source, f"notebook-v20-cell-{index}", "exec"), namespace)
                    namespace["display"] = lambda *args, **kwargs: None
        finally:
            tempfile.tempdir = previous_tempdir
    if namespace["VERSI_ATURAN"] != manifest["ruleVersion"]:
        raise ValueError("v20 rule version differs from manifest")
    checks = namespace["hasil_uji"].to_dict("records")
    if len(checks) != manifest["expected"]["notebookChecks"] or any(
        check["Status"] != "LULUS" for check in checks
    ):
        raise ValueError(f"v20 built-in checks did not pass: {checks}")
    return namespace, checks


def read_workbooks(files):
    import openpyxl

    source = openpyxl.load_workbook(FIXTURES / files["input"]["path"], data_only=False)
    comparator = openpyxl.load_workbook(FIXTURES / files["comparator"]["path"], data_only=False)
    try:
        table = [list(row) for row in source["Data Pasien"].iter_rows(values_only=True)]
        expected = [list(row) for row in comparator["Diharapkan"].iter_rows(values_only=True)]
        # Extract the actual lookup headers from Cek formulas, rather than
        # inventing a second list of which columns the supplied checker covers.
        checked = []
        for cell in comparator["Cek"][8][1:]:
            matches = re.findall(r'MATCH\("([^"]+)",\s*\'Hasil Web\'!', cell.value or "")
            if not matches:
                raise ValueError(f"Unrecognized Cek formula at {cell.coordinate}")
            # Earlier MATCH calls locate Kode Pasien; the last MATCH selects
            # the actual output column being compared by this formula.
            checked.append(matches[-1])
        rejected = [row[0] for row in comparator["Dilewati (diharapkan)"].iter_rows(min_row=2, values_only=True) if row[0]]
        pasted_rows = sum(
            any(value is not None for value in row)
            for row in comparator["Hasil Web"].iter_rows(values_only=True)
        )
        return table, expected, checked, rejected, pasted_rows
    finally:
        source.close()
        comparator.close()


def boundary_profiles(namespace):
    profiles = []
    for drug in ["gentamisin", "amikasin", "vankomisin"]:
        for weeks, days in [(22, 0), (28, 6), (29, 0), (29, 6), (30, 0), (34, 6),
                            (35, 0), (36, 6), (37, 0), (40, 6), (41, 0), (43, 0)]:
            for pna in [0, 2, 3, 7, 8, 14, 15, 28]:
                for modifier in ["none", "hypothermia", "cox", "both"]:
                    patient = {"antibiotic": drug, "gestationalAgeWeeks": weeks,
                               "gestationalAgeDays": days, "postnatalAgeDays": pna,
                               "currentWeightKg": 1.38, "renalDataAvailable": False,
                               "therapeuticHypothermia": modifier in ["hypothermia", "both"],
                               "coxInhibitorTherapy": modifier in ["cox", "both"]}
                    profiles.append({"input": patient, "expected": recommendation(namespace, patient)})
        for scr in [0, 0.49, 0.5, 0.99, 1, 1.01]:
            for uop in [None, 0, 0.99, 1, 1.01]:
                patient = {"antibiotic": drug, "gestationalAgeWeeks": 30,
                           "gestationalAgeDays": 0, "postnatalAgeDays": 10,
                           "currentWeightKg": 1.45, "renalDataAvailable": True,
                           "serumCreatinineMgDl": scr}
                if uop is not None:
                    patient["urineOutputMlKgHour"] = uop
                profiles.append({"input": patient, "expected": recommendation(namespace, patient)})
    return profiles


def input_profiles(namespace, table, records):
    valid = {record["Kode Pasien"] for record in records}
    profiles = []
    for values in table[1:]:
        row = dict(zip(table[0], values))
        if row["kode_pasien"] not in valid:
            continue
        patient = {"patientLabel": row["kode_pasien"], "antibiotic": row["antibiotik"].lower(),
                   "gestationalAgeWeeks": row["usia_gestasi_lahir_minggu"],
                   "gestationalAgeDays": row["usia_gestasi_lahir_hari"] or 0,
                   "postnatalAgeDays": row["usia_pascalahir_hari"], "currentWeightKg": row["berat_badan_kg"],
                   "renalDataAvailable": row["kreatinin_serum_mg_dl"] is not None,
                   "therapeuticHypothermia": namespace["_ya"](row["hipotermia_terapeutik"]),
                   "coxInhibitorTherapy": namespace["_ya"](row["terapi_cox_inhibitor"]),
                   "severeSepsisOrHighRiskInfection": namespace["_ya"](row["sepsis_berat"])}
        for key, field in [("serumCreatinineMgDl", "kreatinin_serum_mg_dl"),
                           ("urineOutputMlKgHour", "produksi_urin_ml_kg_jam")]:
            if row[field] is not None:
                patient[key] = row[field]
        profiles.append({"input": patient, "expected": recommendation(namespace, patient)})
    return profiles


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    manifest, files, manifest_sha = verified_sources()
    namespace, checks = load_notebook(manifest, files)
    table, expected, checked, rejected, pasted_rows = read_workbooks(files)
    import numpy
    import pandas
    import scipy
    import openpyxl

    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        records, warnings = namespace["proses_dataframe"](
            pandas.DataFrame(table[1:], columns=table[0]), namespace["bangun_rekomendasi"],
            namespace["_kategori_dosis"], namespace["_fmt_num"],
        )
        statistics = namespace["hitung_statistik"](records)
        interpretation = namespace["buat_interpretasi"](records, statistics)
        profiles = boundary_profiles(namespace)
        batch_profiles = input_profiles(namespace, table, records)
    public_headers = [key for key in records[0] if not key.startswith("_")]
    lookup = {record["Kode Pasien"]: record for record in records}
    comparisons, differences = 0, []
    for row in expected[1:]:
        target = dict(zip(expected[0], row))
        actual = lookup.get(target["Kode Pasien"], {})
        for key in public_headers:
            a, b = actual.get(key), target.get(key)
            equal = math.isclose(a, b, rel_tol=0, abs_tol=1e-9) if isinstance(a, (int, float)) and isinstance(b, (int, float)) else a == b
            comparisons += 1
            if not equal:
                differences.append({"id": target["Kode Pasien"], "field": key, "python": a, "excel": b})
    expected_counts = manifest["expected"]
    if (len(table) - 1 != expected_counts["inputRows"]
            or len(records) != expected_counts["validRows"]
            or len(public_headers) != expected_counts["publicColumns"]
            or len(checked) != expected_counts["comparatorCheckedColumns"]
            or len(set(checked)) != len(checked)
            or checked != [key for key in public_headers if key not in ("Kode Pasien", "Berat Badan (kg)")]
            or rejected != expected_counts["rejectedCodes"]
            or len(expected) - 1 != len(records)
            or len(lookup) != len(records)
            or comparisons != expected_counts["validRows"] * expected_counts["publicColumns"]
            or differences):
        raise ValueError(f"v20 input/comparator reconciliation failed: {differences}")
    # Independent branch coverage: repeat the previous regression cohort inputs,
    # but calculate every expectation using the frozen v20 Python implementation.
    cases = []
    scenarios = [("empty", []), ("small", [5]), ("zero", [6.25]*6),
                 ("constant", [9]*6), ("normal", [7.5+i*0.07 for i in range(25)]),
                 ("manual-equal", [6.25]*6), ("manual-different", [9]*6)]
    scenarios += [(f"ties-{n}", [7.5+(0 if i<n-3 else i%2+1) for i in range(n)])
                  for n in [3,13,14,20,50,51]]
    scenarios += [("no-ties", [7.5+i**3/100000 for i in range(51)])]
    for name, doses in scenarios:
        rows = []
        for i, dose in enumerate(doses):
            row = dict(zip(table[0], table[1]))
            row.update(kode_pasien=f"{name}-{i}", antibiotik="Gentamisin",
                       usia_gestasi_lahir_minggu=35, usia_gestasi_lahir_hari=0,
                       usia_pascalahir_hari=8, berat_badan_kg=1,
                       dosis_aktual_mg=dose, frekuensi_aktual_jam=24)
            if name.startswith("manual"):
                row.update(dosis_manual_min_mg=5 if name=="manual-equal" else 9,
                           dosis_manual_max_mg=7.5 if name=="manual-equal" else 9,
                           frekuensi_manual_min_jam=24, frekuensi_manual_max_jam=48)
            rows.append([row.get(key) for key in table[0]])
        recs, _ = namespace["proses_dataframe"](pandas.DataFrame(rows,columns=table[0]),
            namespace["bangun_rekomendasi"], namespace["_kategori_dosis"], namespace["_fmt_num"])
        stat = namespace["hitung_statistik"](recs)
        cases.append({"name":name,"rows":rows,"statistics":stat,
                      "interpretation":namespace["buat_interpretasi"](recs,stat)})
    result = {
        "source": {"ruleVersion": manifest["ruleVersion"], "manifestSha256": manifest_sha,
                   "files": files, "executedCells": manifest["executedCells"],
                   "runtime": {"numpy": numpy.__version__, "pandas": pandas.__version__,
                               "scipy": scipy.__version__, "openpyxl": openpyxl.__version__}},
        "notebookChecks": checks, "header": table[0], "inputRows": table[1:],
        "publicHeaders": public_headers, "batchRecords": records, "batchWarnings": warnings,
        "statistics": statistics, "summary": namespace["ringkasan_kesesuaian"](records),
        "interpretation": interpretation, "recommendations": profiles, "batchRecommendations": batch_profiles,
        "cases": cases,
        "comparator": {"headers": expected[0], "rows": expected[1:], "checkedHeaders": checked,
                       "rejectedCodes": rejected, "pastedWebRows": pasted_rows,
                       "comparedCells": comparisons, "differences": differences},
    }
    print(json.dumps(clean(result), ensure_ascii=False, allow_nan=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
