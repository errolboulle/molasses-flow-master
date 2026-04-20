import * as XLSX from "xlsx-js-style";
import type { Movement, Dam } from "./types";

const SRC_HEADERS = [
  { key: "src_date_of_departure", header: "Date of Departure" },
  { key: "src_time", header: "Time" },
  { key: "src_vehicle_registration", header: "Vehicle Reg" },
  { key: "src_haulier", header: "Haulier" },
  { key: "src_delivery_note", header: "Delivery Note" },
  { key: "src_mill_number", header: "Mill Number" },
  { key: "src_mill", header: "Mill" },
  { key: "src_gross_mass", header: "Gross Mass" },
  { key: "src_tare_mass", header: "Tare Mass" },
  { key: "src_net_mass", header: "Net Mass" },
  { key: "src_molasses_temperature", header: "Temp" },
  { key: "src_sample_number", header: "Sample No" },
] as const;

const FGC_HEADERS = [
  { key: "fgc_date_of_arrival", header: "Date of Arrival" },
  { key: "fgc_time", header: "Time" },
  { key: "fgc_vehicle_registration", header: "Vehicle Reg" },
  { key: "fgc_haulier", header: "Haulier" },
  { key: "fgc_consignment_note_number", header: "Consignment Note" },
  { key: "fgc_zsm_weighbridge_number", header: "ZSM Weighbridge" },
  { key: "fgc_gross_mass", header: "Gross Mass" },
  { key: "fgc_tare_mass", header: "Tare Mass" },
  { key: "fgc_net_mass", header: "Net Mass" },
  { key: "fgc_variance", header: "Variance" },
  { key: "fgc_brix", header: "Brix" },
  { key: "fgc_in_out", header: "In/Out" },
  { key: "fgc_zsm_operator", header: "ZSM Operator" },
  { key: "fgc_if_out_haulier", header: "If Out Haulier" },
  { key: "fgc_in", header: "In" },
  { key: "fgc_out", header: "Out" },
  { key: "fgc_net", header: "Net" },
] as const;

const TOTAL_COLS = SRC_HEADERS.length + FGC_HEADERS.length;
const SEP_COL_INDEX = SRC_HEADERS.length; // 0-based: column index where FGC begins (border on left side of this col)

const sanitizeSheet = (name: string) => name.replace(/[\\/?*\[\]:]/g, "_").slice(0, 31);

function calcNet(gross: any, tare: any, fallback: any): number | null {
  if (fallback != null) return Number(fallback);
  const g = Number(gross), t = Number(tare);
  if (!isNaN(g) && !isNaN(t)) return g - t;
  return null;
}

function buildRowValues(m: Movement): any[] {
  const srcNet = calcNet(m.src_gross_mass, m.src_tare_mass, m.src_net_mass);
  const fgcNet = calcNet(m.fgc_gross_mass, m.fgc_tare_mass, m.fgc_net_mass);
  const variance = m.fgc_variance ?? (srcNet != null && fgcNet != null ? srcNet - fgcNet : null);
  const enriched: any = { ...m, src_net_mass: srcNet, fgc_net_mass: fgcNet, fgc_variance: variance };
  const row: any[] = [];
  for (const h of SRC_HEADERS) row.push(enriched[h.key] ?? "");
  for (const h of FGC_HEADERS) row.push(enriched[h.key] ?? "");
  return row;
}

const colLetter = (idx: number) => XLSX.utils.encode_col(idx);
const cellRef = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

const THIN = { style: "thin", color: { rgb: "000000" } };
const MEDIUM = { style: "medium", color: { rgb: "000000" } };

function styleCell(ws: XLSX.WorkSheet, r: number, c: number, style: any, value?: any) {
  const ref = cellRef(r, c);
  if (!ws[ref]) ws[ref] = { t: value == null || value === "" ? "s" : typeof value === "number" ? "n" : "s", v: value ?? "" };
  ws[ref].s = { ...(ws[ref].s || {}), ...style };
}

