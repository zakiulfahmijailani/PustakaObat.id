/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS browser runner. */
/* End-to-end checks against the executed Python notebook, not TS expectations.
 * npm install --no-save playwright (or set PLAYWRIGHT_MODULE to an installed copy).
 * Start the production app first; BASE_URL defaults to http://localhost:3110.
 */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ExcelJS = require('exceljs');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const oracle = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['scripts/neonatal-notebook-oracle.py'], { encoding:'utf8', maxBuffer:16*1024*1024 }));
const output = path.resolve('.tmp/neonatal-parity'); fs.mkdirSync(output,{recursive:true});
const base = process.env.BASE_URL || 'http://localhost:3110';

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:"reduce",acceptDownloads:true});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  let requestsWithPatientData=0;
  page.on('request',r=>{if(r.method()==='POST' && /T\d\d|EDGE-|1,38/.test(r.postData()||'')) requestsWithPatientData++;});
  async function download(button,name){const event=page.waitForEvent('download');await button.click();const d=await event;const target=path.join(output,name);await d.saveAs(target);return target;}
  async function fill(prefix,values){
    const row=Object.fromEntries(oracle.header.map((key,i)=>[key,values[i]]));
    await page.locator('#'+prefix+'-patient-label').fill(row.kode_pasien);
    await page.locator('#'+prefix+'-antibiotic').selectOption(row.antibiotik.toLowerCase());
    for(const [id,key] of [['ga','usia_gestasi_lahir_minggu'],['ga-days','usia_gestasi_lahir_hari'],['pna','usia_pascalahir_hari'],['weight','berat_badan_kg']]) await page.locator('#'+prefix+'-'+id).fill(row[key]===null?'':String(row[key]).replace('.',','));
    const panel=page.locator('#'+(prefix==='rec'?'recommendation':'evaluation')+'-panel');
    await panel.getByLabel('Data fungsi ginjal tersedia',{exact:true}).setChecked(row.kreatinin_serum_mg_dl!==null);
    if(row.kreatinin_serum_mg_dl!==null){await page.locator('#'+prefix+'-scr').fill(String(row.kreatinin_serum_mg_dl).replace('.',','));await page.locator('#'+prefix+'-uop').fill(row.produksi_urin_ml_kg_jam===null?'':String(row.produksi_urin_ml_kg_jam).replace('.',','));}
    for(const [label,key] of [['Hipotermia terapeutik / HIE','hipotermia_terapeutik'],['Terapi indometasin atau ibuprofen (COX inhibitor)','terapi_cox_inhibitor'],['Sepsis berat / kecurigaan MRSA / meningitis / endokarditis','sepsis_berat']]) await panel.getByLabel(label,{exact:true}).setChecked(row[key]==='Ya');
    return row;
  }
  await page.goto(base+'/kalkulator');
  assert.equal(await page.locator('#rec-antibiotic').inputValue(),'');
  for(const field of ['ga','ga-days','pna','weight']) assert.equal(await page.locator('#rec-'+field).inputValue(),'');
  await page.getByRole('button',{name:'Hitung rekomendasi',exact:true}).click();
  assert.ok(await page.locator('#rec-ga-error').isVisible(),'empty patient validation');
  const valid=oracle.inputRows.filter(row=>oracle.batchRecords.some(r=>r['Kode Pasien']===row[0]));
  for(const input of valid){
    await fill('rec',input);
    await page.getByRole('button',{name:'Hitung rekomendasi',exact:true}).click();
    const table=page.locator('#recommendation-panel table').first(); await table.waitFor();
    const record=oracle.batchRecords.find(r=>r['Kode Pasien']===input[0]);
    const dose=await table.locator('tbody tr').nth(0).locator('td strong').allTextContents();
    assert.deepEqual(dose.map(x=>x.replaceAll('–','-')),[record['Dosis RS (mg)'],record['Dosis Literatur (mg)']],input[0]+' dose in browser');
    const frequency=await table.locator('tbody tr').nth(1).locator('td').allTextContents();
    assert.deepEqual(frequency.map(x=>x.replace(' (bukan rutin)','').replaceAll('–','-')),[record['Frek RS'],record['Frek Literatur']],input[0]+' interval in browser');
  }
  // A fractional gestation and comma decimal must reach the same band as Python.
  await fill('rec',oracle.inputRows.find(r=>r[0]==='T14'));
  await page.getByRole('button',{name:'Hitung rekomendasi',exact:true}).click();
  await page.getByText('15,4 mg',{exact:true}).first().waitFor();
  await download(page.getByRole('button',{name:'Unduh PDF Rekomendasi Dosis',exact:true}),'recommendation.pdf');
  await page.screenshot({path:path.join(output,'recommendation-desktop.png'),fullPage:true});
  await page.getByRole('tab',{name:'Evaluasi Pemberian',exact:true}).click();
  assert.equal(await page.locator('#eval-antibiotic').inputValue(),'','evaluation is independent');
  for(const input of valid){
    const row=await fill('eval',input);
    await page.locator('#eval-actual-dose').fill(String(row.dosis_aktual_mg).replace('.',','));
    await page.locator('#eval-actual-hours').fill(String(row.frekuensi_aktual_jam));
    const manual=row.dosis_manual_min_mg!==null;
    await page.getByLabel('Saya punya hasil hitung manual sebagai pembanding (opsional)',{exact:true}).setChecked(manual);
    if(manual) for(const [id,key] of [['manualDoseMinMg','dosis_manual_min_mg'],['manualDoseMaxMg','dosis_manual_max_mg'],['manualIntervalMinHours','frekuensi_manual_min_jam'],['manualIntervalMaxHours','frekuensi_manual_max_jam']]) await page.locator('#eval-'+id).fill(String(row[key]).replace('.',','));
    await page.getByRole('button',{name:'Evaluasi Pemberian',exact:true}).click();
    const cards=page.locator('#evaluation-panel article'); await cards.first().waitFor();
    const record=oracle.batchRecords.find(r=>r['Kode Pasien']===row.kode_pasien);
    for(let i=0;i<2;i++){
      const ref=i===0?'RS':'Literatur'; const text=await cards.nth(i).innerText();
      for(const key of ['Aktual vs '+ref+' (dosis)','Aktual vs '+ref+' (frek)',...(manual?['Manual vs '+ref+' (dosis)','Manual vs '+ref+' (frek)']:[])]) {
        // Non-routine RS frequency is intentionally represented as not evaluable.
        if(record[key]!=='-') assert.ok(text.includes(record[key]),row.kode_pasien+' '+key+' expected '+record[key]+' in '+text);
      }
    }
    if(row.kode_pasien==='T17') await download(page.getByRole('button',{name:'Unduh PDF Evaluasi Pemberian',exact:true}),'evaluation-no-manual.pdf');
    if(row.kode_pasien==='T16') await download(page.getByRole('button',{name:'Unduh PDF Evaluasi Pemberian',exact:true}),'evaluation.pdf');
  }
  await page.locator('#evaluation-panel').getByRole('button',{name:'Pasien Baru',exact:true}).click();
  for(const field of ['ga','ga-days','pna','weight','actual-dose','actual-hours']) assert.equal(await page.locator('#eval-'+field).inputValue(),'');
  assert.equal(await page.locator('#evaluation-panel article').count(),0);
  // Exercise actual upload and downloads, rather than calling app internals.
  await page.getByRole('tab',{name:'Evaluasi Batch',exact:true}).click();
  const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Data Pasien');sheet.addRows([oracle.header,...oracle.inputRows]);
  const inputBytes=await book.xlsx.writeBuffer();
  await page.locator('input[type=file]').setInputFiles({name:'notebook-34-cases.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(inputBytes)});
  await page.getByRole('heading',{name:'Ringkasan batch',exact:true}).waitFor();
  for(const [label,value] of [['Kandidat','34'],['Diproses','30'],['Gagal','4']]) assert.equal(await page.locator('#batch-panel dl div').filter({has:page.getByText(label,{exact:true})}).locator('dd').innerText(),value);
  const excel=await download(page.getByRole('button',{name:'Unduh hasil Excel',exact:true}),'batch-result.xlsx');
  const exported=new ExcelJS.Workbook();await exported.xlsx.readFile(excel);
  const results=exported.getWorksheet('Hasil per Pasien');assert.equal(results.rowCount,31);assert.equal(results.columnCount,24);
  results.getRow(1).eachCell((cell,col)=>oracle.batchRecords.forEach((record,i)=>{const actual=results.getRow(i+2).getCell(col).value,expected=record[cell.value];if(typeof expected==='number')assert.ok(Math.abs(actual-expected)<1e-9);else assert.equal(actual,expected,record['Kode Pasien']+' '+cell.value);}));
  await download(page.getByRole('button',{name:'Unduh PDF Ringkasan Batch',exact:true}),'batch-summary.pdf');
  await page.screenshot({path:path.join(output,'batch-desktop.png'),fullPage:true});
  await page.setViewportSize({width:375,height:812});
  for(const tab of ['Rekomendasi Dosis','Evaluasi Pemberian','Evaluasi Batch']){
    await page.getByRole('tab',{name:tab,exact:true}).click();
    const sizes=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(sizes.scroll<=sizes.width+1,tab+' mobile overflow '+JSON.stringify(sizes));
  }
  await page.screenshot({path:path.join(output,'batch-mobile.png'),fullPage:true});
  assert.equal(requestsWithPatientData,0); assert.deepEqual(errors,[]);
  await page.reload();
  assert.equal(await page.getByText(/Riwayat Rekomendasi Dosis \(/).count(),0);
  assert.equal(await page.getByText(/Riwayat Evaluasi Pemberian \(/).count(),0);
  await browser.close();
  const report={base,notebookSha256:oracle.source.sha256,recommendations:valid.length,evaluations:valid.length,excelCells:30*24,batch:{input:34,success:30,rejected:4},pdfs:4,mobileWidths:[375],pageErrors:errors,patientDataPosts:requestsWithPatientData};
  fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exit(1);});
