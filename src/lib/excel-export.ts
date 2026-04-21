import * as XLSX from "xlsx-js-style";
import type { Movement, Dam } from "./types";

const THIN = { style: "thin", color: { rgb: "000000" } };
const MEDIUM = { style: "medium", color: { rgb: "000000" } };
const ALL_THIN = { top: THIN, bottom: THIN, left: THIN, right: THIN };
const ALL_MEDIUM = { top: MEDIUM, bottom: MEDIUM, left: MEDIUM, right: MEDIUM };

const sanitizeSheet = (name: string) => name.replace(/[\\/?*\[\]:]/g, "_").slice(0, 31);
const cellRef = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

function calcNet(gross: any, tare: any, fallback: any): number | null {
  if (fallback != null && fallback !== "") return Number(fallback);
  const g = Number(gross), t = Number(tare);
  if (!isNaN(g) && !isNaN(t) && (gross != null || tare != null)) return g - t;
  return null;
}

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

// Per-dam sheet columns:
// Date | Time | Vehicle Reg | Haulier | Consignment Note | ZSM Operator | If OUT Haulier | IN (tons) | OUT (tons) | NETT (tons) | Notes
const DAM_COLS = [
  { header: "Date", width: 12 },
  { header: "Time", width: 8 },
  { header: "Vehicle Reg", width: 14 },
  { header: "Haulier", width: 16 },
  { header: "Consignment Note", width: 18 },
  { header: "ZSM Operator", width: 14 },
  { header: "If OUT, Haulier", width: 16 },
  { header: "IN (tons)", width: 12 },
  { header: "OUT (tons)", width: 12 },
  { header: "NETT (tons)", width: 14 },
  { header: "Notes", width: 24 },
];
const COL_IN = 7, COL_OUT = 8, COL_NETT = 9, COL_IF_OUT = 6;
const TOTAL_COLS_DAM = DAM_COLS.length;

const HEADER_BLUE = "1E40AF"; // blue
const NETT_GREY = "D1D5DB";   // grey
const YELLOW = "FFF59D";

