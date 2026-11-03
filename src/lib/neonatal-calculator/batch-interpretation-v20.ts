import type { BatchProcessingResult, BatchSuccessRow } from "./batch-engine";
import { summarizeBatch, type ComparisonMetric, type ReferenceName } from "./batch-statistics";
import { notebookBatchRecord } from "./notebook-results";
import { pythonFixed } from "./python-rounding";
import type { InterpretationParagraph, InterpretationSection } from "./batch-interpretation";
const drugs = ["Gentamisin", "Amikasin", "Vankomisin"];
const pct = (n:number,d:number) => d ? pythonFixed(100*n/d,0)+"%" : "-";
const signed = (n:number) => (n>=0?"+":"")+pythonFixed(n,3);

/** v20 cell 14: all counts, test results and patient IDs come from the current batch. */
export function buildBatchInterpretation(result:BatchProcessingResult, stats=summarizeBatch(result)):InterpretationSection[] {
  const records=result.rows.filter((r):r is BatchSuccessRow=>r.status==="berhasil").map(notebookBatchRecord);
  if(!records.length)return [{title:"Interpretasi",paragraphs:[{kind:"normal",text:"Tidak ada data valid untuk diinterpretasikan."}]}];
  const dist=(key:string,rows=records)=>{const v=rows.map(r=>r[key]).filter(v=>typeof v==="string"&&v!=="");return {n:v.length,s:v.filter(v=>v==="Sesuai").length,b:v.filter(v=>v==="Berlebih").length,k:v.filter(v=>v==="Kurang").length};};
  const test=(drug:string,metric:ComparisonMetric,ref:ReferenceName)=>stats.paired.find(t=>t.group===drug.toLowerCase()&&t.metric===metric&&t.reference===ref);
  const sections:InterpretationSection[]=[];
  let p:InterpretationParagraph[]=[];
  const add=(text:string,kind:InterpretationParagraph["kind"]="poin")=>p.push({kind,text});
  add(`Total ${records.length} pasien dianalisis. Kategori dinilai tanpa toleransi: nilai di luar rentang rujukan, sekecil apa pun selisihnya, dihitung Berlebih atau Kurang.`,"normal");
  for(const [kind,key,ref] of [["Dosis","_ka_rs","Pedoman RS"],["Dosis","_ka_lit","Literatur Terkini"],["Frekuensi","_kfa_rs","Pedoman RS"],["Frekuensi","_kfa_lit","Literatur Terkini"]]){const d=dist(key);if(d.n)add(`${kind} aktual terhadap ${ref}: ${d.s}/${d.n} Sesuai (${pct(d.s,d.n)}), ${d.b} Berlebih (${pct(d.b,d.n)}), ${d.k} Kurang (${pct(d.k,d.n)}).`);}
  let worst:{drug:string;n:number;s:number}|undefined;
  for(const drug of drugs){const d=dist("_ka_rs",records.filter(r=>r.Antibiotik===drug));if(d.n&&(!worst||d.s/d.n<worst.s/worst.n))worst={drug,n:d.n,s:d.s};}
  if(worst)add(`Proporsi dosis aktual yang Sesuai terhadap Pedoman RS paling rendah pada ${worst.drug} (${worst.s}/${worst.n}; ${pct(worst.s,worst.n)}).`+(worst.drug==="Amikasin"?" Pedoman RS amikasin berupa nilai tunggal (15 mg/kg), sehingga peluang Sesuai lebih kecil daripada antibiotik yang pedomannya berupa rentang.":""),worst.drug==="Amikasin"?"penting":"poin");
  const excess=records.filter(r=>[r._ka_rs,r._ka_lit,r._kfa_rs,r._kfa_lit].includes("Berlebih")).map(r=>r["Kode Pasien"]);
  if(excess.length)add(`Pemberian berkategori Berlebih (dosis atau frekuensi, terhadap salah satu rujukan) pada ${excess.length} pasien: ${excess.join(", ")}. Lihat sheet Hasil per Pasien untuk rinciannya.`,"penting");
  sections.push({title:"1. Kesesuaian Pemberian Aktual",paragraphs:p});p=[];
  add("Untuk setiap pasien dihitung penyimpangan dari batas rentang rujukan terdekat: dosis dalam mg/kg dan frekuensi dalam dosis/hari (24 ÷ interval); nilai di dalam rentang = 0. Uji menilai apakah penyimpangan cenderung ke satu arah (di atas atau di bawah rentang). Uji dipilih otomatis: uji t satu sampel bila penyimpangan berdistribusi normal (Shapiro-Wilk p>0,05), selain itu Wilcoxon signed-rank (nilai 0 dikeluarkan).","normal");
  for(const [kind,unit] of [["Dosis","mg/kg"],["Frekuensi","dosis/hari"]] as const)for(const drug of drugs){
    if(!records.some(r=>r.Antibiotik===drug))continue;
    for(const [ref,label] of [["Pedoman Rumah Sakit","Pedoman RS"],["Literatur Terkini","Literatur Terkini"]] as const){const t=test(drug,`${kind} aktual`,ref);if(!t)continue;
      const subject=`${kind} aktual ${drug} terhadap ${label}: `,spread=`${t.aboveCount} di atas dan ${t.belowCount} di bawah rentang dari ${t.n} pasien`;
      if(t.n<3)add(subject+`n=${t.n}, uji tidak dilakukan (minimal 3 pasien).`);
      else if(t.pValue===null)add(subject+`semua ${t.n} pasien di dalam rentang; uji tidak diperlukan.`);
      else if(t.pValue<0.05)add(subject+`penyimpangan cenderung ${t.meanDifference>0?"di atas":t.meanDifference<0?"di bawah":"-"} rentang (${t.method}, p=${t.pValue<0.0001?"<0.0001":pythonFixed(t.pValue,4)}); ${spread}; median penyimpangan pada pasien di luar rentang ${signed(t.medianDifference??0)} ${unit}.`,"penting");
      else add(subject+`tidak ada kecenderungan arah yang bermakna (p=${pythonFixed(t.pValue,4)}); ${spread}.`);
    }
  }
  sections.push({title:"2. Arah Penyimpangan terhadap Rentang Rujukan",paragraphs:p});p=[];
  for(const kind of ["Dosis","Frekuensi"] as const)for(const calc of ["aktual","manual"] as const){const m=stats.mcnemar.find(t=>t.group==="Keseluruhan"&&t.metric===`${kind} ${calc}`);if(!m||m.n===0)continue;
    const text=`${kind} ${calc}: ${m.rsOnly} pasien Sesuai hanya terhadap Pedoman RS, ${m.literatureOnly} Sesuai hanya terhadap Literatur Terkini (dari ${m.n} pasien). `;
    if(m.pValue===null)add(text+"Uji tidak diperlukan karena tidak ada pasien yang hasilnya berbeda.");
    else add(text+`${m.method==="McNemar exact"?"McNemar eksak (binomial)":"McNemar khi-kuadrat (koreksi kontinuitas)"}, p=${pythonFixed(m.pValue,4)}: ${m.pValue<0.05?"proporsi Sesuai berbeda bermakna":"tidak berbeda bermakna"}.`,m.pValue<0.05?"penting":"poin");
  }
  if(p.length){add("Pedoman RS berupa rentang (kecuali amikasin), sedangkan Literatur Terkini berupa nilai tunggal. Perbedaan proporsi Sesuai antara kedua rujukan sebagian mencerminkan bentuk rujukan ini, bukan hanya mutu pemberian.","penting");sections.push({title:"3. Perbandingan Pedoman RS dan Literatur Terkini (McNemar)",paragraphs:p});}p=[];
  if(!dist("_kma_rs").n)add("Tidak ada data hitung manual.");else{
    for(const [kind,rs,lit] of [["Dosis","_kma_rs","_kma_lit"],["Frekuensi","_kmf_rs","_kmf_lit"]])for(const [ref,key] of [["Pedoman RS",rs],["Literatur Terkini",lit]]){const d=dist(key);if(d.n)add(`${kind} hitung manual terhadap ${ref} (hasil aplikasi): ${d.s}/${d.n} Sesuai (${pct(d.s,d.n)}), ${d.b} Berlebih, ${d.k} Kurang.`);}
    for(const kind of ["Dosis","Frekuensi"] as const)for(const drug of drugs){const t=test(drug,`${kind} manual`,"Pedoman Rumah Sakit");if(t&&t.n>=3&&t.pValue!==null)add(`${kind} hitung manual ${drug} terhadap Pedoman RS: ${t.pValue<0.05?`penyimpangan cenderung ${t.meanDifference>0?"di atas":"di bawah"} rentang`:"tidak ada kecenderungan arah yang bermakna"} (${t.method}, p=${pythonFixed(t.pValue,4)}).`,t.pValue<0.05?"penting":"poin");}
    add("Aplikasi memakai berat badan apa adanya tanpa pembulatan dan tanpa toleransi; selisih karena pembulatan pada hitung manual tetap dihitung Berlebih atau Kurang. Uji per antibiotik memerlukan minimal 3 pasien dengan hitung manual.");
  }
  sections.push({title:"4. Hitung Manual dibandingkan Perhitungan Aplikasi",paragraphs:p});p=[];
  for(const [kind,rs,lit] of [["Dosis","_ka_rs","_ka_lit"],["Frekuensi","_kfa_rs","_kfa_lit"]]){const a=dist(rs),b=dist(lit);if(a.n||b.n)add(`${kind} aktual Sesuai: ${a.s}/${a.n} (${pct(a.s,a.n)}) terhadap Pedoman RS dan ${b.s}/${b.n} (${pct(b.s,b.n)}) terhadap Literatur Terkini.`);}
  add("TINDAK LANJUT: telaah pemberian berkategori Berlebih (risiko toksisitas) dan Kurang (risiko kadar di bawah target) bersama DPJP, dan konfirmasi dengan kadar obat dalam darah (TDM) bila tersedia.","penting");
  sections.push({title:"5. Kesimpulan dan Tindak Lanjut",paragraphs:p});p=[];
  for(const text of [
    "Pedoman RS: PPK Sepsis Neonatal RSUP Dr. M. Djamil (2017) dan PNPK Sepsis pada Anak (Kemenkes RI, 2021) untuk gentamisin dan amikasin; UNC Medical Center (2023) untuk vankomisin. Kriteria kesesuaian ditetapkan tim peneliti berdasarkan rujukan tersebut. Literatur Terkini: ANMF (gentamisin v4.0, amikasin v3.0, vankomisin intermiten v3.0; 2024).",
    "Pedoman RS berupa rentang (kecuali amikasin: 15 mg/kg tiap 24 jam), sedangkan Literatur Terkini berupa nilai tunggal, sehingga proporsi Sesuai terhadap Literatur Terkini secara struktural cenderung lebih kecil.",
    "Bila kreatinin serum tidak diisi, fungsi ginjal diasumsikan normal sesuai usia (keputusan tim peneliti). Pasien dengan gangguan ginjal yang tidak tercatat dapat dinilai keliru.",
    "Uji per antibiotik memerlukan minimal 3 pasien (batas minimal uji Shapiro-Wilk). Banyak uji dijalankan sekaligus tanpa koreksi uji berganda, sehingga nilai p bersifat eksploratif.",
    "Nilai p menunjukkan kemaknaan statistik, bukan kemaknaan klinis.",
    "Alat ini adalah alat bantu keputusan klinis (clinical decision support), bukan pengganti penilaian apoteker klinis dan DPJP.",
  ])add(text);
  sections.push({title:"6. Catatan Metodologis dan Keterbatasan",paragraphs:p});
  return sections.map(s=>({...s,paragraphs:s.paragraphs.map(p=>({...p,text:p.text.replace(/(?<=\d)\.(?=\d)/g,",").replace(/v(\d),(\d)/g,"v$1.$2").replaceAll(" & "," dan ")}))}));
}
