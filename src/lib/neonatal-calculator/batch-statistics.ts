import { notebookBatchRecord } from "./notebook-results";
import type { Antibiotic } from "./types";
import type { BatchProcessingResult, BatchSuccessRow } from "./batch-engine";

export type ComparisonMetric = "Dosis aktual" | "Dosis manual" | "Frekuensi aktual" | "Frekuensi manual";
export type ReferenceName = "Pedoman Rumah Sakit" | "Literatur Terkini";
export type PairedStatistic = {
  group: string; metric: ComparisonMetric; reference: ReferenceName; n: number;
  shapiroW: number | null; shapiroP: number | null;
  method: "paired t-test" | "Wilcoxon signed-rank" | "Tidak diuji";
  statistic: number | null; pValue: number | null; note: string;
};
export type McNemarStatistic = {
  group: string; metric: "Dosis aktual" | "Frekuensi aktual" | "Dosis manual" | "Frekuensi manual";
  n: number; rsOnly: number; literatureOnly: number; both: number; neither: number;
  method: "McNemar exact" | "McNemar chi-square koreksi kontinuitas" | "Tidak diuji";
  statistic: number | null; pValue: number | null; note: string;
};
export type StatusCount = { group: string; metric: string; reference: ReferenceName; category: string; count: number; total: number; percent: number };

