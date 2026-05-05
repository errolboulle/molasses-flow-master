import * as XLSX from "xlsx-js-style";
import type { Movement, Dam } from "./types";

// =============================================================================
// Excel export — mirrors the FGC 2025 Weighbridge & Dam Records template exactly
//
// Layout per dam sheet (30 columns, A..AD):
//   Row 1: Title "MOLASSES RECORDS FOR FGC 2025/26" merged A1:AA1
//   Row 2: A2 "DAM X" (red), C2 "TOTAL STORED MOLASSES =", G2:J2 merged formula
//   Row 3: A3:J3 "SOURCE MILL" | N3:AA3 "FGC Record" | AB3:AD3 "MOLASSES STORED"
//   Row 4: Headers (amber for source, blue for FGC + stored)
//   Row 5+: Data with live formulas (J=H-I, V=T-U, W=V-J, AB/AC IF, AD running)
//   Row N+1 (totals): AVERAGE / SUBTOTAL / SUM
//   Row N+2: labels  Row N+3..6: Allowable Variance + truck stats
// Column M is a thin spacer (width ~1.7).
// =============================================================================

const THIN = { style: "thin", color: { rgb: "000000" } } as const;
const MEDIUM = { style: "medium", color: { rgb: "000000" } } as const;
const ALL_THIN = { top: THIN, bottom: THIN, left: THIN, right: THIN };
const ALL_MEDIUM = { top: MEDIUM, bottom: MEDIUM, left: MEDIUM, right: MEDIUM };

// Template colours (sampled from the original workbook)
const SRC_AMBER = "FFC000";   // source mill header
const FGC_BLUE = "0070C0";    // FGC + MOLASSES STORED header
const HEADER_WHITE = "FFFFFF";
const SUBTOTAL_GREY = "D9D9D9";

const sanitizeSheet = (name: string) => name.replace(/[\\/?*[\]:]/g, "_").slice(0, 31);
const cellRef = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

// Column indices (0-based)
const COL = {
  // SOURCE MILL (A..L)
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9, K: 10, L: 11,
  // gap
  M: 12,
  // FGC (N..AA)
  N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19, U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25, AA: 26,
  // MOLASSES STORED (AB..AD)
  AB: 27, AC: 28, AD: 29,
};
const TOTAL_COLS = 30;

const COL_WIDTHS: Record<number, number> = {
  0: 14.3, 1: 7.4, 2: 14.7, 3: 7.4, 4: 11.6, 5: 14.6, 6: 13.3, 7: 9.1, 8: 8.1, 9: 12.1, 10: 11.1, 11: 11.0,
  12: 1.7,
  13: 14.3, 14: 7.4, 15: 17.1, 16: 8.7, 17: 13.9, 18: 10.4, 19: 8.4, 20: 8.1, 21: 16.0, 22: 13.6, 23: 8.0, 24: 6.1, 25: 14.9, 26: 7.0,
  27: 12.6, 28: 12.3, 29: 15.4,
};

const SRC_HEADERS = [
  "Date of Departure", "Time", "Vehicle Registration", "Haulier", "Del Note",
  "MILL NUMBER /CONSIGN", "Mill", "Gross Mass", "Tare Mass", "Nett Mass",
  "Molasses  Temp", "Sample Number",
];
const FGC_HEADERS = [
  "ARRIVAL DATE", "Time", "Vehicle Registration", "Haulier", "Consignment Note No/",
  "ZSM Weighbridge No", "Gross Mass", "Tare Mass", "Nettmass", "Variance",
  "BRIX", "IN/OUT", "ZSM Operator", "IF OUT, Haulier",
];
const STORED_HEADERS = ["IN", "OUT", "NETT"];

