import * as XLSX from "xlsx-js-style";
import type { Movement, Dam } from "./types";

const THIN = { style: "thin", color: { rgb: "000000" } };
const MEDIUM = { style: "medium", color: { rgb: "000000" } };
const ALL_THIN = { top: THIN, bottom: THIN, left: THIN, right: THIN };
const ALL_MEDIUM = { top: MEDIUM, bottom: MEDIUM, left: MEDIUM, right: MEDIUM };

const sanitizeSheet = (name: string) => name.replace(/[\\/?*\[\]:]/g, "_").slice(0, 31);
const cellRef = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

function styleCell(ws: XLSX.WorkSheet, r: number, c: number, style: any, value?: any) {
  const ref = cellRef(r, c);
  if (!ws[ref]) {
    ws[ref] = { t: typeof value === "number" ? "n" : "s", v: value ?? "" };
  } else if (value !== undefined) {
    ws[ref].v = value;
    ws[ref].t = typeof value === "number" ? "n" : "s";
  }
  ws[ref].s = { ...(ws[ref].s || {}), ...style };
}

// ===== Column layout =====
// Source Mill side (left) — 11 cols
const SRC_COLS = [
  { header: "Date of Departure", width: 14 },
  { header: "Time", width: 8 },
  { header: "Vehicle Reg", width: 14 },
  { header: "Haulier", width: 16 },
  { header: "Delivery Note", width: 14 },
  { header: "Mill #", width: 8 },
  { header: "Mill", width: 14 },
  { header: "Gross Mass", width: 12 },
  { header: "Tare Mass", width: 12 },
  { header: "Net Mass", width: 12 },
  { header: "Temp / Sample", width: 14 },
];
// FGC Record side (right) — 12 cols
const FGC_COLS = [
  { header: "Date of Arrival", width: 14 },
  { header: "Time", width: 8 },
  { header: "Vehicle Reg", width: 14 },
  { header: "Haulier", width: 16 },
  { header: "Consignment Note", width: 16 },
  { header: "ZSM W/B #", width: 12 },
  { header: "Gross Mass", width: 12 },
  { header: "Tare Mass", width: 12 },
  { header: "Net Mass", width: 12 },
  { header: "Variance", width: 10 },
  { header: "ZSM Operator", width: 14 },
  { header: "If OUT, Haulier", width: 14 },
];
// Running balance columns (rightmost)
const BAL_COLS = [
  { header: "IN (tons)", width: 12 },
  { header: "OUT (tons)", width: 12 },
  { header: "NETT (tons)", width: 14 },
];

const SRC_START = 0;
const SRC_END = SRC_COLS.length - 1;                  // 10
const FGC_START = SRC_COLS.length;                     // 11
const FGC_END = FGC_START + FGC_COLS.length - 1;       // 22
const BAL_START = FGC_END + 1;                         // 23
const BAL_IN = BAL_START;                              // 23
const BAL_OUT = BAL_START + 1;                         // 24
const BAL_NETT = BAL_START + 2;                        // 25
const TOTAL_COLS = BAL_NETT + 1;                       // 26

const HEADER_GREY = "D1D5DB";
const SRC_BLUE = "BFDBFE";        // light blue band
const FGC_GREEN = "BBF7D0";       // light green band
const HEADER_YELLOW = "FFF59D";
const NETT_GREY = "E5E7EB";
const TITLE_BG = "9CA3AF";

function num(v: any): number | "" {
  if (v == null || v === "") return "";
  const n = Number(v);
  return isNaN(n) ? "" : n;
}