const clamp = (x: number) => Math.max(0, Math.min(1, x));
function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return clamp(0.5 * (1 + (z < 0 ? -erf : erf)));
}
function normalInv(p: number): number {
  // Acklam's rational approximation, absolute error < 2e-4.
  const a = [-39.69683028665376,220.9460984245205,-275.9285104469687,138.357751867269,-30.66479806614716,2.506628277459239];
  const b = [-54.47609879822406,161.5858368580409,-155.6989798598866,66.80131188771972,-13.28068155288572];
  const c = [-0.007784894002430293,-0.3223964580411365,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783];
  const d = [0.007784695709041462,0.3224671290700398,2.445134137142996,3.754408661907416];
  const t = p < 0.02425 ? Math.sqrt(-2 * Math.log(p)) : p > 0.97575 ? Math.sqrt(-2 * Math.log(1-p)) : 0;
  const tail = (((((c[0]*t+c[1])*t+c[2])*t+c[3])*t+c[4])*t+c[5]) / ((((d[0]*t+d[1])*t+d[2])*t+d[3])*t+1);
  if (p < 0.02425) return tail;
  if (p > 0.97575) return -tail;
  const q=p-0.5, r=q*q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
    (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}
function polynomial(coeff: number[], x: number): number {
  return coeff.reduceRight((sum, value) => sum * x + value, 0);
}
export function shapiroWilk(values: number[]): { w: number; p: number } | null {
  // Royston/AS R94 small-sample weights and tail approximation; only 3 <= n <= 5000.
  const x = values.filter(Number.isFinite).sort((a,b)=>a-b);
  const n = x.length;
  if (n < 3 || n > 5000 || x[0] === x[n-1]) return null;
  const mean = x.reduce((a,b)=>a+b,0) / n;
  const ss = x.reduce((a,b)=>a+(b-mean)**2,0);
  if (ss <= 0) return null;
  if (n === 3) {
    const w = clamp((x[2]-x[0])**2/(2*ss));
    return { w, p: clamp(6/Math.PI*(Math.asin(Math.sqrt(w))-Math.PI/3)) };
  }
  const m = Array.from({length:n},(_,i)=>normalInv((i+1-0.375)/(n+0.25)));
  const summ2 = m.reduce((a,b)=>a+b*b,0);
  const rsn = 1/Math.sqrt(n);
  const a1 = -m[0]/Math.sqrt(summ2) + polynomial([0,0.221157,-0.147981,-2.071190,4.434685,-2.706056],rsn);
  const a2 = n > 5 ? -m[1]/Math.sqrt(summ2) + polynomial([0,0.042981,-0.293762,-1.752461,5.682633,-3.582633],rsn) : 0;
  const numerator = summ2 - 2*m[0]**2 - (n>5 ? 2*m[1]**2 : 0);
  const denominator = 1 - 2*a1**2 - (n>5 ? 2*a2**2 : 0);
  if (numerator <= 0 || denominator <= 0) return null;
  const scale = Math.sqrt(denominator/numerator);
  const coeff = m.map((v,i)=>i===0?-a1 : i===n-1?a1 : n>5 && i===1 ? -a2 : n>5 && i===n-2 ? a2 : v*scale);
  const sum = coeff.reduce((a,b,i)=>a+b*x[i],0);
  const w=clamp(sum*sum/ss);
  const lw = Math.log(Math.max(1e-15,1-w));
  let z: number;
  if(n<=11) {
    const gamma=-2.273+0.459*n;
    if(gamma<=lw) return {w,p:1e-15};
    const y=-Math.log(gamma-lw);
    const mu=0.5440-0.39978*n+0.025054*n*n-0.0006714*n*n*n;
    const sigma=Math.exp(1.3822-0.77857*n+0.062767*n*n-0.0020322*n*n*n);
    z=(y-mu)/sigma;
  } else {
    const l=Math.log(n), y=lw;
    const mu=-1.5861-0.31082*l-0.083751*l*l+0.0038915*l*l*l;
    const sigma=Math.exp(-0.4803-0.082676*l+0.0030302*l*l);
    z=(y-mu)/sigma;
  }
  return {w,p:clamp(1-normalCdf(z))};
}
function logGamma(z: number): number {
  const p=[0.9999999999998099,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.6150291621406,12.507343278686905,-0.13857109526572012,9.984369578019572e-6,1.5056327351493116e-7];
  if(z<0.5) return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);
  z-=1; let x=p[0];for(let i=1;i<p.length;i++)x+=p[i]/(z+i);
  const t=z+7.5;return 0.5*Math.log(2*Math.PI)+(z+0.5)*Math.log(t)-t+Math.log(x);
}
function betaContinuedFraction(a:number,b:number,x:number):number{
  let c=1,d=1-(a+b)*x/(a+1);if(Math.abs(d)<1e-30)d=1e-30;d=1/d;let h=d;
  for(let m=1;m<=250;m++){
    const m2=2*m, aa=m*(b-m)*x/((a+m2-1)*(a+m2));
    d=1+aa*d;if(Math.abs(d)<1e-30)d=1e-30;c=1+aa/c;if(Math.abs(c)<1e-30)c=1e-30;d=1/d;h*=d*c;
    const bb=-(a+m)*(a+b+m)*x/((a+m2)*(a+m2+1));
    d=1+bb*d;if(Math.abs(d)<1e-30)d=1e-30;c=1+bb/c;if(Math.abs(c)<1e-30)c=1e-30;d=1/d;const delta=d*c;h*=delta;if(Math.abs(delta-1)<3e-13)break;
  }return h;
}
function betaI(x:number,a:number,b:number):number{
  if(x<=0)return 0;if(x>=1)return 1;
  const scale=Math.exp(logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log(1-x));
  return clamp(x < (a+1)/(a+b+2) ? scale*betaContinuedFraction(a,b,x)/a : 1-scale*betaContinuedFraction(b,a,1-x)/b);
}
function pairedTest(diffs:number[]):{method:PairedStatistic["method"];statistic:number|null;p:number|null;shapiroW:number|null;shapiroP:number|null;note:string}{
  const n=diffs.length;
  if(n<3)return {method:"Tidak diuji",statistic:null,p:null,shapiroW:null,shapiroP:null,note:"n < 3"};
  const sh=shapiroWilk(diffs);
  if (diffs.every(v => Math.abs(v) <= 1e-8)) return {method:"Tidak diuji",statistic:null,p:1,shapiroW:null,shapiroP:null,note:"Seluruh selisih nol"};
  if (!sh) return {method:"paired t-test",statistic:null,p:0,shapiroW:null,shapiroP:1,note:"Selisih konstan bukan nol; statistik tak hingga"};
  if(sh.p>0.05){
    const mean=diffs.reduce((a,b)=>a+b,0)/n;
    const sd=Math.sqrt(diffs.reduce((a,b)=>a+(b-mean)**2,0)/(n-1));
    if(sd<=1e-12)return {method:"Tidak diuji",statistic:null,p:null,shapiroW:sh.w,shapiroP:sh.p,note:"Tidak ada variansi selisih"};
    const t=mean/(sd/Math.sqrt(n));
    const p=betaI((n-1)/((n-1)+t*t),(n-1)/2,0.5);
    return {method:"paired t-test",statistic:t,p,shapiroW:sh.w,shapiroP:sh.p,note:"Uji dua sisi, alfa 0,05"};
  }
  const nonzero=diffs.filter(v=>v!==0);
  if(nonzero.length===0)return {method:"Tidak diuji",statistic:null,p:null,shapiroW:sh.w,shapiroP:sh.p,note:"Seluruh selisih nol"};
  const ranked=nonzero.map(v=>({v,abs:Math.abs(v),rank:0})).sort((a,b)=>a.abs-b.abs);
  let ties=0;for(let i=0;i<ranked.length;){let j=i+1;while(j<ranked.length && ranked[j].abs===ranked[i].abs)j++;const rank=(i+1+j)/2;for(let k=i;k<j;k++)ranked[k].rank=rank;ties+=(j-i)**3-(j-i);i=j;}
  const wp=ranked.reduce((a,r)=>a+(r.v>0?r.rank:0),0),wn=ranked.reduce((a,r)=>a+(r.v<0?r.rank:0),0);
  const m=ranked.length;let p:number;
  if ((n<=50 && ties===0 && m===n) || n<=13) {
    // DP over twice the average ranks handles ties; zeros leave sign probabilities unchanged.
    const scaled=ranked.map(r=>Math.round(r.rank*2)), max=scaled.reduce((a,b)=>a+b,0);
    const counts=Array<number>(max+1).fill(0); counts[0]=1;
    for(const rank of scaled) for(let sum=max;sum>=rank;sum--) counts[sum]+=counts[sum-rank];
    const observed=Math.round(wp*2);
    const low=counts.slice(0,observed+1).reduce((a,b)=>a+b,0);
    const high=counts.slice(observed).reduce((a,b)=>a+b,0);
    p=clamp(2*Math.min(low,high)/(2**m));
  }else{
    const mu=m*(m+1)/4;
    const variance=m*(m+1)*(2*m+1)/24-ties/48;
    p=variance<=0?1:clamp(2*(1-normalCdf((Math.abs(wp-mu))/Math.sqrt(variance))));
  }
  return {method:"Wilcoxon signed-rank",statistic:Math.min(wp,wn),p,shapiroW:sh.w,shapiroP:sh.p,note:"Uji dua sisi; 0 selisih dikeluarkan; auto SciPy: exact tanpa ties sampai n=50; permutasi ties/zero sampai n=13"};
}
function status(record:ReturnType<typeof notebookBatchRecord>,reference:ReferenceName,metric:ComparisonMetric):string|null {
  const key = (metric.startsWith("Dosis") ? metric.endsWith("aktual") ? "_ka_" : "_kma_" : metric.endsWith("aktual") ? "_kfa_" : "_kmf_") + (reference === "Pedoman Rumah Sakit" ? "rs" : "lit");
  const value = record[key];
  return typeof value === "string" && value ? value.toLowerCase() : null;
}
const refs:ReferenceName[]=["Pedoman Rumah Sakit","Literatur Terkini"];
const metrics:ComparisonMetric[]=["Dosis aktual","Frekuensi aktual","Dosis manual","Frekuensi manual"];
export function summarizeBatch(result:BatchProcessingResult):{counts:StatusCount[];paired:PairedStatistic[];mcnemar:McNemarStatistic[]} {
  const success=result.rows.filter((r):r is BatchSuccessRow=>r.status==="berhasil");
  const records = new Map(success.map(row => [row,notebookBatchRecord(row)]));
  const groups:Array<{name:string;rows:BatchSuccessRow[]}>= [{name:"Keseluruhan",rows:success},...(["gentamisin","amikasin","vankomisin"] as Antibiotic[]).map(a=>({name:a,rows:success.filter(r=>r.calculator.input.antibiotic===a)}))];
  const counts:StatusCount[]=[],paired:PairedStatistic[]=[],mcnemar:McNemarStatistic[]=[];
  for(const group of groups){
    for(const metric of metrics){
      for(const reference of refs){
        const statuses=group.rows.map(r=>status(records.get(r)!,reference,metric)).filter((s):s is string=>s!==null&&s!=="tidak-dapat-dievaluasi");
        for(const category of ["sesuai","berlebih","kurang","opsi-diskrit-tidak-cocok"]){
          const count=statuses.filter(s=>s===category).length;
          counts.push({group:group.name,metric,reference,category,count,total:statuses.length,percent:statuses.length?100*count/statuses.length:0});
        }
        const diffs=group.rows.map(r=>{
          const record=records.get(r)!;
          const actualKey=metric==="Dosis aktual"?"_da_perkg":metric==="Dosis manual"?"_dm_mid_perkg":metric==="Frekuensi aktual"?"_fa_perhari":"_fm_mid_perhari";
          const refKey=metric.startsWith("Dosis")?(reference==="Pedoman Rumah Sakit"?"_rs_mid_perkg":"_lit_mid_perkg"):(reference==="Pedoman Rumah Sakit"?"_rs_freq_mid":"_lit_freq_mid");
          const actual=record[actualKey], compare=record[refKey];
          return typeof actual==="number" && typeof compare==="number" ? actual-compare : null;
        }).filter((v):v is number=>v!==null&&Number.isFinite(v));
        const test=pairedTest(diffs);
        paired.push({group:group.name,metric,reference,n:diffs.length,shapiroW:test.shapiroW,shapiroP:test.shapiroP,method:test.method,statistic:test.statistic,pValue:test.p,note:test.note});
      }
      const pairs=group.rows.map(r=>[status(records.get(r)!,refs[0],metric),status(records.get(r)!,refs[1],metric)]).filter(v=>v.every(s=>s!==null && s!=="tidak-dapat-dievaluasi"));
      const both=pairs.filter(([a,b])=>a==="sesuai"&&b==="sesuai").length;
      const rsOnly=pairs.filter(([a,b])=>a==="sesuai"&&b!=="sesuai").length;
      const literatureOnly=pairs.filter(([a,b])=>a!=="sesuai"&&b==="sesuai").length;
      const neither=pairs.filter(([a,b])=>a!=="sesuai"&&b!=="sesuai").length;
      const discordant=rsOnly+literatureOnly;
      let method:McNemarStatistic["method"]="Tidak diuji", statistic:number|null=null,pValue:number|null=pairs.length?1:null,note=pairs.length?"Tidak ada pasangan diskordan":"Tidak ada pasangan valid";
      if(discordant>0 && discordant<25){
        method="McNemar exact";statistic=Math.min(rsOnly,literatureOnly);
        let c=1,sum=1;for(let k=1;k<=Math.min(rsOnly,literatureOnly);k++){c=c*(discordant-k+1)/k;sum+=c;}
        pValue=clamp(2*sum/2**discordant);note="Uji exact binomial dua sisi";
      }else if(discordant>=25){
        method="McNemar chi-square koreksi kontinuitas";statistic=(Math.abs(rsOnly-literatureOnly)-1)**2/discordant;
        pValue=clamp(2*(1-normalCdf(Math.sqrt(statistic))));note="khi-kuadrat df=1 dengan koreksi kontinuitas";
      }
      mcnemar.push({group:group.name,metric,n:pairs.length,rsOnly,literatureOnly,both,neither,method,statistic,pValue,note});
    }
  }
  return {counts,paired,mcnemar};
}
