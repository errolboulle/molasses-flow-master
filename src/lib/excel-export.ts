import * as XLSX from "xlsx-js-style";
import type { Movement, Dam } from "./types";
import { LEFT_COLS, RIGHT_COLS } from "./report-layout";

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
const GAP_WIDTH = 3;
const LEFT_START = 0;
const LEFT_END = LEFT_COLS.length - 1;                  // 11
const GAP_COL = LEFT_END + 1;                           // 12
const RIGHT_START = GAP_COL + 1;                        // 13
const RIGHT_END = RIGHT_START + RIGHT_COLS.length - 1;  // 29
const TOTAL_COLS = RIGHT_END + 1;                       // 30

const IN_COL = RIGHT_END - 2;
const OUT_COL = RIGHT_END - 1;
const NETT_COL = RIGHT_END;

// Colors
const SRC_BLUE = "BFDBFE";
const FGC_GREEN = "BBF7D0";
const TITLE_BG = "FDE68A";
const HEADER_GREY = "E5E7EB";
const NETT_GREY = "F3F4F6";
const IN_GREEN = "DCFCE7";
const OUT_RED = "FEE2E2";

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

  // Row 0: SOURCE MILL (left) | gap | FGC (right)
  const r0 = new Array(TOTAL_COLS).fill("");
  r0[LEFT_START] = "SOURCE MILL";
  r0[RIGHT_START] = "FGC";
  aoa.push(r0);

  // Row 1: MOLASSES RECORDS FOR FGC 2025/26 (centered across full width)
  const r1 = new Array(TOTAL_COLS).fill("");
  r1[0] = "MOLASSES RECORDS FOR FGC 2025/26";
  aoa.push(r1);

  // Row 2: Dam name centered across full width
  const r2 = new Array(TOTAL_COLS).fill("");
  const damLabel = `${dam.name.toUpperCase()}  ·  DAM 1 / DAM 2 / DAM 3`;
  r2[0] = damLabel;
  aoa.push(r2);

  // Row 3: spacer
  aoa.push(new Array(TOTAL_COLS).fill(""));

  // Row 4: Column headers
  const headerRow = new Array(TOTAL_COLS).fill("");
  LEFT_COLS.forEach((c, i) => (headerRow[LEFT_START + i] = c.header));
  RIGHT_COLS.forEach((c, i) => (headerRow[RIGHT_START + i] = c.header));
  aoa.push(headerRow);
  const headerRowIdx = aoa.length - 1;

  // Opening balance row (NETT seeded with current dam volume)
  const opening = Number(dam.current_volume_tons ?? 0);
  const openingRow = new Array(TOTAL_COLS).fill("");
  openingRow[LEFT_START] = "Opening Balance";
  openingRow[NETT_COL] = opening;
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

    // LEFT (Source Mill / Departure)
    row[LEFT_START + 0] = m.src_date_of_departure || "";
    row[LEFT_START + 1] = m.src_time || "";
    row[LEFT_START + 2] = m.src_vehicle_registration || "";
    row[LEFT_START + 3] = m.src_haulier || "";
    row[LEFT_START + 4] = m.src_delivery_note || "";
    row[LEFT_START + 5] = m.src_mill_number || "";
    row[LEFT_START + 6] = m.src_mill || "";
    row[LEFT_START + 7] = num(m.src_gross_mass);
    row[LEFT_START + 8] = num(m.src_tare_mass);
    row[LEFT_START + 9] = num(m.src_net_mass);
    row[LEFT_START + 10] = num(m.src_molasses_temperature);
    row[LEFT_START + 11] = m.src_sample_number || "";

    // RIGHT (FGC / Arrival)
    row[RIGHT_START + 0] = m.fgc_date_of_arrival || "";
    row[RIGHT_START + 1] = m.fgc_time || "";
    row[RIGHT_START + 2] = m.fgc_vehicle_registration || "";
    row[RIGHT_START + 3] = m.fgc_haulier || "";
    row[RIGHT_START + 4] = m.fgc_consignment_note_number || "";
    row[RIGHT_START + 5] = m.fgc_zsm_weighbridge_number || "";
    row[RIGHT_START + 6] = num(m.fgc_gross_mass);
    row[RIGHT_START + 7] = num(m.fgc_tare_mass);
    row[RIGHT_START + 8] = num(m.fgc_net_mass);
    row[RIGHT_START + 9] = num(m.fgc_variance);
    row[RIGHT_START + 10] = num(m.fgc_brix);
    row[RIGHT_START + 11] = m.fgc_in_out || (isIn ? "IN" : "OUT");
    row[RIGHT_START + 12] = m.fgc_zsm_operator || "";
    row[RIGHT_START + 13] = m.fgc_if_out_haulier || "";

    // Running balance
    row[IN_COL] = inVal || "";
    row[OUT_COL] = outVal || "";
    row[NETT_COL] = nett;

    aoa.push(row);
  }
  const dataEnd = aoa.length - 1;

  // Spacer + Totals row
  aoa.push(new Array(TOTAL_COLS).fill(""));
  const totalsRow = new Array(TOTAL_COLS).fill("");
  totalsRow[RIGHT_START] = "TOTALS";
  totalsRow[IN_COL] = totalIn;
  totalsRow[OUT_COL] = totalOut;
  totalsRow[NETT_COL] = nett;
  aoa.push(totalsRow);
  const totalsRowIdx = aoa.length - 1;

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths (incl. gap)
  const cols: { wch: number }[] = [];
  LEFT_COLS.forEach((c) => cols.push({ wch: c.width }));
  cols.push({ wch: GAP_WIDTH });
  RIGHT_COLS.forEach((c) => cols.push({ wch: c.width }));
  ws["!cols"] = cols;

  ws["!merges"] = ws["!merges"] || [];
  ws["!rows"] = ws["!rows"] || [];

  // Row 0: SOURCE MILL (merged left) + FGC (merged right)
  ws["!merges"].push({ s: { r: 0, c: LEFT_START }, e: { r: 0, c: LEFT_END } });
  ws["!merges"].push({ s: { r: 0, c: RIGHT_START }, e: { r: 0, c: RIGHT_END } });
  styleCell(ws, 0, LEFT_START, {
    font: { bold: true, sz: 14, color: { rgb: "1E3A8A" } },
    alignment: { horizontal: "left", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: SRC_BLUE } },
    border: ALL_MEDIUM,
  });
  styleCell(ws, 0, RIGHT_START, {
    font: { bold: true, sz: 14, color: { rgb: "065F46" } },
    alignment: { horizontal: "right", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: FGC_GREEN } },
    border: ALL_MEDIUM,
  });
  ws["!rows"][0] = { hpt: 26 };

  // Row 1: title across full width
  ws["!merges"].push({ s: { r: 1, c: 0 }, e: { r: 1, c: TOTAL_COLS - 1 } });
  styleCell(ws, 1, 0, {
    font: { bold: true, sz: 18, color: { rgb: "111827" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: TITLE_BG } },
    border: ALL_MEDIUM,
  });
  ws["!rows"][1] = { hpt: 32 };

  // Row 2: dam label across full width
  ws["!merges"].push({ s: { r: 2, c: 0 }, e: { r: 2, c: TOTAL_COLS - 1 } });
  styleCell(ws, 2, 0, {
    font: { bold: true, sz: 12, color: { rgb: "111827" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: HEADER_GREY } },
    border: ALL_THIN,
  });
  ws["!rows"][2] = { hpt: 22 };

  // Header row styling
  for (let c = 0; c < TOTAL_COLS; c++) {
    if (c === GAP_COL) continue;
    const isLeft = c <= LEFT_END;
    const isInOutNett = c === IN_COL || c === OUT_COL || c === NETT_COL;
    let fill = isLeft ? SRC_BLUE : FGC_GREEN;
    if (isInOutNett) fill = "FEF3C7";
    styleCell(ws, headerRowIdx, c, {
      font: { bold: true, sz: 11, color: { rgb: "111827" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      fill: { patternType: "solid", fgColor: { rgb: fill } },
      border: ALL_MEDIUM,
    });
  }
  ws["!rows"][headerRowIdx] = { hpt: 36 };

  // Opening balance row
  ws["!merges"].push({ s: { r: openingRowIdx, c: LEFT_START }, e: { r: openingRowIdx, c: LEFT_END } });
  ws["!merges"].push({ s: { r: openingRowIdx, c: RIGHT_START }, e: { r: openingRowIdx, c: OUT_COL } });
  styleCell(ws, openingRowIdx, LEFT_START, {
    font: { bold: true, italic: true },
    alignment: { horizontal: "left", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: NETT_GREY } },
    border: ALL_THIN,
  });
  styleCell(ws, openingRowIdx, RIGHT_START, {
    font: { bold: true, italic: true },
    alignment: { horizontal: "right", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: NETT_GREY } },
    border: ALL_THIN,
  }, "Opening NETT →");
  styleCell(ws, openingRowIdx, NETT_COL, {
    font: { bold: true },
    alignment: { horizontal: "right", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: NETT_GREY } },
    border: ALL_MEDIUM,
    numFmt: "#,##0.000",
  });

  // Data rows styling
  for (let r = dataStart; r <= dataEnd; r++) {
    for (let c = 0; c < TOTAL_COLS; c++) {
      if (c === GAP_COL) continue;
      const ref = cellRef(r, c);
      if (!ws[ref]) ws[ref] = { t: "s", v: "" };
      const v = ws[ref].v;
      const isNumeric = typeof v === "number";
      if (isNumeric) ws[ref].t = "n";

      const inLeft = c <= LEFT_END;
      const inRight = c >= RIGHT_START && c <= RIGHT_END;
      const isIn = c === IN_COL;
      const isOut = c === OUT_COL;
      const isNett = c === NETT_COL;

      const border: any = { ...ALL_THIN };
      if (c === LEFT_END) border.right = MEDIUM;
      if (c === RIGHT_START) border.left = MEDIUM;
      if (c === RIGHT_END) border.right = MEDIUM;

      const style: any = {
        alignment: { horizontal: isNumeric ? "right" : "left", vertical: "center", wrapText: true },
        border,
        font: { sz: 10 },
      };

      // Number formats for mass/numeric cols
      if (inLeft && c >= LEFT_START + 7 && c <= LEFT_START + 10) style.numFmt = "#,##0.000";
      if (inRight && c >= RIGHT_START + 6 && c <= RIGHT_START + 10) style.numFmt = "#,##0.000";

      if (isIn) {
        style.numFmt = "#,##0.000";
        style.fill = { patternType: "solid", fgColor: { rgb: IN_GREEN } };
        style.font = { bold: true, sz: 10 };
      }
      if (isOut) {
        style.numFmt = "#,##0.000";
        style.fill = { patternType: "solid", fgColor: { rgb: OUT_RED } };
        style.font = { bold: true, sz: 10 };
      }
      if (isNett) {
        style.numFmt = "#,##0.000";
        style.fill = { patternType: "solid", fgColor: { rgb: NETT_GREY } };
        style.font = { bold: true, sz: 10 };
      }

      ws[ref].s = style;
    }
  }

  // Totals row
  ws["!merges"].push({ s: { r: totalsRowIdx, c: RIGHT_START }, e: { r: totalsRowIdx, c: IN_COL - 1 } });
  for (let c = 0; c < TOTAL_COLS; c++) {
    if (c === GAP_COL) continue;
    const isVal = c === IN_COL || c === OUT_COL || c === NETT_COL;
    let fill = c <= LEFT_END ? "F9FAFB" : "FEF3C7";
    if (c === IN_COL) fill = IN_GREEN;
    if (c === OUT_COL) fill = OUT_RED;
    if (c === NETT_COL) fill = NETT_GREY;
    styleCell(ws, totalsRowIdx, c, {
      font: { bold: true, sz: 12 },
      alignment: { horizontal: "right", vertical: "center" },
      fill: { patternType: "solid", fgColor: { rgb: fill } },
      border: ALL_MEDIUM,
      ...(isVal ? { numFmt: "#,##0.000" } : {}),
    });
  }

  // Style gap column (blank, no borders) for all rows used
  for (let r = 0; r <= totalsRowIdx; r++) {
    const ref = cellRef(r, GAP_COL);
    if (!ws[ref]) ws[ref] = { t: "s", v: "" };
    ws[ref].s = { fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } } };
  }

  ws["!freeze"] = { xSplit: 0, ySplit: headerRowIdx + 1 };

  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheet(dam.name));
}

