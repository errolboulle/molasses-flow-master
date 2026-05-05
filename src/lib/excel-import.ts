import * as XLSX from "xlsx";
import { LEFT_COLS, RIGHT_COLS } from "./report-layout";
import type { Dam } from "./types";

// Layout (matches excel-export.ts)
const LEFT_START = 0;
const LEFT_END = LEFT_COLS.length - 1;        // 11
const GAP_COL = LEFT_END + 1;                  // 12
const RIGHT_START = GAP_COL + 1;               // 13
const RIGHT_END = RIGHT_START + RIGHT_COLS.length - 1; // 29

// Header row in exported file is row index 4 (0-based). Data starts at row 6
// (row 5 is "Opening Balance"). We tolerate variation by detecting the header row.

export type ParsedRow = {
  damId: string;
  damName: string;
  sheetRow: number; // 1-based row number for user reference
  movementType: "incoming" | "outgoing";
  // SOURCE MILL
  src_date_of_departure: string | null;
  src_time: string | null;
  src_vehicle_registration: string | null;
  src_haulier: string | null;
  src_delivery_note: string | null;
  src_mill_number: string | null;
  src_mill: string | null;
  src_gross_mass: number | null;
  src_tare_mass: number | null;
  src_net_mass: number | null;
  src_molasses_temperature: number | null;
  src_sample_number: string | null;
  // FGC
  fgc_date_of_arrival: string | null;
  fgc_time: string | null;
  fgc_vehicle_registration: string | null;
  fgc_haulier: string | null;
  fgc_consignment_note_number: string | null;
  fgc_zsm_weighbridge_number: string | null;
  fgc_gross_mass: number | null;
  fgc_tare_mass: number | null;
  fgc_net_mass: number;
  fgc_variance: number | null;
  fgc_brix: number | null;
  fgc_in_out: string | null;
  fgc_zsm_operator: string | null;
};

export type ParseResult = {
  rows: ParsedRow[];
  warnings: string[];
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const toStr = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim() || null;
};

const toNum = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

// Excel date serial → ISO date string (YYYY-MM-DD)
const toDateStr = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel epoch: 1899-12-30
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (Number.isFinite(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
};

const toTimeStr = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toTimeString().slice(0, 8);
  if (typeof v === "number" && v >= 0 && v < 1) {
    const total = Math.round(v * 86400);
    const h = String(Math.floor(total / 3600)).padStart(2, "0");
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }
  return String(v).trim() || null;
};

function findHeaderRow(aoa: any[][]): number {
  for (let r = 0; r < Math.min(aoa.length, 20); r++) {
    const row = aoa[r] || [];
    const cells = row.map((c) => norm(String(c ?? "")));
    if (cells.includes("dateofdeparture") && cells.includes("nett")) return r;
  }
  return -1;
}

function matchDam(sheetName: string, dams: Dam[]): Dam | null {
  const n = norm(sheetName);
  // exact match first
  let dam = dams.find((d) => norm(d.name) === n);
  if (dam) return dam;
  // partial match (e.g. "Dam 1" sheet with "Dam 1 - North" name)
  dam = dams.find((d) => n.includes(norm(d.name)) || norm(d.name).includes(n));
  return dam ?? null;
}