function setCell(ws: XLSX.WorkSheet, r: number, c: number, value: any, style?: any, formula?: string, numFmt?: string) {
  const ref = cellRef(r, c);
  const cell: any = {};
  if (formula) {
    cell.t = "n";
    cell.f = formula;
    if (value !== undefined) cell.v = value;
  } else if (value === undefined || value === null || value === "") {
    cell.t = "s";
    cell.v = "";
  } else if (typeof value === "number") {
    cell.t = "n";
    cell.v = value;
  } else if (value instanceof Date) {
    cell.t = "d";
    cell.v = value;
    if (!numFmt) numFmt = "yyyy-mm-dd";
  } else {
    cell.t = "s";
    cell.v = String(value);
  }
  cell.s = { ...(style || {}) };
  if (numFmt) cell.s.numFmt = numFmt;
  ws[ref] = cell;
}

function fmtTimeStr(v: any): string {
  if (!v) return "";
  // Accept Date/string; render HH:MM
  if (v instanceof Date) {
    return v.toTimeString().slice(0, 5);
  }
  const s = String(v);
  // ISO datetime -> take HH:MM
  const m = s.match(/T(\d{2}:\d{2})/);
  if (m) return m[1];
  // already HH:MM[:SS]
  const m2 = s.match(/^(\d{2}:\d{2})/);
  if (m2) return m2[1];
  return s;
}

function asDate(v: any): Date | "" {
  if (!v) return "";
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? "" : d;
}