function addDamSheet(wb: XLSX.WorkBook, dam: Dam, allDams: Dam[], rows: Movement[]) {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );

  const aoa: any[][] = [];

  // Row 0: main title
  aoa.push(["Molasses Records for FGC 2025/26", ...new Array(TOTAL_COLS - 1).fill("")]);

  // Row 1: blank spacer
  aoa.push(new Array(TOTAL_COLS).fill(""));

  // Row 2: "Current Dam Stock" label
  const stockLabelRow = new Array(TOTAL_COLS).fill("");
  stockLabelRow[0] = "Current Dam Stock";
  aoa.push(stockLabelRow);

  // Rows 3..3+N-1: per-dam stock
  const stockStart = aoa.length;
  for (const d of allDams) {
    const r = new Array(TOTAL_COLS).fill("");
    r[0] = d.name;
    r[2] = Number(d.current_volume_tons ?? 0);
    aoa.push(r);
  }
  const stockEnd = aoa.length - 1;

  // Spacer
  aoa.push(new Array(TOTAL_COLS).fill(""));

  // Section band row (Source Mill | FGC Record | Running Balance)
  const sectionRow = new Array(TOTAL_COLS).fill("");
  sectionRow[SRC_START] = "Source Mill";
  sectionRow[FGC_START] = "FGC Record";
  sectionRow[BAL_START] = "Running Balance";
  aoa.push(sectionRow);
  const sectionRowIdx = aoa.length - 1;

  // Column headers
  const headerRow = [
    ...SRC_COLS.map((c) => c.header),
    ...FGC_COLS.map((c) => c.header),
    ...BAL_COLS.map((c) => c.header),
  ];
  aoa.push(headerRow);
  const headerRowIdx = aoa.length - 1;

  // Opening balance row — first NETT value = current dam volume
  const opening = Number(dam.current_volume_tons ?? 0);
  const openingRow = new Array(TOTAL_COLS).fill("");
  openingRow[0] = "Opening (Current Dam Volume)";
  openingRow[BAL_NETT] = opening;
  aoa.push(openingRow);
  const openingRowIdx = aoa.length - 1;

  // Data rows
  let nett = opening;
  let totalIn = 0;
  let totalOut = 0;
  const dataStart = aoa.length;

  for (const m of sorted) {
    const isIn = m.movement_type === "incoming";
    const qty = Number(m.quantity_tons) || 0;
    const inVal = isIn ? qty : 0;
    const outVal = isIn ? 0 : qty;
    nett = nett + inVal - outVal;
    totalIn += inVal;
    totalOut += outVal;

    const row = new Array(TOTAL_COLS).fill("");
    // Source Mill columns
    row[SRC_START + 0] = m.src_date_of_departure || "";
    row[SRC_START + 1] = m.src_time || "";
    row[SRC_START + 2] = m.src_vehicle_registration || "";
    row[SRC_START + 3] = m.src_haulier || "";
    row[SRC_START + 4] = m.src_delivery_note || "";
    row[SRC_START + 5] = m.src_mill_number || "";
    row[SRC_START + 6] = m.src_mill || "";
    row[SRC_START + 7] = num(m.src_gross_mass);
    row[SRC_START + 8] = num(m.src_tare_mass);
    row[SRC_START + 9] = num(m.src_net_mass);
    row[SRC_START + 10] = [m.src_molasses_temperature, m.src_sample_number].filter(Boolean).join(" / ");

    // FGC Record columns
    row[FGC_START + 0] = m.fgc_date_of_arrival || "";
    row[FGC_START + 1] = m.fgc_time || "";
    row[FGC_START + 2] = m.fgc_vehicle_registration || "";
    row[FGC_START + 3] = m.fgc_haulier || "";
    row[FGC_START + 4] = m.fgc_consignment_note_number || "";
    row[FGC_START + 5] = m.fgc_zsm_weighbridge_number || "";
    row[FGC_START + 6] = num(m.fgc_gross_mass);
    row[FGC_START + 7] = num(m.fgc_tare_mass);
    row[FGC_START + 8] = num(m.fgc_net_mass);
    row[FGC_START + 9] = num(m.fgc_variance);
    row[FGC_START + 10] = m.fgc_zsm_operator || "";
    row[FGC_START + 11] = m.fgc_if_out_haulier || "";

    // Running balance
    row[BAL_IN] = inVal || "";
    row[BAL_OUT] = outVal || "";
    row[BAL_NETT] = nett;

    aoa.push(row);
  }
  const dataEnd = aoa.length - 1;

  // Totals row
  aoa.push(new Array(TOTAL_COLS).fill(""));
  const totalsRow = new Array(TOTAL_COLS).fill("");
  totalsRow[0] = "TOTALS";
  totalsRow[BAL_IN] = totalIn;
  totalsRow[BAL_OUT] = totalOut;
  totalsRow[BAL_NETT] = nett;
  aoa.push(totalsRow);
  const totalsRowIdx = aoa.length - 1;

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    ...SRC_COLS.map((c) => ({ wch: c.width })),
    ...FGC_COLS.map((c) => ({ wch: c.width })),
    ...BAL_COLS.map((c) => ({ wch: c.width })),
  ];
  ws["!merges"] = ws["!merges"] || [];
  ws["!rows"] = ws["!rows"] || [];

  // Title merge across full width
  ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: TOTAL_COLS - 1 } });
  styleCell(ws, 0, 0, {
    font: { bold: true, sz: 16, color: { rgb: "111827" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: TITLE_BG } },
    border: ALL_MEDIUM,
  });
  ws["!rows"][0] = { hpt: 28 };

  // Current Dam Stock label
  ws["!merges"].push({ s: { r: 2, c: 0 }, e: { r: 2, c: 2 } });
  styleCell(ws, 2, 0, {
    font: { bold: true, sz: 12 },
    alignment: { horizontal: "left" },
    fill: { patternType: "solid", fgColor: { rgb: HEADER_YELLOW } },
    border: ALL_THIN,
  });
  for (let r = stockStart; r <= stockEnd; r++) {
    styleCell(ws, r, 0, {
      font: { bold: true },
      alignment: { horizontal: "left" },
      fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } },
      border: ALL_THIN,
    });
    styleCell(ws, r, 1, {
      alignment: { horizontal: "left" },
      fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } },
      border: ALL_THIN,
    }, "tons:");
    styleCell(ws, r, 2, {
      font: { bold: true },
      alignment: { horizontal: "right" },
      fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } },
      border: ALL_THIN,
      numFmt: "#,##0.000",
    });
  }

  // Section band row
  ws["!merges"].push({ s: { r: sectionRowIdx, c: SRC_START }, e: { r: sectionRowIdx, c: SRC_END } });
  ws["!merges"].push({ s: { r: sectionRowIdx, c: FGC_START }, e: { r: sectionRowIdx, c: FGC_END } });
  ws["!merges"].push({ s: { r: sectionRowIdx, c: BAL_START }, e: { r: sectionRowIdx, c: BAL_NETT } });
  styleCell(ws, sectionRowIdx, SRC_START, {
    font: { bold: true, sz: 12, color: { rgb: "1E3A8A" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: SRC_BLUE } },
    border: ALL_MEDIUM,
  });
  styleCell(ws, sectionRowIdx, FGC_START, {
    font: { bold: true, sz: 12, color: { rgb: "065F46" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: FGC_GREEN } },
    border: ALL_MEDIUM,
  });
  styleCell(ws, sectionRowIdx, BAL_START, {
    font: { bold: true, sz: 12, color: { rgb: "111827" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: HEADER_YELLOW } },
    border: ALL_MEDIUM,
  });
  ws["!rows"][sectionRowIdx] = { hpt: 22 };

  // Column header row
  for (let c = 0; c < TOTAL_COLS; c++) {
    const isBal = c >= BAL_START;
    styleCell(ws, headerRowIdx, c, {
      font: { bold: true, sz: 11 },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      fill: { patternType: "solid", fgColor: { rgb: isBal ? HEADER_YELLOW : HEADER_GREY } },
      border: c === FGC_START - 1 || c === FGC_END
        ? { ...ALL_THIN, right: MEDIUM }
        : c === FGC_START || c === BAL_START
          ? { ...ALL_THIN, left: MEDIUM }
          : ALL_THIN,
    });
  }
  ws["!rows"][headerRowIdx] = { hpt: 32 };

  // Opening balance row
  for (let c = 0; c < TOTAL_COLS; c++) {
    const isNett = c === BAL_NETT;
    styleCell(ws, openingRowIdx, c, {
      font: { bold: true },
      alignment: { horizontal: c === 0 ? "left" : "right", vertical: "center" },
      fill: { patternType: "solid", fgColor: { rgb: NETT_GREY } },
      border: ALL_THIN,
      ...(isNett ? { numFmt: "#,##0.000" } : {}),
    });
  }
  ws["!merges"].push({ s: { r: openingRowIdx, c: 0 }, e: { r: openingRowIdx, c: BAL_NETT - 1 } });

  // Data row styling — borders, separator, number formats
  for (let r = dataStart; r <= dataEnd; r++) {
    for (let c = 0; c < TOTAL_COLS; c++) {
      const ref = cellRef(r, c);
      if (!ws[ref]) ws[ref] = { t: "s", v: "" };
      const v = ws[ref].v;
      if (typeof v === "number") ws[ref].t = "n";

      const isNumeric = typeof v === "number";
      const inSrc = c >= SRC_START && c <= SRC_END;
      const inFgc = c >= FGC_START && c <= FGC_END;
      const isNett = c === BAL_NETT;
      const isInOut = c === BAL_IN || c === BAL_OUT;

      const border: any = { ...ALL_THIN };
      if (c === SRC_END) border.right = MEDIUM;       // separator between Source and FGC
      if (c === FGC_START) border.left = MEDIUM;
      if (c === FGC_END) border.right = MEDIUM;       // separator between FGC and Balance
      if (c === BAL_START) border.left = MEDIUM;

      const style: any = {
        alignment: { horizontal: isNumeric ? "right" : "left", vertical: "center", wrapText: true },
        border,
      };

      if (inSrc && (c >= SRC_START + 7 && c <= SRC_START + 9)) style.numFmt = "#,##0.000";
      if (inFgc && (c >= FGC_START + 6 && c <= FGC_START + 9)) style.numFmt = "#,##0.000";
      if (isInOut) style.numFmt = "#,##0.000";
      if (isNett) {
        style.numFmt = "#,##0.000";
        style.font = { bold: true };
        style.fill = { patternType: "solid", fgColor: { rgb: NETT_GREY } };
      }

      ws[ref].s = style;
    }
  }

  // Totals row
  ws["!merges"].push({ s: { r: totalsRowIdx, c: 0 }, e: { r: totalsRowIdx, c: BAL_IN - 1 } });
  for (let c = 0; c < TOTAL_COLS; c++) {
    const isVal = c === BAL_IN || c === BAL_OUT || c === BAL_NETT;
    styleCell(ws, totalsRowIdx, c, {
      font: { bold: true, sz: 12 },
      alignment: { horizontal: "right", vertical: "center" },
      fill: { patternType: "solid", fgColor: { rgb: c === BAL_NETT ? NETT_GREY : HEADER_YELLOW } },
      border: ALL_MEDIUM,
      ...(isVal ? { numFmt: "#,##0.000" } : {}),
    });
  }

  ws["!freeze"] = { xSplit: 0, ySplit: headerRowIdx + 1 };

  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheet(dam.name));
}

export async function exportMovementsToExcel(opts: {
  dams: Dam[];               // dams to include as sheets (filtered)
  movements: Movement[];
  filename: string;
  perDamSheets: boolean;     // if true, include all dams
  allDams?: Dam[];           // full list, for dam-stock summary
}) {
  const wb = XLSX.utils.book_new();
  const allDams = opts.allDams ?? opts.dams;

  if (opts.perDamSheets) {
    for (const dam of allDams) {
      const rows = opts.movements.filter((m) => m.dam_id === dam.id);
      addDamSheet(wb, dam, allDams, rows);
    }
    if (allDams.length === 0) {
      const ws = XLSX.utils.aoa_to_sheet([["No data"]]);
      XLSX.utils.book_append_sheet(wb, ws, "Movements");
    }
  } else {
    const dam = opts.dams[0];
    if (!dam) throw new Error("No dam selected");
    const rows = opts.movements.filter((m) => m.dam_id === dam.id);
    addDamSheet(wb, dam, allDams, rows);
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
