import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { Movement, Dam } from "./types";

const HEADERS = [
  // Source mill (left)
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
  // FGC (right)
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

function buildRow(m: Movement) {
  const srcNet = calcNet(m.src_gross_mass, m.src_tare_mass, m.src_net_mass);
  const fgcNet = calcNet(m.fgc_gross_mass, m.fgc_tare_mass, m.fgc_net_mass);
  const variance = m.fgc_variance ?? (srcNet != null && fgcNet != null ? srcNet - fgcNet : null);
  return {
    ...m,
    src_net_mass: srcNet,
    fgc_net_mass: fgcNet,
    fgc_variance: variance,
  };
}

function addSheet(wb: ExcelJS.Workbook, dam: Dam, rows: Movement[]) {
  const ws = wb.addWorksheet(sanitizeSheet(dam.name));
  ws.columns = HEADERS.map((h) => ({ header: h.header, key: h.key, width: 18 }));
  rows.forEach((m) => ws.addRow(buildRow(m)));
  // Style header
  ws.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    c.alignment = { vertical: "middle", horizontal: "center" };
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

export async function exportMovementsToExcel(opts: {
  dams: Dam[];
  movements: Movement[];
  filename: string;
  perDamSheets: boolean;
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FGC Molasses Storage Manager";
  wb.created = new Date();

  if (opts.perDamSheets) {
    for (const dam of opts.dams) {
      const rows = opts.movements.filter((m) => m.dam_id === dam.id);
      addSheet(wb, dam, rows);
    }
  } else {
    // single dam expected
    const dam = opts.dams[0];
    if (!dam) return;
    const rows = opts.movements.filter((m) => m.dam_id === dam.id);
    addSheet(wb, dam, rows);
  }

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), opts.filename);
}