function addSheet(wb: XLSX.WorkBook, dam: Dam, rows: Movement[], allDams: Dam[]) {
  // Build empty matrix
  const aoa: any[][] = [];

  // Row 0: Title (merged across all columns)
  const titleRow = new Array(TOTAL_COLS).fill("");
  titleRow[0] = "Molasses Records for FGC 2025/26";
  aoa.push(titleRow);

  // Row 1: blank spacer
  aoa.push(new Array(TOTAL_COLS).fill(""));

  // Row 2: "Current Dam Stock" label (top-left)
  const stockLabelRow = new Array(TOTAL_COLS).fill("");
  stockLabelRow[0] = "Current Dam Stock";
  aoa.push(stockLabelRow);

  // Rows 3..: each dam's stock (label + value)
  const stockStartRow = aoa.length;
  for (const d of allDams) {
    const r = new Array(TOTAL_COLS).fill("");
    r[0] = d.name;
    r[1] = Number(d.current_volume_tons ?? 0);
    r[2] = "tons";
    aoa.push(r);
  }
  const stockEndRow = aoa.length - 1;

  // Spacer
  aoa.push(new Array(TOTAL_COLS).fill(""));

  // Section labels row: "Source Mill" (left) and "FGC Record" (right)
  const sectionRow = new Array(TOTAL_COLS).fill("");
  sectionRow[0] = "Source Mill";
  sectionRow[SEP_COL_INDEX] = "FGC Record";
  aoa.push(sectionRow);
  const sectionRowIdx = aoa.length - 1;

  // Column headers row
  const headerRow: any[] = [];
  for (const h of SRC_HEADERS) headerRow.push(h.header);
  for (const h of FGC_HEADERS) headerRow.push(h.header);
  aoa.push(headerRow);
  const headerRowIdx = aoa.length - 1;

  // Data rows
  const dataStartRow = aoa.length;
  for (const m of rows) aoa.push(buildRowValues(m));
  const dataEndRow = aoa.length - 1;

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths
  ws["!cols"] = new Array(TOTAL_COLS).fill(0).map(() => ({ wch: 16 }));

  // Merges
  ws["!merges"] = ws["!merges"] || [];
  // Title merge
  ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: TOTAL_COLS - 1 } });
  // Current Dam Stock label merge (across first 3 cols)
  ws["!merges"].push({ s: { r: 2, c: 0 }, e: { r: 2, c: 2 } });
  // Section label merges
  ws["!merges"].push({ s: { r: sectionRowIdx, c: 0 }, e: { r: sectionRowIdx, c: SEP_COL_INDEX - 1 } });
  ws["!merges"].push({ s: { r: sectionRowIdx, c: SEP_COL_INDEX }, e: { r: sectionRowIdx, c: TOTAL_COLS - 1 } });

  // Style: Title
  styleCell(ws, 0, 0, {
    font: { bold: true, sz: 18, color: { rgb: "1F2937" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: "E5E7EB" } },
  }, "Molasses Records for FGC 2025/26");
  ws["!rows"] = ws["!rows"] || [];
  ws["!rows"][0] = { hpt: 28 };

  // Style: Current Dam Stock label
  styleCell(ws, 2, 0, {
    font: { bold: true, sz: 12 },
    alignment: { horizontal: "left" },
  }, "Current Dam Stock");

  // Style: dam stock rows
  for (let r = stockStartRow; r <= stockEndRow; r++) {
    styleCell(ws, r, 0, { font: { bold: true }, border: { top: THIN, bottom: THIN, left: THIN, right: THIN } });
    styleCell(ws, r, 1, {
      alignment: { horizontal: "right" },
      numFmt: "#,##0.000",
      border: { top: THIN, bottom: THIN, left: THIN, right: THIN },
    });
    styleCell(ws, r, 2, { border: { top: THIN, bottom: THIN, left: THIN, right: THIN } });
  }

  // Style: Section labels (Source Mill / FGC Record)
  const sectionStyle = (fg: string) => ({
    font: { bold: true, sz: 13, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: fg } },
    border: { top: MEDIUM, bottom: MEDIUM, left: MEDIUM, right: MEDIUM },
  });
  styleCell(ws, sectionRowIdx, 0, sectionStyle("2563EB"), "Source Mill");
  styleCell(ws, sectionRowIdx, SEP_COL_INDEX, sectionStyle("059669"), "FGC Record");
  // Apply background fill to all cells in section row so merge looks unified
  for (let c = 0; c < TOTAL_COLS; c++) {
    const fg = c < SEP_COL_INDEX ? "2563EB" : "059669";
    styleCell(ws, sectionRowIdx, c, {
      fill: { patternType: "solid", fgColor: { rgb: fg } },
      border: { top: MEDIUM, bottom: MEDIUM },
    });
  }
  ws["!rows"][sectionRowIdx] = { hpt: 22 };

  // Style: Column headers (yellow, bold, centered)
  for (let c = 0; c < TOTAL_COLS; c++) {
    styleCell(ws, headerRowIdx, c, {
      font: { bold: true, color: { rgb: "000000" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      fill: { patternType: "solid", fgColor: { rgb: "FFFF00" } },
      border: {
        top: MEDIUM,
        bottom: MEDIUM,
        left: c === SEP_COL_INDEX ? MEDIUM : THIN,
        right: c === SEP_COL_INDEX - 1 ? MEDIUM : THIN,
      },
    });
  }
  ws["!rows"][headerRowIdx] = { hpt: 30 };

  // Style: Data cells with borders + thick separator between SRC and FGC
  for (let r = dataStartRow; r <= dataEndRow; r++) {
    for (let c = 0; c < TOTAL_COLS; c++) {
      const ref = cellRef(r, c);
      if (!ws[ref]) ws[ref] = { t: "s", v: "" };
      const v = ws[ref].v;
      if (typeof v === "number") ws[ref].t = "n";
      ws[ref].s = {
        alignment: { horizontal: typeof v === "number" ? "right" : "left", vertical: "center" },
        border: {
          top: THIN,
          bottom: THIN,
          left: c === SEP_COL_INDEX ? MEDIUM : THIN,
          right: c === SEP_COL_INDEX - 1 ? MEDIUM : THIN,
        },
        ...(typeof v === "number" ? { numFmt: "#,##0.000" } : {}),
      };
    }
  }

  // Freeze top rows so headers stay visible
  ws["!freeze"] = { xSplit: 0, ySplit: headerRowIdx + 1 };
  (ws as any)["!frozen"] = { r: headerRowIdx + 1, c: 0 };

  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheet(dam.name));
}

export async function exportMovementsToExcel(opts: {
  dams: Dam[];
  movements: Movement[];
  filename: string;
  perDamSheets: boolean;
  allDams?: Dam[];
}) {
  const wb = XLSX.utils.book_new();
  const allDams = opts.allDams ?? opts.dams;

  if (opts.perDamSheets) {
    for (const dam of opts.dams) {
      const rows = opts.movements.filter((m) => m.dam_id === dam.id);
      addSheet(wb, dam, rows, allDams);
    }
    if (opts.dams.length === 0) {
      const ws = XLSX.utils.aoa_to_sheet([["No data"]]);
      XLSX.utils.book_append_sheet(wb, ws, "Movements");
    }
  } else {
    const dam = opts.dams[0];
    if (!dam) throw new Error("No dam selected");
    const rows = opts.movements.filter((m) => m.dam_id === dam.id);
    addSheet(wb, dam, rows, allDams);
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = opts.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
