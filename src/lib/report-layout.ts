import type { Dam, Movement } from "@/lib/types";

export const LEFT_COLS = [
  { header: "Date of Departure", width: 14 },
  { header: "Time", width: 8 },
  { header: "Vehicle Registration", width: 16 },
  { header: "Haulier", width: 16 },
  { header: "Delnote", width: 12 },
  { header: "Mill Number / Consign", width: 16 },
  { header: "Mill", width: 14 },
  { header: "Gross Mass", width: 12 },
  { header: "Tare Mass", width: 12 },
  { header: "Nett Mass", width: 12 },
  { header: "Molasses Temp", width: 12 },
  { header: "Sample Number", width: 12 },
];

export const RIGHT_COLS = [
  { header: "Arrival Date", width: 14 },
  { header: "Time", width: 8 },
  { header: "Vehicle Registration", width: 16 },
  { header: "Haulier", width: 16 },
  { header: "Consignment Number", width: 16 },
  { header: "ZSM Weighbridge No", width: 14 },
  { header: "Gross Mass", width: 12 },
  { header: "Tare Mass", width: 12 },
  { header: "Nett Mass", width: 12 },
  { header: "Variance", width: 10 },
  { header: "Brix", width: 8 },
  { header: "In / Out", width: 9 },
  { header: "ZSM Operator", width: 14 },
  { header: "If Out Haulier", width: 14 },
  { header: "IN", width: 11 },
  { header: "OUT", width: 11 },
  { header: "NETT", width: 13 },
];

export type ReportRow = { left: (string | number)[]; right: (string | number)[]; inVal: number; outVal: number; nett: number };

const num = (v: unknown): number | "" => {
  if (v == null || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
};

export function buildDamReportRows(dam: Dam, movements: Movement[]) {
  const sorted = [...movements].sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
  const opening = Number(dam.starting_balance_tons ?? 0);
  let nett = opening;
  let totalIn = 0;
  let totalOut = 0;

  const rows: ReportRow[] = sorted.map((m) => {
    const isIn = m.movement_type === "incoming";
    const qty = Number(m.quantity_tons) || 0;
    const inVal = isIn ? qty : 0;
    const outVal = isIn ? 0 : qty;
    nett = nett + inVal - outVal;
    totalIn += inVal;
    totalOut += outVal;

    return {
      inVal,
      outVal,
      nett,
      left: [
        m.src_date_of_departure || "",
        m.src_time || "",
        m.src_vehicle_registration || "",
        m.src_haulier || "",
        m.src_delivery_note || "",
        m.src_mill_number || "",
        m.src_mill || "",
        num(m.src_gross_mass),
        num(m.src_tare_mass),
        num(m.src_net_mass),
        num(m.src_molasses_temperature),
        m.src_sample_number || "",
      ],
      right: [
        m.fgc_date_of_arrival || "",
        m.fgc_time || "",
        m.fgc_vehicle_registration || "",
        m.fgc_haulier || "",
        m.fgc_consignment_note_number || "",
        m.fgc_zsm_weighbridge_number || "",
        num(m.fgc_gross_mass),
        num(m.fgc_tare_mass),
        num(m.fgc_net_mass),
        num(m.fgc_variance),
        num(m.fgc_brix),
        m.fgc_in_out || (isIn ? "IN" : "OUT"),
        m.fgc_zsm_operator || "",
        m.fgc_if_out_haulier || "",
        inVal || "",
        outVal || "",
        nett,
      ],
    };
  });

  return { opening, rows, totalIn, totalOut, closing: nett };
}

/**
 * Current on-hand tons for a dam, anchored on the latest adjustment.
 * If the dam has adjustments, use the most recent adjustment's new value
 * plus movements that occurred after that adjustment. Otherwise fall back
 * to starting balance + all movements.
 */
export function computeCurrentTons(dam: Dam, movements: Movement[], adjustments: { dam_id: string; new_volume_tons: number | string; created_at: string }[]): number {
  const damAdj = adjustments
    .filter((a) => a.dam_id === dam.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const damMoves = movements.filter((m) => m.dam_id === dam.id);
  if (damAdj.length === 0) return buildDamReportRows(dam, damMoves).closing;
  const anchor = damAdj[0];
  const anchorTs = new Date(anchor.created_at).getTime();
  let nett = Number(anchor.new_volume_tons);
  for (const m of damMoves) {
    if (new Date(m.occurred_at).getTime() <= anchorTs) continue;
    if (m.movement_type === "incoming") nett += Number(m.quantity_tons);
    else if (m.movement_type === "outgoing") nett -= Number(m.quantity_tons);
  }
  return nett;
}
