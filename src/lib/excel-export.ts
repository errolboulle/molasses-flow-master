import * as XLSX from "xlsx";
import type { Movement, Dam } from "./types";

const HEADERS: { key: keyof Movement | "fgc_variance_calc"; header: string }[] = [
  { key: "src_date_of_departure", header: "Date of Departure" },
  { key: "src_time", header: "Time" },
  { key: "src_vehicle_registration", header: "Vehicle Registration" },
  { key: "src_haulier", header: "Haulier" },
  { key: "src_delivery_note", header: "Delivery Note" },
  { key: "src_mill_number", header: "Mill Number" },
  { key: "src_mill", header: "Mill" },
  { key: "src_gross_mass", header: "Source Gross Mass" },
  { key: "src_tare_mass", header: "Source Tare Mass" },
  { key: "src_net_mass", header: "Source Net Mass" },
  { key: "src_molasses_temperature", header: "Molasses Temperature" },
  { key: "src_sample_number", header: "Sample Number" },
  { key: "fgc_date_of_arrival", header: "Date of Arrival" },
  { key: "fgc_time", header: "Time" },
  { key: "fgc_vehicle_registration", header: "Vehicle Registration" },
  { key: "fgc_haulier", header: "Haulier" },
  { key: "fgc_consignment_note_number", header: "Consignment Note Number" },
  { key: "fgc_zsm_weighbridge_number", header: "ZSM Weighbridge Number" },
  { key: "fgc_gross_mass", header: "FGC Gross Mass" },
  { key: "fgc_tare_mass", header: "FGC Tare Mass" },
  { key: "fgc_net_mass", header: "FGC Net Mass" },
  { key: "fgc_variance", header: "Variance (Source − FGC)" },
  { key: "fgc_brix", header: "Brix" },
  { key: "fgc_in_out", header: "In/Out" },
  { key: "fgc_zsm_operator", header: "ZSM Operator" },
  { key: "fgc_if_out_haulier", header: "If Out Haulier" },
  { key: "fgc_in", header: "In" },
  { key: "fgc_out", header: "Out" },
  { key: "fgc_net", header: "Net" },
];

const sanitizeSheet = (name: string) => name.replace(/[\\/?*\[\]:]/g, "_").slice(0, 31);

function calcNet(gross: any, tare: any, fallback: any): number | null {
  if (fallback != null) return Number(fallback);
  const g = Number(gross), t = Number(tare);
  if (!isNaN(g) && !isNaN(t)) return g - t;
  return null;
}

function buildRow(m: Movement): Record<string, any> {
  const srcNet = calcNet(m.src_gross_mass, m.src_tare_mass, m.src_net_mass);
  const fgcNet = calcNet(m.fgc_gross_mass, m.fgc_tare_mass, m.fgc_net_mass);
  const variance = m.fgc_variance ?? (srcNet != null && fgcNet != null ? srcNet - fgcNet : null);
  const enriched: any = { ...m, src_net_mass: srcNet, fgc_net_mass: fgcNet, fgc_variance: variance };
  const row: Record<string, any> = {};
  for (const h of HEADERS) {
    const v = enriched[h.key as string];
    row[h.header] = v ?? "";
  }
  return row;
}

function addSheet(wb: XLSX.WorkBook, dam: Dam, rows: Movement[]) {
  const data = rows.map(buildRow);
  const ws = XLSX.utils.json_to_sheet(data, { header: HEADERS.map((h) => h.header) });
  ws["!cols"] = HEADERS.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheet(dam.name));
}

export async function exportMovementsToExcel(opts: {
  dams: Dam[];
  movements: Movement[];
  filename: string;
  perDamSheets: boolean;
}) {
  const wb = XLSX.utils.book_new();

  if (opts.perDamSheets) {
    for (const dam of opts.dams) {
      const rows = opts.movements.filter((m) => m.dam_id === dam.id);
      addSheet(wb, dam, rows);
    }
    if (opts.dams.length === 0) {
      const ws = XLSX.utils.json_to_sheet([], { header: HEADERS.map((h) => h.header) });
      XLSX.utils.book_append_sheet(wb, ws, "Movements");
    }
  } else {
    const dam = opts.dams[0];
    if (!dam) throw new Error("No dam selected");
    const rows = opts.movements.filter((m) => m.dam_id === dam.id);
    addSheet(wb, dam, rows);
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    opts.filename,
  );
}
