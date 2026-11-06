import { pythonFixed } from "./python-rounding";
import { v20ActualDoseText, v20RenalText } from "./notebook-results";
import { describeDoseReference, describeIntervalReference } from "./reference-shape-v20";
import { getDisplayV20Warnings, V20_WARNING_STYLE } from "./warning-catalog-v20";
import { getV20ReferenceEntries } from "./reference-block-v20";
import { buildActualEvaluationSummary } from "./actual-evaluation-summary";
import type { BatchProcessingResult } from "./batch-engine";
import { summarizeBatch } from "./batch-statistics";
import { ANTIBIOTIC_LABELS, CALCULATOR_RULE_VERSION, CLINICAL_DISCLAIMER, formatNumber } from ".";
import type { CalculatorResult, ClinicalWarning, DoseEvaluation, IntervalEvaluation, RegimenEvaluationResult, Recommendation } from "./types";

type BoxTone = ClinicalWarning["severity"] | "success";
type ReportLine = { text: string; color?: "red"|"orange"|"blue"|"green"; heading?: boolean; warning?: Pick<ClinicalWarning, "severity" | "title">; panelTitle?: string; panelTone?: BoxTone; evaluationSummary?: boolean; panelParagraphs?: string[] };
type ReportCell = { text: string; color?: ReportLine["color"] };
type ReportTable = { table: { title: string; columns: { text: string; width: number }[]; rows: ReportCell[][] } };
type ReportItem = ReportLine | ReportTable;
export type PdfGeneratedAtOptions = { generatedAt?: Date; timeZone?: string };
type PdfRow = { text: string; fontSize: number; bold: boolean; leading: number; gap?: number };
type PdfCell = { rows: PdfRow[]; width: number; color?: ReportLine["color"] };
type PdfBlock = { rows: PdfRow[]; height: number; color?: ReportLine["color"]; warning?: BoxTone; evaluationSummary?: boolean; cells?: PdfCell[]; tableHeader?: boolean; pageBreakBefore?: boolean };
// Standard Helvetica advance widths for printable ASCII, in 1/1000 em (Adobe font metrics).
const HELVETICA_WIDTHS = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HELVETICA_BOLD_WIDTHS = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const pdfRgb = (hex: string): string =>
  [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(value => Number(value.toFixed(4)).toString()).join(" ");
const WARNING_STYLES = {
  critical: { label: V20_WARNING_STYLE.critical.label, text: pdfRgb(V20_WARNING_STYLE.critical.color), fill: pdfRgb(V20_WARNING_STYLE.critical.background) },
  warning: { label: V20_WARNING_STYLE.warning.label, text: pdfRgb(V20_WARNING_STYLE.warning.color), fill: pdfRgb(V20_WARNING_STYLE.warning.background) },
  info: { label: V20_WARNING_STYLE.info.label, text: pdfRgb(V20_WARNING_STYLE.info.color), fill: pdfRgb(V20_WARNING_STYLE.info.background) },
  success: { label: "SESUAI", text: "0.05 0.43 0.39", fill: "0.91 0.96 0.94" },
} as const;
/** Match light-mode computed screen colors (src/app/globals.css); never use warning severity colors for dose categories. */
const PDF_SEMANTIC_RGB = {
  red: pdfRgb("#b4493f"), // text-error / Berlebih
  orange: pdfRgb("#a76f24"), // text-warning / Kurang
  blue: pdfRgb("#3f6f8f"), // text-info
  green: pdfRgb("#287344"), // text-success / Sesuai
} as const;
const EVALUATION_SUMMARY_STYLES = {
  critical: { text: PDF_SEMANTIC_RGB.red, fill: pdfRgb("#f8edec") },
  warning: { text: PDF_SEMANTIC_RGB.orange, fill: pdfRgb("#f6f0e9") },
  info: { text: PDF_SEMANTIC_RGB.blue, fill: pdfRgb("#ecf1f4") },
  success: { text: pdfRgb("#14532d"), fill: pdfRgb("#e8eeea") }, // text-primary / bg-primary/10
} as const;
const colorForCategory = (category: "Sesuai" | "Berlebih" | "Kurang" | null): ReportLine["color"] | undefined =>
  category === "Sesuai" ? "green" : category === "Berlebih" ? "red" : category === "Kurang" ? "orange" : undefined;

const clean = (value: unknown): string => String(value ?? "")
  .normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
  .replaceAll("≥", ">=").replaceAll("≤", "<=").replaceAll("−", "-")
  .replace(/[^\x20-\x7E]/g, ch => ch === "–" || ch === "—" ? "-" : " ")
  .replace(/\s+/g," ").trim();
function escapePdf(value:string): string { return clean(value).replaceAll("\\","\\\\").replaceAll("(","\\(").replaceAll(")","\\)"); }
function textWidth(text: string, fontSize: number, bold: boolean): number {
  const widths = bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
  return [...text].reduce((sum, character) => sum + (widths[character.charCodeAt(0) - 32] ?? 556), 0) * fontSize / 1000;
}
function wrapText(text: string, width: number, fontSize: number, bold = false): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of clean(text).split(" ").filter(Boolean)) {
    const candidate = current ? current + " " + word : word;
    if (textWidth(candidate, fontSize, bold) <= width) { current = candidate; continue; }
    if (current) { lines.push(current); current = ""; }
    // Split unbroken tokens as well, so a long label or identifier cannot cross the right margin.
    for (const character of word) {
      if (current && textWidth(current + character, fontSize, bold) > width) { lines.push(current); current = ""; }
      current += character;
    }
  }
  if (current) lines.push(current);
  return lines;
}
/** The PDF timestamp is the export instant in the browser's actual local time zone.
 * Explicit values allow deterministic tests, including day/month/year rollovers.
 */