function addSummarySheet(wb: XLSX.WorkBook, dams: Dam[], movements: Movement[]) {
  const aoa: any[][] = [];
  aoa.push(["MOLASSES RECORDS FOR FGC 2025/26 — SUMMARY", "", "", "", ""]);
  aoa.push([]);
  aoa.push(["Dam", "Opening (tons)", "IN (tons)", "OUT (tons)", "NETT (tons)"]);

  let tIn = 0, tOut = 0, tOpen = 0, tNett = 0;
  for (const d of dams) {
    const rows = movements.filter((m) => m.dam_id === d.id);
    let inSum = 0, outSum = 0;
    for (const m of rows) {
      const q = Number(m.quantity_tons) || 0;
      if (m.movement_type === "incoming") inSum += q; else outSum += q;
    }
    const opening = Number(d.current_volume_tons ?? 0);
    const nett = opening + inSum - outSum;
    aoa.push([d.name, opening, inSum, outSum, nett]);
    tOpen += opening; tIn += inSum; tOut += outSum; tNett += nett;
  }
  aoa.push([]);
  aoa.push(["TOTAL", tOpen, tIn, tOut, tNett]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

  styleCell(ws, 0, 0, {
    font: { bold: true, sz: 16 },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: TITLE_BG } },
    border: ALL_MEDIUM,
  });
  for (let c = 0; c < 5; c++) {
    styleCell(ws, 2, c, {
      font: { bold: true, sz: 11 },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { patternType: "solid", fgColor: { rgb: HEADER_GREY } },
      border: ALL_MEDIUM,
    });
  }
  for (let r = 3; r < 3 + dams.length; r++) {
    for (let c = 0; c < 5; c++) {
      const isNum = c >= 1;
      styleCell(ws, r, c, {
        alignment: { horizontal: isNum ? "right" : "left" },
        border: ALL_THIN,
        ...(isNum ? { numFmt: "#,##0.000" } : {}),
      });
    }
  }
  const tRow = 3 + dams.length + 1;
  for (let c = 0; c < 5; c++) {
    styleCell(ws, tRow, c, {
      font: { bold: true, sz: 12 },
      alignment: { horizontal: c === 0 ? "left" : "right" },
      fill: { patternType: "solid", fgColor: { rgb: "FEF3C7" } },
      border: ALL_MEDIUM,
      ...(c >= 1 ? { numFmt: "#,##0.000" } : {}),
    });
  }

  XLSX.utils.book_append_sheet(wb, ws, "Summary");
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
    addSummarySheet(wb, allDams, opts.movements);
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