function addDamSheet(wb: XLSX.WorkBook, dam: Dam, rows: Movement[]) {
  // Sort ascending by date for running balance
  const sorted = [...rows].sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
  const opening = Number(dam.starting_balance_tons ?? 0);

  const aoa: any[][] = [];

  // Title
  aoa.push([`${dam.name} — Molasses Record`, ...new Array(TOTAL_COLS_DAM - 1).fill("")]);
  aoa.push(new Array(TOTAL_COLS_DAM).fill(""));

  // Opening balance row
  const openLabelRow = new Array(TOTAL_COLS_DAM).fill("");
  openLabelRow[0] = "Opening Balance";
  openLabelRow[COL_NETT] = opening;
  aoa.push(openLabelRow);

  aoa.push(new Array(TOTAL_COLS_DAM).fill(""));

  // Header row
  aoa.push(DAM_COLS.map((c) => c.header));
  const headerRowIdx = aoa.length - 1;

  // Data rows
  let nett = opening;
  let totalIn = 0, totalOut = 0;
  const dataStart = aoa.length;
  for (const m of sorted) {
    const isIn = m.movement_type === "incoming";
    const qty = Number(m.quantity_tons) || 0;
    const inVal = isIn ? qty : 0;
    const outVal = isIn ? 0 : qty;
    nett = nett + inVal - outVal;
    totalIn += inVal;
    totalOut += outVal;

    const occ = m.occurred_at ? new Date(m.occurred_at) : null;
    const dateStr = occ ? occ.toISOString().slice(0, 10) : (m.fgc_date_of_arrival || m.src_date_of_departure || "");
    const timeStr = occ
      ? occ.toTimeString().slice(0, 5)
      : (m.fgc_time || m.src_time || "");

    aoa.push([
      dateStr,
      timeStr,
      m.fgc_vehicle_registration || m.src_vehicle_registration || "",
      m.fgc_haulier || m.src_haulier || "",
      m.fgc_consignment_note_number || m.src_delivery_note || "",
      m.fgc_zsm_operator || "",
      m.fgc_if_out_haulier || "",
      inVal || "",
      outVal || "",
      nett,
      m.notes || "",
    ]);
  }
  const dataEnd = aoa.length - 1;

  // Totals row
  aoa.push(new Array(TOTAL_COLS_DAM).fill(""));
  const totalsRow = new Array(TOTAL_COLS_DAM).fill("");
  totalsRow[0] = "TOTALS";
  totalsRow[COL_IN] = totalIn;
  totalsRow[COL_OUT] = totalOut;
  totalsRow[COL_NETT] = nett;
  aoa.push(totalsRow);
  const totalsRowIdx = aoa.length - 1;

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = DAM_COLS.map((c) => ({ wch: c.width }));
  ws["!merges"] = ws["!merges"] || [];
  // Title merge
  ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: TOTAL_COLS_DAM - 1 } });
  // Opening label merge (cols 0..COL_NETT-1)
  ws["!merges"].push({ s: { r: 2, c: 0 }, e: { r: 2, c: COL_NETT - 1 } });
  // Totals label merge
  ws["!merges"].push({ s: { r: totalsRowIdx, c: 0 }, e: { r: totalsRowIdx, c: COL_IN - 1 } });

  // Title style
  styleCell(ws, 0, 0, {
    font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: HEADER_BLUE } },
    border: ALL_MEDIUM,
  });
  ws["!rows"] = ws["!rows"] || [];
  ws["!rows"][0] = { hpt: 26 };

  // Opening balance row style
  styleCell(ws, 2, 0, {
    font: { bold: true },
    alignment: { horizontal: "left" },
    fill: { patternType: "solid", fgColor: { rgb: NETT_GREY } },
    border: ALL_THIN,
  });
  styleCell(ws, 2, COL_NETT, {
    font: { bold: true },
    alignment: { horizontal: "right" },
    fill: { patternType: "solid", fgColor: { rgb: NETT_GREY } },
    border: ALL_THIN,
    numFmt: "#,##0.000",
  });

  // Header row style
  for (let c = 0; c < TOTAL_COLS_DAM; c++) {
    const isInOutNett = c === COL_IN || c === COL_OUT || c === COL_NETT;
    styleCell(ws, headerRowIdx, c, {
      font: { bold: true, color: { rgb: isInOutNett ? "FFFFFF" : "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      fill: { patternType: "solid", fgColor: { rgb: HEADER_BLUE } },
      border: ALL_MEDIUM,
    });
  }
  ws["!rows"][headerRowIdx] = { hpt: 28 };

  // Data row styles
  for (let r = dataStart; r <= dataEnd; r++) {
    for (let c = 0; c < TOTAL_COLS_DAM; c++) {
      const ref = cellRef(r, c);
      if (!ws[ref]) ws[ref] = { t: "s", v: "" };
      const v = ws[ref].v;
      if (typeof v === "number") ws[ref].t = "n";
      const baseStyle: any = {
        alignment: { horizontal: typeof v === "number" ? "right" : "left", vertical: "center", wrapText: true },
        border: ALL_THIN,
      };
      if (c === COL_NETT) {
        baseStyle.fill = { patternType: "solid", fgColor: { rgb: NETT_GREY } };
        baseStyle.font = { bold: true };
        baseStyle.numFmt = "#,##0.000";
      } else if (c === COL_IN || c === COL_OUT) {
        baseStyle.numFmt = "#,##0.000";
      } else if (c === COL_IF_OUT && v) {
        baseStyle.fill = { patternType: "solid", fgColor: { rgb: YELLOW } };
      }
      ws[ref].s = baseStyle;
    }
  }

  // Totals row style
  for (let c = 0; c < TOTAL_COLS_DAM; c++) {
    const isVal = c === COL_IN || c === COL_OUT || c === COL_NETT;
    styleCell(ws, totalsRowIdx, c, {
      font: { bold: true, sz: 12 },
      alignment: { horizontal: c === 0 ? "right" : "right", vertical: "center" },
      fill: { patternType: "solid", fgColor: { rgb: c === COL_NETT ? NETT_GREY : "FDE68A" } },
      border: ALL_MEDIUM,
      ...(isVal ? { numFmt: "#,##0.000" } : {}),
    });
  }

  ws["!freeze"] = { xSplit: 0, ySplit: headerRowIdx + 1 };

  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheet(dam.name));
}