export function formatPdfGeneratedAt(generatedAt: Date, timeZone: string): string {
  if (Number.isNaN(generatedAt.getTime())) throw new RangeError("Waktu pembuatan PDF tidak valid.");
  const complete = new Intl.DateTimeFormat("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    timeZone, timeZoneName: "short",
  }).format(generatedAt);
  return "Dibuat lokal: " + complete + " (" + timeZone + ")";
}
function pdfDocument(title:string,lines:ReportItem[],timestamp:PdfGeneratedAtOptions = {}):Uint8Array {
  // Small, offline PDF writer. Every file is a real PDF, not an HTML print fallback.
  // Snapshot one instant so all pages share the same timestamp, even near midnight.
  const stampedAt = formatPdfGeneratedAt(
    timestamp.generatedAt ?? new Date(),
    timestamp.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
  );
  const pageWidth=595,pageHeight=842,margin=47;
  const bodyTop = pageHeight - margin - 28, capacity = bodyTop - margin, contentWidth = pageWidth - 2 * margin;
  const padding = 10, afterBox = 8;
  const blocks: PdfBlock[] = [];
  let layoutCursor = 0;
  const appendBlock = (block: PdfBlock, newPage = false) => {
    if (newPage || layoutCursor + block.height > capacity) { layoutCursor = 0; block.pageBreakBefore = true; }
    blocks.push(block); layoutCursor += block.height;
  };
  for(const line of lines){
    if ("table" in line) {
      const table = line.table, cellPadding = 8, leading = 13, fontSize = 9.5;
      const makeCells = (values: ReportCell[], bold: boolean): PdfCell[] => table.columns.map((column, index) => ({
        width: column.width, color: values[index]?.color,
        rows: wrapText(values[index]?.text ?? "", column.width - 2 * cellPadding, fontSize, bold)
          .map(text => ({ text, fontSize, bold, leading })),
      }));
      const header = makeCells(table.columns.map(column => ({ text: column.text })), true);
      const headerHeight = Math.max(1, ...header.map(cell => cell.rows.length)) * leading + 2 * cellPadding;
      const titleHeight = 24;
      const startTable = (minimumBodyHeight: number, continued: boolean) => {
        appendBlock({ rows: [{ text: table.title + (continued ? " (lanjutan)" : ""), fontSize: 11, bold: true, leading: titleHeight }], height: titleHeight },
          layoutCursor + titleHeight + headerHeight + minimumBodyHeight > capacity);
        appendBlock({ rows: [], cells: header, tableHeader: true, height: headerHeight });
      };
      let started = false;
      for (const values of table.rows) {
        const cells = makeCells(values, false);
        const rowCount = Math.max(1, ...cells.map(cell => cell.rows.length));
        const maxRowLines = Math.floor((capacity - titleHeight - headerHeight - 2 * cellPadding) / leading);
        const oversized = rowCount > maxRowLines;
        let offset = 0;
        while (offset < rowCount) {
          const minimumLines = oversized ? 1 : rowCount;
          const minimumHeight = minimumLines * leading + 2 * cellPadding;
          if (!started || layoutCursor + minimumHeight > capacity) {
            startTable(minimumHeight, started); started = true;
          }
          const count = Math.min(rowCount - offset, Math.floor((capacity - layoutCursor - 2 * cellPadding) / leading));
          appendBlock({ rows: [], cells: cells.map(cell => ({ ...cell, rows: cell.rows.slice(offset, offset + count) })), height: count * leading + 2 * cellPadding });
          offset += count;
        }
      }
      if (capacity - layoutCursor >= 8) appendBlock({ rows: [], height: 8 });
    } else if (line.warning || line.panelTitle) {
      const severity = line.warning?.severity ?? line.panelTone ?? "info", warningTitle = line.warning?.title ?? line.panelTitle;
      const label = line.warning ? WARNING_STYLES[severity].label : "";
      const heading = line.warning ? label + ":" + (warningTitle ? " " + warningTitle + (/[.!?]$/.test(warningTitle) ? "" : ".") : "") : warningTitle!;
      // Some screen warnings repeat their title as the first sentence of the message.
      const body = warningTitle && line.text.startsWith(warningTitle + ". ")
        ? line.text.slice(warningTitle.length + 2) : line.text;
      const headingRows = wrapText(heading, contentWidth - 2 * padding, 10, true).map(text => ({ text, fontSize: 10, bold: true, leading: 14 }));
      const rows: PdfRow[] = [
        ...headingRows,
        ...(line.panelParagraphs ?? [body]).flatMap(paragraph => wrapText(paragraph, contentWidth - 2 * padding, 9.5)
          .map((text, index) => ({ text, fontSize: 9.5, bold: false, leading: 14, gap: index === 0 ? 4 : 0 }))),
      ];
      const oversized = 2 * padding + afterBox + rows.reduce((sum, row) => sum + row.leading + (row.gap ?? 0), 0) > capacity;
      let offset = 0;
      while (offset < rows.length) {
        const part: PdfRow[] = offset === 0 ? [] : [{ text: (label || warningTitle) + ": (lanjutan)", fontSize: 10, bold: true, leading: 14 }];
        let height = 2 * padding + afterBox + part.reduce((sum, row) => sum + row.leading, 0);
        const minimumRows = offset === 0 ? Math.min(rows.length, headingRows.length + 1) : 1;
        const minimumHeight = height + rows.slice(offset, offset + minimumRows).reduce((sum, row) => sum + row.leading + (row.gap ?? 0), 0);
        const remaining = capacity - layoutCursor;
        const limit = oversized && remaining >= minimumHeight ? remaining : capacity;
        while (offset < rows.length) {
          const row = rows[offset], nextHeight = row.leading + (row.gap ?? 0);
          if (height + nextHeight > limit) break;
          part.push(row); height += nextHeight; offset++;
        }
        appendBlock({ rows: part, height, warning: severity, evaluationSummary: line.evaluationSummary });
      }
    } else {
      const fontSize = line.heading ? 12 : 9.5, leading = line.heading ? 24 : 16;
      const wrapped = wrapText(line.text, contentWidth, fontSize);
      const maxRows = Math.floor(capacity / leading);
      // Keep short paragraphs intact, including the clinical disclaimer at the end.
      for (let offset = 0; offset < wrapped.length; offset += maxRows) {
        const rows = wrapped.slice(offset, offset + maxRows).map(text => ({ text, fontSize, bold: false, leading }));
        appendBlock({ rows, height: rows.length * leading, color: line.color });
      }
    }
  }
  const pages: PdfBlock[][] = [];
  let current: PdfBlock[] = [], cursor = 0;
  for (const block of blocks) {
    if (current.length && (block.pageBreakBefore || cursor + block.height > capacity)) { pages.push(current); current = []; cursor = 0; }
    current.push(block); cursor += block.height;
  }
  if(current.length||!pages.length)pages.push(current);
  const encoder=new TextEncoder(),objects:string[]=[];
  const add=(s:string)=>{objects.push(s);return objects.length;};
  const catalog=add(""),pageTree=add(""),font=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),boldFont=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const kids:number[]=[];
  const colors = PDF_SEMANTIC_RGB;
  for(let p=0;p<pages.length;p++){
    let y=pageHeight-margin;
    const items=[
      "q", "0.05 0.43 0.39 rg", "0 "+(pageHeight-12)+" "+pageWidth+" 12 re f","Q",
      "BT","/F1 15 Tf","0.08 0.2 0.25 rg",margin+" "+y+" Td","("+escapePdf(title)+") Tj","ET",
      "BT","/F1 8.5 Tf","0.4 0.4 0.4 rg",margin+" "+(y-19)+" Td","("+escapePdf(stampedAt)+") Tj","ET"
    ];
    y=bodyTop;
    for(const block of pages[p]){
      if (block.cells) {
        let cellX = margin;
        for (const cell of block.cells) {
          const fill = block.tableHeader ? "0.91 0.95 0.94" : "1 1 1";
          items.push("q", fill + " rg", "0.72 0.79 0.79 RG", "0.5 w", `${cellX} ${y - block.height} ${cell.width} ${block.height} re B`, "Q");
          let cellTop = y - 8;
          for (const row of cell.rows) {
            const baseline = cellTop - row.fontSize, left = cellX + 8;
            const prefix = cell.color && /^(Sesuai|Berlebih|Kurang)(?=$|[\s(:;,])/.exec(row.text)?.[1];
            if (prefix) {
              // The screen colors only the semantic category; details retain normal text.
              const rest = row.text.slice(prefix.length);
              items.push("BT", `/F1 ${row.fontSize} Tf`, colors[cell.color!] + " rg", `${left} ${baseline} Td`, "(" + escapePdf(prefix) + ") Tj", "ET");
              if (rest) items.push("BT", `/F1 ${row.fontSize} Tf`, "0.12 0.18 0.2 rg", `${left + textWidth(prefix, row.fontSize, false)} ${baseline} Td`, "(" + escapePdf(rest) + ") Tj", "ET");
            } else {
              items.push("BT", `/${row.bold ? "F2" : "F1"} ${row.fontSize} Tf`, "0.12 0.18 0.2 rg", `${left} ${baseline} Td`, "(" + escapePdf(row.text) + ") Tj", "ET");
            }
            cellTop -= row.leading;
          }
          cellX += cell.width;
        }
        y -= block.height;
        continue;
      }
      let top = y;
      let color = block.color ? colors[block.color] : "0.12 0.18 0.2";
      let x = margin;
      if (block.warning) {
        const style = block.evaluationSummary ? EVALUATION_SUMMARY_STYLES[block.warning] : WARNING_STYLES[block.warning], boxHeight = block.height - afterBox;
        items.push("q", style.fill + " rg", style.text + " RG", "0.7 w", `${margin} ${y - boxHeight} ${contentWidth} ${boxHeight} re B`, "Q");
        top -= padding; x += padding; color = style.text;
      }
      for (const row of block.rows) {
        top -= row.gap ?? 0;
        items.push("BT", `/${row.bold ? "F2" : "F1"} ${row.fontSize} Tf`, color + " rg", `${x} ${top - row.fontSize} Td`, "("+escapePdf(row.text)+") Tj", "ET");
        top -= row.leading;
      }
      y -= block.height;
    }
    items.push("BT","/F1 8 Tf","0.4 0.4 0.4 rg",margin+" 27 Td","("+escapePdf("PustakaObat.id - Halaman "+(p+1)+"/"+pages.length)+") Tj","ET");
    const stream=items.join("\n")+"\n";
    const length=encoder.encode(stream).length;
    const streamRef=add("<< /Length "+length+" >>\nstream\n"+stream+"endstream");
    const page=add("<< /Type /Page /Parent "+pageTree+" 0 R /MediaBox [0 0 "+pageWidth+" "+pageHeight+"] /Resources << /Font << /F1 "+font+" 0 R /F2 "+boldFont+" 0 R >> >> /Contents "+streamRef+" 0 R >>");
    kids.push(page);
  }
  objects[catalog-1]="<< /Type /Catalog /Pages "+pageTree+" 0 R >>";
  objects[pageTree-1]="<< /Type /Pages /Kids ["+kids.map(i=>i+" 0 R").join(" ")+"] /Count "+kids.length+" >>";
  let doc="%PDF-1.4\n";const offsets=[0];
  for(let i=0;i<objects.length;i++){offsets.push(encoder.encode(doc).length);doc+=(i+1)+" 0 obj\n"+objects[i]+"\nendobj\n";}
  const start=encoder.encode(doc).length;
  doc+="xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n";
  for(const off of offsets.slice(1))doc+=String(off).padStart(10,"0")+" 00000 n \n";
  doc+="trailer\n<< /Size "+(objects.length+1)+" /Root "+catalog+" 0 R >>\nstartxref\n"+start+"\n%%EOF";
  return encoder.encode(doc);
}
function doseText(rec:Recommendation): string {
  const dose=rec.dose.minTotalMg===rec.dose.maxTotalMg?formatNumber(rec.dose.minTotalMg??0):formatNumber(rec.dose.minTotalMg??0)+"-"+formatNumber(rec.dose.maxTotalMg??0);
  return dose + " mg";
}
/** PDF-only annotation: use the already calculated per-kg values, never recalculate the regimen. */
function doseWithMgKgText(rec:Recommendation): string {
  const { minMgPerKg, maxMgPerKg } = rec.dose;
  if (minMgPerKg === null || maxMgPerKg === null) return doseText(rec);
  const perKg = minMgPerKg === maxMgPerKg
    ? formatNumber(minMgPerKg)
    : formatNumber(minMgPerKg) + "-" + formatNumber(maxMgPerKg);
  return doseText(rec) + " (" + perKg + " mg/kg per pemberian)";
}
function intervalText(rec:Recommendation): string {
  return rec.interval.kind==="single"?"tiap "+rec.interval.hours+" jam":rec.interval.kind==="continuous-range"?"tiap "+rec.interval.minHours+"-"+rec.interval.maxHours+" jam":rec.interval.kind==="single-dose-only"?"Dosis tunggal (bukan rutin)":rec.interval.allowedHours.map(n=>"tiap "+n+" jam").join(" atau ");
}
const recommendationColumns = [
  { text: "Parameter", width: 111 },
  { text: "Pedoman Rumah Sakit", width: 195 },
  { text: "Literatur Terkini (ANMF 2024)", width: 195 },
];
function recommendationTable(calculated: CalculatorResult): ReportTable {
  const refs = [calculated.recommendations.institutionalPrimary, calculated.recommendations.anmf2024];
  const row = (label: string, value: (rec: Recommendation) => string): ReportCell[] => [{ text: label }, ...refs.map(rec => ({ text: value(rec) }))];
  return { table: { title: "Rekomendasi dosis", columns: recommendationColumns, rows: [
    row("Dosis per pemberian", rec => {
      const note = describeDoseReference(rec.dose);
      return doseWithMgKgText(rec) + ". " + note.label + ". " + note.description;
    }),
    row("Frekuensi pemberian", rec => {
      const note = describeIntervalReference(rec.interval, rec.eligibleForRegimenEvaluation);
      return intervalText(rec) + ". " + note.label + ". " + note.description;
    }),
    row("Sumber rujukan", rec => rec.provenanceDetail.replace("yang dirujuk notebook", "yang digunakan sebagai rujukan perhitungan")), row("Catatan", rec => rec.notes.join(" ") || "-"),
  ] } };
}
function referencePanel(calculated: CalculatorResult): ReportLine {
  return {
    panelTitle: "Rujukan",
    panelTone: "info",
    text: "",
    panelParagraphs: getV20ReferenceEntries(calculated.input.antibiotic)
      .map(entry => entry.label + ": " + entry.text),
  };
}
function patientLines(calculated:CalculatorResult, actualSummary?:ReportLine):ReportLine[]{
  const p=calculated.input;
  const warnings = getDisplayV20Warnings(calculated);
  return [
    {text:"Kode pasien: "+(p.patientLabel??"Tanpa kode")},
    {text:"Antibiotik: "+ANTIBIOTIC_LABELS[p.antibiotic]+"; Usia gestasi: "+p.gestationalAgeWeeks+" minggu "+(p.gestationalAgeDays??0)+" hari"},
    {text:"Usia pascalahir: "+p.postnatalAgeDays+" hari; PMA: "+(p.gestationalAgeWeeks+Math.floor(((p.gestationalAgeDays??0)+p.postnatalAgeDays)/7))+" minggu "+(((p.gestationalAgeDays??0)+p.postnatalAgeDays)%7)+" hari; Berat: "+formatNumber(p.currentWeightKg)+" kg"},
    {text:"Konteks klinis: "+([p.therapeuticHypothermia && "Hipotermia terapeutik/HIE", p.coxInhibitorTherapy && "COX inhibitor", p.severeSepsisOrHighRiskInfection && "Sepsis berat/infeksi risiko tinggi"].filter(Boolean).join("; ") || "Tidak ada kondisi klinis tambahan yang dipilih")},
    {text:"Fungsi ginjal: "+v20RenalText(calculated)},
    ...(actualSummary ? [actualSummary] : []),
    ...warnings.map(warning => ({ text: warning.message, warning }))
  ];
}
const footer:ReportLine[]=[{text:"Versi aturan: "+CALCULATOR_RULE_VERSION},{text:CLINICAL_DISCLAIMER},{text:"PERINGATAN: Belum diverifikasi secara klinis dan belum sesuai untuk keputusan terapi tanpa pemeriksaan profesional.",color:"red"}];
// Presentation definitions follow the v19 notebook's SINGKATAN list and the workbook glossary.
const PDF_ABBREVIATIONS = [
  ["RS", "Rumah Sakit"], ["RSUP", "Rumah Sakit Umum Pusat"],
  ["PPK", "Panduan Praktik Klinik"], ["PNPK", "Pedoman Nasional Pelayanan Kedokteran"],
  ["ANMF", "Australasian Neonatal Medicines Formulary"], ["UNC", "University of North Carolina Medical Center"],
  ["GA", "usia gestasi"], ["PNA", "usia pascalahir"],
  ["PMA", "usia pascamenstruasi (usia gestasi saat lahir + usia pascalahir)"],
  ["SCr", "kreatinin serum"], ["UOP", "produksi urin"],
  ["HIE", "ensefalopati hipoksik-iskemik"], ["COX", "siklooksigenase"],
  ["TDM", "pemantauan kadar obat dalam darah"], ["DPJP", "dokter penanggung jawab pasien"],
  ["Kemenkes", "Kementerian Kesehatan"], ["RI", "Republik Indonesia"],
] as const;
function withGlossary(lines: ReportItem[], patientReport = true): ReportItem[] {
  const fullText = [...lines, ...footer].map(line => "table" in line
    ? [line.table.title, ...line.table.columns.map(column => column.text), ...line.table.rows.flat().map(cell => cell.text)].join(" ")
    : line.text + " " + (line.warning?.title ?? "") + " " + (line.panelParagraphs?.join(" ") ?? "")).join(" ");
  const entries = PDF_ABBREVIATIONS.filter(([abbreviation]) => new RegExp(`\\b${abbreviation}\\b`).test(fullText));
  const intervalCodes = [...new Set([...fullText.matchAll(/\bq(\d+)h\b/g)].map(match => match[0] + " = tiap " + match[1] + " jam"))];
  const glossary = [...entries.map(([abbreviation, meaning]) => abbreviation + " = " + meaning), ...intervalCodes].join("; ");
  const intervalNote = "Frekuensi ditulis sebagai 'tiap X jam' (interval antardosis).";
  return [...lines, ...(glossary ? [{ panelTitle: "Keterangan singkatan", text: glossary + "." + (patientReport ? " " + intervalNote : "") }] : []), ...footer];
}
function resultMessage(message: string): string {
  const text = message.trim();
  if (!text || text === "-") return "Tidak dapat dievaluasi";
  return (text[0].toUpperCase() + text.slice(1)).replace(/\bMin:/g, "Minimum:").replace(/\bMaks:/g, "Maksimum:");
}
function unevaluableMessage(message: string): string {
  const text = resultMessage(message);
  return text.startsWith("Tidak dapat dievaluasi") ? text : "Tidak dapat dievaluasi. " + text;
}
function doseEvaluationText(result: DoseEvaluation): string {
  return result.status === "tidak-dapat-dievaluasi" ? unevaluableMessage(result.message) : resultMessage(result.message);
}
function intervalEvaluationText(result: IntervalEvaluation, rec: Recommendation, actualHours: number | null): string {
  if (result.status === "tidak-dapat-dievaluasi") return unevaluableMessage(result.message);
  if (result.status === "opsi-diskrit-tidak-cocok")
    return "Tidak sesuai opsi interval. Interval aktual: " + (actualHours === null ? "tidak tersedia" : "tiap " + actualHours + " jam") + "; opsi rujukan: " + intervalText(rec) + ".";
  return resultMessage(result.message);
}
function categoryLabel(category: string): string {
  return category === "opsi-diskrit-tidak-cocok" ? "Tidak sesuai opsi interval" : resultMessage(category);
}
export function buildRecommendationPdf(calculated:CalculatorResult,timestamp?:PdfGeneratedAtOptions):Uint8Array{
  return pdfDocument("Rekomendasi Dosis Antibiotik Neonatus",withGlossary([
    ...patientLines(calculated),
    recommendationTable(calculated),
    {text:"Cara membaca rujukan: Nilai tunggal berarti satu angka; rentang berarti batas bawah-atas. Opsi interval 'atau' bukan rentang kontinu. 'Dosis tunggal (bukan rutin)' tidak menetapkan frekuensi rutin. Keterangan ini hanya membantu membaca hasil, bukan mengubah evaluasi klinis."},
    {text:"Pedoman Rumah Sakit tidak membedakan usia gestasi dalam regimen utama. ANMF 2024 membedakan usia pascamenstruasi dan usia pascalahir. Verifikasi terhadap pedoman klinis terbaru tetap diperlukan."},
    referencePanel(calculated),
  ]),timestamp);
}
export function buildEvaluationPdf(calculated:CalculatorResult,evaluation:RegimenEvaluationResult,manualEnabled:boolean,timestamp?:PdfGeneratedAtOptions):Uint8Array{
  const summary = buildActualEvaluationSummary(calculated, evaluation.input);
  const actualSummary: ReportLine = {
    panelTitle: WARNING_STYLES[summary.tone].label + ": " + summary.title,
    panelTone: summary.tone,
    evaluationSummary: true,
    text: summary.items.map(item => item.label + ": " + item.message).join(" "),
    panelParagraphs: summary.items.map(item => item.label + ": " + item.message),
  };
  const refs=[calculated.recommendations.institutionalPrimary,calculated.recommendations.anmf2024];
  const targets = refs.map(rec => evaluation.targets.find(target => target.recommendationId === rec.id));
  const rows: ReportCell[][] = [
    [{ text: "Dosis aktual:" }, ...targets.map((target, index) => ({ text: target ? doseEvaluationText(target.actualDose) : "Tidak tersedia", color: colorForCategory(summary.items[index * 2].category) }))],
    [{ text: "Frekuensi aktual:" }, ...targets.map((target, index) => ({ text: target ? intervalEvaluationText(target.actualInterval, refs[index], evaluation.input.actualIntervalHours) : "Tidak tersedia", color: colorForCategory(summary.items[index * 2 + 1].category) }))],
  ];
  if (manualEnabled) rows.push(
    [{ text: "Manual dosis:" }, ...targets.map(target => ({ text: resultMessage(target?.manualDose.summary ?? target?.manualDose.lowerBound?.message ?? "Tidak tersedia") }))],
    [{ text: "Manual interval:" }, ...targets.map(target => ({ text: resultMessage(target?.manualInterval.summary ?? target?.manualInterval.lowerBound?.message ?? "Tidak tersedia") }))],
  );
  const lines:ReportItem[]=[...patientLines(calculated, actualSummary),
    {text:"Dosis aktual: "+v20ActualDoseText(evaluation.input.actualDoseMg, calculated.input.currentWeightKg)+"; Interval aktual: "+(evaluation.input.actualIntervalHours === null ? "Tidak tersedia" : evaluation.input.actualIntervalHours + " jam"),heading:true},
    recommendationTable(calculated),
    {text:"Cara membaca rujukan: Nilai tunggal berarti satu angka; rentang berarti batas bawah-atas. Opsi interval 'atau' bukan rentang kontinu. 'Dosis tunggal (bukan rutin)' tidak menetapkan frekuensi rutin. Keterangan ini hanya membantu membaca hasil, bukan mengubah evaluasi klinis."},
    {text:"Pedoman Rumah Sakit tidak membedakan usia gestasi dalam regimen utama. ANMF 2024 membedakan usia pascamenstruasi dan usia pascalahir. Verifikasi terhadap pedoman klinis terbaru tetap diperlukan."},
    { table: { title: "Evaluasi pemberian", columns: recommendationColumns, rows } },
    referencePanel(calculated),
  ];
  return pdfDocument("Evaluasi Pemberian Antibiotik Neonatus",withGlossary(lines),timestamp);
}
export function buildBatchSummaryPdf(result:BatchProcessingResult,timestamp?:PdfGeneratedAtOptions):Uint8Array{
  const summary=summarizeBatch(result), lines:ReportLine[]=[
    {text:"Kandidat: "+result.candidateRows+"; Berhasil: "+result.successCount+"; Gagal: "+result.errorCount+"; Contoh dilewati: "+result.ignoredRows,heading:true},
    {text:"Distribusi Kesesuaian",heading:true},
    ...summary.counts.filter(x=>x.group==="Keseluruhan"&&x.count>0).map(x=>({text:x.metric+" / "+x.reference+" / "+categoryLabel(x.category)+": "+x.count+"/"+x.total+" ("+pythonFixed(x.percent,1)+"%)"})),
    {text:"Uji statistik berpasangan - hasil eksploratif",heading:true},
    ...summary.paired.filter(x=>x.group!=="Keseluruhan" && x.n>0).map(x=>({text:categoryLabel(x.group)+" / "+x.metric+" / "+x.reference+": "+x.method+", n="+x.n+(x.pValue===null?(x.n<3?" (n<3)":x.aboveCount+x.belowCount===0?" (semua di dalam rentang)":" (uji tidak tersedia)"):", p="+pythonFixed(x.pValue,4))})),
    {text:"Uji McNemar: kesesuaian kedua pedoman",heading:true},
    ...summary.mcnemar.filter(x=>x.group==="Keseluruhan").map(x=>({text:x.metric+": "+(x.method==="Tidak ada pasangan diskordan"?"Tidak diuji: tidak ada pasangan diskordan":x.method)+", n="+x.n+(x.pValue===null?"":", p="+pythonFixed(x.pValue,4))})),
    {text:"Kesimpulan: hasil statistik perlu diperiksa terhadap data acuan dan ditafsirkan oleh peneliti.",color:"orange"},
  ];
  return pdfDocument("Ringkasan Evaluasi Batch Neonatus",withGlossary(lines, false),timestamp);
}
export function downloadPdf(bytes:Uint8Array,filename:string):void {
  const copy=new Uint8Array(bytes.byteLength);copy.set(bytes);
  const blob=new Blob([copy.buffer],{type:"application/pdf"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
