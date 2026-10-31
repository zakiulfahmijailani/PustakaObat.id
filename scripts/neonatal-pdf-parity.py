"""Verify and render PDFs downloaded by neonatal-browser-parity.cjs.

Requires: python -m pip install pymupdf
This checks numerical outputs and page boundaries; inspect the rendered PNGs too.
"""
import json
import subprocess
import sys
from pathlib import Path

import pymupdf

output = Path('.tmp/neonatal-parity')
oracle = json.loads(subprocess.check_output([sys.executable, 'scripts/neonatal-notebook-oracle.py'], encoding='utf-8'))
texts = {}
report = {}
for name in ['recommendation', 'evaluation', 'evaluation-no-manual', 'batch-summary']:
    document = pymupdf.open(output / (name + '.pdf'))
    texts[name] = ' '.join(' '.join(page.get_text().split()) for page in document)
    for index, page in enumerate(document):
        for word in page.get_text('words'):
            assert 0 <= word[0] <= word[2] <= page.rect.width, (name, index, word)
            assert 0 <= word[1] <= word[3] <= page.rect.height, (name, index, word)
        page.get_pixmap(matrix=pymupdf.Matrix(1.4, 1.4)).save(output / f'{name}-page-{index+1}.png')
    report[name] = {'pages': len(document), 'pageBounds': 'pass'}

for value in ['29 minggu 3 hari', '15,4 mg', 'tiap 48 jam', '16,5 mg', 'diasumsikan normal']:
    assert value in texts['recommendation'], value
for field in ['Aktual vs RS (dosis)', 'Aktual vs RS (frek)', 'Manual vs RS (dosis)', 'Manual vs RS (frek)', 'Aktual vs Literatur (dosis)', 'Aktual vs Literatur (frek)', 'Manual vs Literatur (dosis)', 'Manual vs Literatur (frek)']:
    record = next(r for r in oracle['batchRecords'] if r['Kode Pasien'] == 'T16')
    assert record[field] in texts['evaluation'], (field, record[field])
assert 'Manual dosis:' not in texts['evaluation-no-manual']
assert 'Manual interval:' not in texts['evaluation-no-manual']
assert 'Kandidat: 34; Berhasil: 30; Gagal: 4' in texts['batch-summary']
for family in ['dosis', 'frekuensi']:
    for drug, comparisons in oracle['statistics'][family]['per_antibiotik'].items():
        for comparison, result in comparisons.items():
            if 'p' not in result:
                continue
            calculation = 'aktual' if comparison.startswith('aktual') else 'manual'
            reference = 'Pedoman Rumah Sakit' if comparison.endswith('RS') else 'Literatur Terkini'
            expected = f"{drug.lower()} / {family.capitalize()} {calculation} / {reference}: {result['uji']}, n={result['n']}, p={result['p']:.4f}"
            assert expected.lower() in texts['batch-summary'].lower(), expected
report['notebookSha256'] = oracle['source']['sha256']
(output / 'pdf-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