function addSummarySheet(wb: XLSX.WorkBook, dams: Dam[], movements: Movement[]) {
  const damStats = dams.map((d) => {
    const rows = movements.filter((m) => m.dam_id === d.id);
    let inT = 0, outT = 0;
    for (const m of rows) {
      const q = Number(m.quantity_tons) || 0;
      if (m.movement_type === "incoming") inT += q; else outT += q;
    }
    const opening = Number(d.starting_balance_tons ?? 0);
    const finalNett = opening + inT - outT;
    return { dam: d, opening, inT, outT, finalNett, current: Number(d.current_volume_tons ?? 0) };
  });

  const totalIn = damStats.reduce((a, x) => a + x.inT, 0);
  const totalOut = damStats.reduce((a, x) => a + x.outT, 0);
  const totalNett = damStats.reduce((a, x) => a + x.finalNett, 0);

  const cols = ["Dam", "Opening (tons)", "IN (tons)", "OUT (tons)", "NETT (tons)", "Current Stock (tons)"];
  const aoa: any[][] = [];
  // Title
  aoa.push(["TOTAL MOLASSES STORED", "", "", "", "", ""]);
  aoa.push(["Molasses Records for FGC 2025/26", "", "", "", "", ""]);
  aoa.push(new Array(cols.length).fill(""));

  // Big totals block
  aoa.push(["Total IN", totalIn, "", "Total OUT", totalOut, ""]);
  aoa.push(["Total NETT", totalNett, "", "Generated", new Date().toLocaleString(), ""]);
  aoa.push(new Array(cols.length).fill(""));

  // Per-dam table header
  aoa.push(cols);
  const headerIdx = aoa.length - 1;

  // Per-dam rows
  const dataStart = aoa.length;
  for (const s of damStats) {
    aoa.push([s.dam.name, s.opening, s.inT, s.outT, s.finalNett, s.current]);
  }
  const dataEnd = aoa.length - 1;

  // Totals row
  aoa.push(["TOTAL", damStats.reduce((a, x) => a + x.opening, 0), totalIn, totalOut, totalNett, damStats.reduce((a, x) => a + x.current, 0)]);
  const totalsIdx = aoa.length - 1;

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 22 }];
  ws["!merges"] = ws["!merges"] || [];
  ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: cols.length - 1 } });
  ws["!merges"].push({ s: { r: 1, c: 0 }, e: { r: 1, c: cols.length - 1 } });

  // Title styles
  styleCell(ws, 0, 0, {
    font: { bold: true, sz: 18, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: HEADER_BLUE } },
    border: ALL_MEDIUM,
  });
  styleCell(ws, 1, 0, {
    font: { bold: true, sz: 12, color: { rgb: "1F2937" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: "E5E7EB" } },
    border: ALL_THIN,
  });
  ws["!rows"] = ws["!rows"] || [];
  ws["!rows"][0] = { hpt: 30 };
  ws["!rows"][1] = { hpt: 20 };

  // Big totals block styles
  const totLabelStyle = {
    font: { bold: true, sz: 12 },
    alignment: { horizontal: "left", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: "FDE68A" } },
    border: ALL_THIN,
  };
  const totValStyle = {
    font: { bold: true, sz: 14 },
    alignment: { horizontal: "right", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: NETT_GREY } },
    border: ALL_THIN,
    numFmt: "#,##0.000",
  };
  styleCell(ws, 3, 0, totLabelStyle); styleCell(ws, 3, 1, totValStyle);
  styleCell(ws, 3, 3, totLabelStyle); styleCell(ws, 3, 4, totValStyle);
  styleCell(ws, 4, 0, { ...totLabelStyle, fill: { patternType: "solid", fgColor: { rgb: HEADER_BLUE } }, font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 } });
  styleCell(ws, 4, 1, { ...totValStyle, fill: { patternType: "solid", fgColor: { rgb: HEADER_BLUE } }, font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } } });
  styleCell(ws, 4, 3, { ...totLabelStyle, fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } } });
  styleCell(ws, 4, 4, { ...totLabelStyle, alignment: { horizontal: "right", vertical: "center" }, fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } }, font: { bold: false, sz: 11 } });

  // Header row
  for (let c = 0; c < cols.length; c++) {
    styleCell(ws, headerIdx, c, {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      fill: { patternType: "solid", fgColor: { rgb: HEADER_BLUE } },
      border: ALL_MEDIUM,
    });
  }
  ws["!rows"][headerIdx] = { hpt: 28 };

  // Data rows
  for (let r = dataStart; r <= dataEnd; r++) {
    for (let c = 0; c < cols.length; c++) {
      const ref = cellRef(r, c);
      if (!ws[ref]) ws[ref] = { t: "s", v: "" };
      const v = ws[ref].v;
      if (typeof v === "number") ws[ref].t = "n";
      const s: any = {
        alignment: { horizontal: c === 0 ? "left" : "right", vertical: "center" },
        border: ALL_THIN,
        font: c === 0 ? { bold: true } : {},
        ...(c >= 1 ? { numFmt: "#,##0.000" } : {}),
      };
      if (c === 4) {
        s.fill = { patternType: "solid", fgColor: { rgb: NETT_GREY } };
        s.font = { bold: true };
      }
      ws[ref].s = s;
    }
  }

  // Totals row
  for (let c = 0; c < cols.length; c++) {
    styleCell(ws, totalsIdx, c, {
      font: { bold: true, sz: 12, color: { rgb: c === 4 ? "000000" : "FFFFFF" } },
      alignment: { horizontal: c === 0 ? "left" : "right", vertical: "center" },
      fill: { patternType: "solid", fgColor: { rgb: c === 4 ? NETT_GREY : HEADER_BLUE } },
      border: ALL_MEDIUM,
      ...(c >= 1 ? { numFmt: "#,##0.000" } : {}),
    });
  }

  XLSX.utils.book_append_sheet(wb, ws, "TOTAL Summary");
}

export async function exportMovementsToExcel(opts: {
  dams: Dam[];               // dams to include as sheets (filtered)
  movements: Movement[];
  filename: string;
  perDamSheets: boolean;     // if true, include all dams + summary
  allDams?: Dam[];           // full list, used by summary when filter applied
}) {
  const wb = XLSX.utils.book_new();
  const allDams = opts.allDams ?? opts.dams;

  if (opts.perDamSheets) {
    // Summary first (full report)
    addSummarySheet(wb, allDams, opts.movements);
    for (const dam of allDams) {
      const rows = opts.movements.filter((m) => m.dam_id === dam.id);
      addDamSheet(wb, dam, rows);
    }
    if (allDams.length === 0) {
      const ws = XLSX.utils.aoa_to_sheet([["No data"]]);
      XLSX.utils.book_append_sheet(wb, ws, "Movements");
    }
  } else {
    const dam = opts.dams[0];
    if (!dam) throw new Error("No dam selected");
    const rows = opts.movements.filter((m) => m.dam_id === dam.id);
    addDamSheet(wb, dam, rows);
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