function num(v: any): number | "" {
  if (v == null || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}

function addDamSheet(wb: XLSX.WorkBook, dam: Dam, movements: Movement[], damIndex: number) {
  const ws: XLSX.WorkSheet = {};
  const merges: XLSX.Range[] = [];
  const rowHeights: { hpt: number }[] = [];

  // Sort movements
  const sorted = [...movements].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );

  // ---------- Row 1: Title ----------
  setCell(ws, 0, 0, "       MOLASSES RECORDS FOR FGC 2025/26", {
    font: { bold: true, sz: 24, color: { rgb: "000000" } },
    alignment: { horizontal: "left", vertical: "center" },
  });
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 26 } });
  rowHeights[0] = { hpt: 31.5 };

  // ---------- Row 2: Dam name + total stored ----------
  const damLabel = `DAM ${damIndex + 1}`;
  setCell(ws, 1, 0, damLabel, {
    font: { bold: true, sz: 18, color: { rgb: "FF0000" } },
    alignment: { horizontal: "left", vertical: "center" },
  });
  setCell(ws, 1, 2, "TOTAL STORED MOLASSES =", {
    font: { bold: true, sz: 12 },
    alignment: { horizontal: "right", vertical: "center" },
  });
  // Placeholder formula to total NETT cell (filled below once we know last row)
  rowHeights[1] = { hpt: 23.25 };

  // ---------- Row 3: Section headers ----------
  setCell(ws, 2, COL.A, "SOURCE MILL", {
    font: { bold: true, sz: 16 },
    alignment: { horizontal: "center", vertical: "center" },
    border: ALL_THIN,
  });
  merges.push({ s: { r: 2, c: COL.A }, e: { r: 2, c: COL.J } });
  setCell(ws, 2, COL.N, "FGC Record", {
    font: { bold: true, sz: 16 },
    alignment: { horizontal: "center", vertical: "center" },
    border: ALL_THIN,
  });
  merges.push({ s: { r: 2, c: COL.N }, e: { r: 2, c: COL.AA } });
  setCell(ws, 2, COL.AB, "MOLASSES STORED", {
    font: { bold: true, sz: 16, color: { rgb: "FF0000" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: ALL_THIN,
  });
  merges.push({ s: { r: 2, c: COL.AB }, e: { r: 2, c: COL.AD } });
  rowHeights[2] = { hpt: 22.5 };

  // ---------- Row 4: Column headers ----------
  const headerStyleFor = (fillRgb: string) => ({
    font: { bold: true, sz: 11, color: { rgb: HEADER_WHITE } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    fill: { patternType: "solid", fgColor: { rgb: fillRgb } },
    border: ALL_MEDIUM,
  });
  SRC_HEADERS.forEach((h, i) => setCell(ws, 3, COL.A + i, h, headerStyleFor(SRC_AMBER)));
  FGC_HEADERS.forEach((h, i) => setCell(ws, 3, COL.N + i, h, headerStyleFor(FGC_BLUE)));
  STORED_HEADERS.forEach((h, i) => setCell(ws, 3, COL.AB + i, h, headerStyleFor(FGC_BLUE)));
  rowHeights[3] = { hpt: 45.75 };

  // ---------- Data rows (start at Excel row 5 → index 4) ----------
  const dataStart = 4;
  const opening = Number(dam.starting_balance_tons ?? 0);

  const dataStyle = (opts: { numFmt?: string; align?: string } = {}) => ({
    font: { sz: 10 },
    alignment: { horizontal: opts.align || "center", vertical: "center", wrapText: true },
    border: ALL_THIN,
    ...(opts.numFmt ? { numFmt: opts.numFmt } : {}),
  });

  sorted.forEach((m, idx) => {
    const r = dataStart + idx;
    const excelRow = r + 1;
    const isIn = m.movement_type === "incoming";

    // SOURCE (A..L)
    setCell(ws, r, COL.A, asDate(m.src_date_of_departure), dataStyle(), undefined, "yyyy-mm-dd");
    setCell(ws, r, COL.B, fmtTimeStr(m.src_time), dataStyle());
    setCell(ws, r, COL.C, m.src_vehicle_registration || "", dataStyle());
    setCell(ws, r, COL.D, m.src_haulier || "", dataStyle());
    setCell(ws, r, COL.E, m.src_delivery_note || "", dataStyle());
    setCell(ws, r, COL.F, m.src_mill_number || "", dataStyle());
    setCell(ws, r, COL.G, m.src_mill || "", dataStyle());
    setCell(ws, r, COL.H, num(m.src_gross_mass), dataStyle({ numFmt: "0.00", align: "right" }));
    setCell(ws, r, COL.I, num(m.src_tare_mass), dataStyle({ numFmt: "0.00", align: "right" }));
    // Nett Mass formula =H-I
    setCell(ws, r, COL.J, undefined, dataStyle({ numFmt: "0.00", align: "right" }), `H${excelRow}-I${excelRow}`);
    setCell(ws, r, COL.K, num(m.src_molasses_temperature), dataStyle({ numFmt: "0.0", align: "right" }));
    setCell(ws, r, COL.L, m.src_sample_number || "", dataStyle());

    // FGC (N..AA)
    setCell(ws, r, COL.N, asDate(m.fgc_date_of_arrival), dataStyle(), undefined, "yyyy-mm-dd");
    setCell(ws, r, COL.O, fmtTimeStr(m.fgc_time), dataStyle());
    setCell(ws, r, COL.P, m.fgc_vehicle_registration || "", dataStyle());
    setCell(ws, r, COL.Q, m.fgc_haulier || "", dataStyle());
    setCell(ws, r, COL.R, m.fgc_consignment_note_number || "", dataStyle());
    setCell(ws, r, COL.S, m.fgc_zsm_weighbridge_number || "", dataStyle());
    setCell(ws, r, COL.T, num(m.fgc_gross_mass), dataStyle({ numFmt: "0.00", align: "right" }));
    setCell(ws, r, COL.U, num(m.fgc_tare_mass), dataStyle({ numFmt: "0.00", align: "right" }));
    // Nettmass formula =T-U
    setCell(ws, r, COL.V, undefined, dataStyle({ numFmt: "0.00", align: "right" }), `T${excelRow}-U${excelRow}`);
    // Variance =V-J
    setCell(ws, r, COL.W, undefined, dataStyle({ numFmt: "0.00", align: "right" }), `V${excelRow}-J${excelRow}`);
    setCell(ws, r, COL.X, num(m.fgc_brix), dataStyle({ numFmt: "0.0", align: "right" }));
    setCell(ws, r, COL.Y, m.fgc_in_out || (isIn ? "in" : "out"), dataStyle());
    setCell(ws, r, COL.Z, m.fgc_zsm_operator || "", dataStyle());
    setCell(ws, r, COL.AA, m.fgc_if_out_haulier || "", dataStyle());

    // MOLASSES STORED (AB/AC/AD)
    setCell(ws, r, COL.AB, undefined, dataStyle({ numFmt: "0.00", align: "right" }), `IF(Y${excelRow}="In",V${excelRow},0)`);
    setCell(ws, r, COL.AC, undefined, dataStyle({ numFmt: "0.00", align: "right" }), `IF(Y${excelRow}="Out",V${excelRow},0)`);
    // NETT cumulative — first row uses opening balance
    const nettFormula = idx === 0
      ? `${opening}+AB${excelRow}-AC${excelRow}`
      : `AD${excelRow - 1}+AB${excelRow}-AC${excelRow}`;
    setCell(ws, r, COL.AD, undefined, dataStyle({ numFmt: "0.00", align: "right" }), nettFormula);
  });

  const lastDataRow = dataStart + Math.max(sorted.length - 1, 0); // 0-indexed
  const totalsRowIdx = lastDataRow + 1; // one row right after last data
  const labelRowIdx = totalsRowIdx + 1;
  const allowanceRowIdx = labelRowIdx + 1;
  const truckRowsStart = allowanceRowIdx + 1;

  // If no data rows, still place totals at row 5 (idx 4)
  const totalsRow = sorted.length === 0 ? 4 : totalsRowIdx;
  const totalsExcel = totalsRow + 1;
  const firstDataExcel = dataStart + 1;
  const lastDataExcel = sorted.length === 0 ? firstDataExcel : lastDataRow + 1;

  // ---------- Totals row (AVERAGE / SUBTOTAL / SUM) ----------
  const totalStyle = {
    font: { bold: true, sz: 11, color: { rgb: "FF0000" } },
    alignment: { horizontal: "right", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: SUBTOTAL_GREY } },
    border: ALL_MEDIUM,
    numFmt: "0.00",
  };
  if (sorted.length > 0) {
    setCell(ws, totalsRow, COL.H, undefined, totalStyle, `AVERAGE(H${firstDataExcel}:H${lastDataExcel})`);
    setCell(ws, totalsRow, COL.I, undefined, totalStyle, `AVERAGE(I${firstDataExcel}:I${lastDataExcel})`);
    setCell(ws, totalsRow, COL.J, undefined, totalStyle, `SUBTOTAL(9,J${firstDataExcel}:J${lastDataExcel})`);
    setCell(ws, totalsRow, COL.T, undefined, totalStyle, `AVERAGE(T${firstDataExcel}:T${lastDataExcel})`);
    setCell(ws, totalsRow, COL.U, undefined, totalStyle, `AVERAGE(U${firstDataExcel}:U${lastDataExcel})`);
    setCell(ws, totalsRow, COL.V, undefined, totalStyle, `SUBTOTAL(9,V${firstDataExcel}:V${lastDataExcel})`);
    setCell(ws, totalsRow, COL.W, undefined, totalStyle, `SUBTOTAL(9,W${firstDataExcel}:W${lastDataExcel})`);
    setCell(ws, totalsRow, COL.X, undefined, totalStyle, `AVERAGE(X${firstDataExcel}:X${lastDataExcel})`);
    setCell(ws, totalsRow, COL.AB, undefined, totalStyle, `SUM(AB${firstDataExcel}:AB${lastDataExcel})`);
    setCell(ws, totalsRow, COL.AC, undefined, totalStyle, `SUM(AC${firstDataExcel}:AC${lastDataExcel})`);
    setCell(ws, totalsRow, COL.AD, undefined, totalStyle, `AB${totalsExcel}-AC${totalsExcel}`);
  }

  // Fill row 2 G2:J2 total formula
  setCell(ws, 1, COL.G, undefined, {
    font: { bold: true, sz: 14, color: { rgb: "FF0000" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: ALL_MEDIUM,
    numFmt: "#,##0.00",
  }, sorted.length > 0 ? `AD${totalsExcel}` : `${opening}`);
  merges.push({ s: { r: 1, c: COL.G }, e: { r: 1, c: COL.J } });

  // ---------- Label row (Average / Total / Allowable Variance) ----------
  const labelStyle = {
    font: { bold: true, sz: 11, color: { rgb: "002060" } },
    alignment: { horizontal: "center", vertical: "center" },
  };
  setCell(ws, labelRowIdx, COL.H, "Average", labelStyle);
  setCell(ws, labelRowIdx, COL.I, "Average", labelStyle);
  setCell(ws, labelRowIdx, COL.J, "Total", labelStyle);
  setCell(ws, labelRowIdx, COL.T, "Average", labelStyle);
  setCell(ws, labelRowIdx, COL.U, "Average", labelStyle);
  setCell(ws, labelRowIdx, COL.V, "Total", labelStyle);
  setCell(ws, labelRowIdx, COL.W, "Total", labelStyle);
  setCell(ws, labelRowIdx, COL.X, "Average", labelStyle);
  setCell(ws, labelRowIdx, COL.Z, "Allowable Varience", labelStyle);
  setCell(ws, labelRowIdx, COL.AA, 0.005, { ...labelStyle, numFmt: "0.000" });
  setCell(ws, labelRowIdx, COL.AB, undefined, { ...labelStyle, numFmt: "0.00" }, `AB${totalsExcel}*AA${labelRowIdx + 1}`);

  // ---------- Allowable Variance line + Truck stats (left side & right side) ----------
  setCell(ws, allowanceRowIdx, COL.H, "Allowable Varience", labelStyle);
  setCell(ws, allowanceRowIdx, COL.I, 0.005, { ...labelStyle, numFmt: "0.000" });
  setCell(ws, allowanceRowIdx, COL.J, undefined, { ...labelStyle, numFmt: "0.00" }, `J${totalsExcel}*I${allowanceRowIdx + 1}`);

  // Truck stats block (Z..AB)
  setCell(ws, allowanceRowIdx, COL.Z, "Ave truck in", labelStyle);
  setCell(ws, allowanceRowIdx, COL.AB, undefined, { ...labelStyle, numFmt: "0.00" }, `IFERROR(AB${totalsExcel}/AB${truckRowsStart + 1},0)`);

  setCell(ws, truckRowsStart, COL.Z, "No of trucks in", labelStyle);
  setCell(ws, truckRowsStart, COL.AB, undefined, labelStyle, `COUNTIF(Y${firstDataExcel}:Y${lastDataExcel},"in")`);

  setCell(ws, truckRowsStart + 1, COL.Z, "No of Trucks out", labelStyle);
  setCell(ws, truckRowsStart + 1, COL.AB, undefined, labelStyle, `COUNTIF(Y${firstDataExcel}:Y${lastDataExcel},"out")`);

  setCell(ws, truckRowsStart + 2, COL.Z, "Ave truck out", labelStyle);
  setCell(ws, truckRowsStart + 2, COL.AB, undefined, { ...labelStyle, numFmt: "0.00" }, `IFERROR(AC${totalsExcel}/AB${truckRowsStart + 2},0)`);

  // ---------- Sheet metadata ----------
  ws["!ref"] = `A1:${cellRef(truckRowsStart + 2, COL.AD)}`;
  ws["!cols"] = Array.from({ length: TOTAL_COLS }, (_, i) => ({ wch: COL_WIDTHS[i] ?? 10 }));
  ws["!rows"] = rowHeights;
  ws["!merges"] = merges;
  ws["!freeze"] = { xSplit: 0, ySplit: 4 };

  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheet(dam.name));
}

function addSummarySheet(wb: XLSX.WorkBook, dams: Dam[]) {
  const headers = [
    "", "Source Mill", "In ZSM", "Out Anchor", "Out ZSM",
    "Balance Anc.", "Balance ZSM", "Varience in", "Varience out", "Allowable varience",
  ];
  const ws: XLSX.WorkSheet = {};
  const headerStyle = {
    font: { bold: true, sz: 11 },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: "D9D9D9" } },
    border: ALL_MEDIUM,
  };
  headers.forEach((h, i) => setCell(ws, 0, i, h, headerStyle));

  const cellStyle = { font: { sz: 11 }, alignment: { horizontal: "right" }, border: ALL_THIN, numFmt: "#,##0.00" };
  const labelStyle = { font: { bold: true, sz: 11 }, alignment: { horizontal: "left" }, border: ALL_THIN };

  dams.forEach((d, idx) => {
    const r = idx + 1;
    const sheet = `'${sanitizeSheet(d.name)}'`;
    setCell(ws, r, 0, d.name, labelStyle);
    setCell(ws, r, 1, undefined, cellStyle, `IFERROR(${sheet}!J5:J10000,0)`); // placeholder; replaced below safer
    // Safer: reference the totals NETT (AD column total) via SUM of in/out
    // We'll compute from sheet via simple SUM ranges to avoid hardcoding totals row index.
    setCell(ws, r, 1, undefined, cellStyle, `SUM(${sheet}!J5:J10000)`);
    setCell(ws, r, 2, undefined, cellStyle, `SUM(${sheet}!AB5:AB10000)/2`); // /2 because totals row also gets summed
    // Correct approach: exclude totals row by using fixed range for data only — but row count varies.
    // Use SUMIF on column Y instead for IN/OUT to be robust.
    setCell(ws, r, 2, undefined, cellStyle, `SUMIF(${sheet}!Y5:Y10000,"in",${sheet}!V5:V10000)`);
    setCell(ws, r, 4, undefined, cellStyle, `SUMIF(${sheet}!Y5:Y10000,"out",${sheet}!V5:V10000)`);
    setCell(ws, r, 5, undefined, cellStyle, `B${r + 1}-D${r + 1}`);
    setCell(ws, r, 6, undefined, cellStyle, `C${r + 1}-E${r + 1}`);
    setCell(ws, r, 7, undefined, cellStyle, `B${r + 1}-C${r + 1}`);
    setCell(ws, r, 8, undefined, cellStyle, `D${r + 1}-E${r + 1}`);
    setCell(ws, r, 9, undefined, cellStyle, `C${r + 1}*0.005`);
  });

  const tRow = dams.length + 1;
  const totalStyle = { ...cellStyle, font: { bold: true, sz: 11 }, fill: { patternType: "solid", fgColor: { rgb: "FEF3C7" } } };
  setCell(ws, tRow, 0, "Total", { ...labelStyle, font: { bold: true, sz: 11 } });
  for (let c = 1; c <= 9; c++) {
    if (c === 7 || c === 8 || c === 9) {
      const colLetter = XLSX.utils.encode_col(c);
      if (c === 7) setCell(ws, tRow, c, undefined, totalStyle, `B${tRow + 1}-C${tRow + 1}`);
      else if (c === 8) setCell(ws, tRow, c, undefined, totalStyle, `D${tRow + 1}-E${tRow + 1}`);
      else setCell(ws, tRow, c, undefined, totalStyle, `C${tRow + 1}*0.005`);
      void colLetter;
    } else {
      const colLetter = XLSX.utils.encode_col(c);
      setCell(ws, tRow, c, undefined, totalStyle, `SUM(${colLetter}2:${colLetter}${tRow})`);
    }
  }

  ws["!ref"] = `A1:J${tRow + 1}`;
  ws["!cols"] = [{ wch: 14 }, ...Array(9).fill({ wch: 13 })];
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
    allDams.forEach((dam, idx) => {
      const rows = opts.movements.filter((m) => m.dam_id === dam.id);
      addDamSheet(wb, dam, rows, idx);
    });
    addSummarySheet(wb, allDams);
    if (allDams.length === 0) {
      const ws = XLSX.utils.aoa_to_sheet([["No data"]]);
      XLSX.utils.book_append_sheet(wb, ws, "Movements");
    }
  } else {
    const dam = opts.dams[0];
    if (!dam) throw new Error("No dam selected");
    const rows = opts.movements.filter((m) => m.dam_id === dam.id);
    const idx = Math.max(0, allDams.findIndex((d) => d.id === dam.id));
    addDamSheet(wb, dam, rows, idx);
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array", cellDates: true });
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