export function parseExcelImport(buf: ArrayBuffer, dams: Dam[]): ParseResult {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const rows: ParsedRow[] = [];
  const warnings: string[] = [];

  for (const sheetName of wb.SheetNames) {
    if (sheetName.toLowerCase() === "summary") continue;
    const dam = matchDam(sheetName, dams);
    if (!dam) {
      warnings.push(`Sheet "${sheetName}" — no matching dam found, skipped.`);
      continue;
    }
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null });
    const headerRow = findHeaderRow(aoa);
    if (headerRow < 0) {
      warnings.push(`Sheet "${sheetName}" — could not locate header row, skipped.`);
      continue;
    }

    const IN_COL = RIGHT_END - 2;
    const OUT_COL = RIGHT_END - 1;

    for (let r = headerRow + 1; r < aoa.length; r++) {
      const row = aoa[r] || [];
      // Skip opening balance / totals / blank rows
      const firstCell = String(row[LEFT_START] ?? "").toLowerCase();
      if (firstCell.includes("opening")) continue;
      if (String(row[RIGHT_START] ?? "").toLowerCase().includes("total")) continue;

      const fgcNet = toNum(row[RIGHT_START + 8]); // Nett Mass (FGC)
      const inVal = toNum(row[IN_COL]);
      const outVal = toNum(row[OUT_COL]);
      const inOutLabel = toStr(row[RIGHT_START + 11]);

      if (!fgcNet || fgcNet <= 0) continue; // empty / non-data row

      // Skip totals/summary rows: real movement rows always have a date and at least
      // one reference number. Summary rows (Total / Average) have only numeric aggregates.
      const srcDate = toDateStr(row[LEFT_START + 0]);
      const fgcDate = toDateStr(row[RIGHT_START + 0]);
      const delNote = toStr(row[LEFT_START + 4]);
      const millNo = toStr(row[LEFT_START + 5]);
      const consignNo = toStr(row[RIGHT_START + 4]);
      const weighNo = toStr(row[RIGHT_START + 5]);
      const hasDate = !!(srcDate || fgcDate);
      const hasRef = !!(delNote || millNo || consignNo || weighNo);
      if (!hasDate || !hasRef) {
        warnings.push(`${sheetName} row ${r + 1}: skipped (looks like a totals/summary row, no date or reference).`);
        continue;
      }

      let movementType: "incoming" | "outgoing" | null = null;
      if (inVal && inVal > 0) movementType = "incoming";
      else if (outVal && outVal > 0) movementType = "outgoing";
      else if (inOutLabel) {
        const t = inOutLabel.toLowerCase();
        if (t.startsWith("in")) movementType = "incoming";
        else if (t.startsWith("out")) movementType = "outgoing";
      }
      if (!movementType) {
        warnings.push(`${sheetName} row ${r + 1}: could not determine IN/OUT, skipped.`);
        continue;
      }

      rows.push({
        damId: dam.id,
        damName: dam.name,
        sheetRow: r + 1,
        movementType,
        src_date_of_departure: toDateStr(row[LEFT_START + 0]),
        src_time: toTimeStr(row[LEFT_START + 1]),
        src_vehicle_registration: toStr(row[LEFT_START + 2]),
        src_haulier: toStr(row[LEFT_START + 3]),
        src_delivery_note: toStr(row[LEFT_START + 4]),
        src_mill_number: toStr(row[LEFT_START + 5]),
        src_mill: toStr(row[LEFT_START + 6]),
        src_gross_mass: toNum(row[LEFT_START + 7]),
        src_tare_mass: toNum(row[LEFT_START + 8]),
        src_net_mass: toNum(row[LEFT_START + 9]),
        src_molasses_temperature: toNum(row[LEFT_START + 10]),
        src_sample_number: toStr(row[LEFT_START + 11]),
        fgc_date_of_arrival: toDateStr(row[RIGHT_START + 0]),
        fgc_time: toTimeStr(row[RIGHT_START + 1]),
        fgc_vehicle_registration: toStr(row[RIGHT_START + 2]),
        fgc_haulier: toStr(row[RIGHT_START + 3]),
        fgc_consignment_note_number: toStr(row[RIGHT_START + 4]),
        fgc_zsm_weighbridge_number: toStr(row[RIGHT_START + 5]),
        fgc_gross_mass: toNum(row[RIGHT_START + 6]),
        fgc_tare_mass: toNum(row[RIGHT_START + 7]),
        fgc_net_mass: fgcNet,
        fgc_variance: toNum(row[RIGHT_START + 9]),
        fgc_brix: toNum(row[RIGHT_START + 10]),
        fgc_in_out: inOutLabel,
        fgc_zsm_operator: toStr(row[RIGHT_START + 12]),
      });
    }
  }

  return { rows, warnings };
}

const DUP_FIELDS = [
  "src_delivery_note",
  "src_mill_number",
  "src_sample_number",
  "fgc_consignment_note_number",
  "fgc_zsm_weighbridge_number",
] as const;

export type DuplicateInfo = { field: string; value: string };

export function findExistingDuplicates(
  rows: ParsedRow[],
  existing: Array<Record<string, any>>,
): Map<number, DuplicateInfo> {
  // Build lookup sets per field
  const sets: Record<string, Set<string>> = {};
  for (const f of DUP_FIELDS) sets[f] = new Set();
  for (const m of existing) {
    for (const f of DUP_FIELDS) {
      const v = m[f];
      if (v != null && String(v).trim() !== "") {
        sets[f].add(String(v).trim().toLowerCase());
      }
    }
  }
  const result = new Map<number, DuplicateInfo>();
  rows.forEach((r, idx) => {
    for (const f of DUP_FIELDS) {
      const v = (r as any)[f];
      if (v != null && String(v).trim() !== "") {
        const key = String(v).trim().toLowerCase();
        if (sets[f].has(key)) {
          result.set(idx, { field: f, value: String(v) });
          return;
        }
      }
    }
  });
  // Also detect duplicates within the file itself
  const seen: Record<string, Set<string>> = {};
  for (const f of DUP_FIELDS) seen[f] = new Set();
  rows.forEach((r, idx) => {
    if (result.has(idx)) return;
    for (const f of DUP_FIELDS) {
      const v = (r as any)[f];
      if (v != null && String(v).trim() !== "") {
        const key = String(v).trim().toLowerCase();
        if (seen[f].has(key)) {
          result.set(idx, { field: f, value: String(v) });
          return;
        }
        seen[f].add(key);
      }
    }
  });
  return result;
}
