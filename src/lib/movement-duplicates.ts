import { supabase } from "@/integrations/supabase/client";

export type DuplicateFieldName =
  | "src_delivery_note"
  | "fgc_consignment_note_number"
  | "fgc_zsm_weighbridge_number"
  | "src_mill_number"
  | "src_sample_number";

export const duplicateFieldLabels: Record<DuplicateFieldName, string> = {
  src_delivery_note: "Delivery Note",
  fgc_consignment_note_number: "Consignment Note Number",
  fgc_zsm_weighbridge_number: "ZSM Weighbridge Number",
  src_mill_number: "Mill Number",
  src_sample_number: "Sample Number",
};

const duplicateFields = Object.keys(duplicateFieldLabels) as DuplicateFieldName[];

const normalizeDuplicateValue = (value: string) => value.trim().toLowerCase();

export type DuplicateLocation = {
  damName?: string | null;
  date?: string | null;
  vehicle?: string | null;
};

export type DuplicateMatch = {
  field: DuplicateFieldName;
  label: string;
  value: string;
  location?: DuplicateLocation;
};

async function findExistingMatch(field: DuplicateFieldName, value: string): Promise<DuplicateMatch | null> {
  const { data, error } = await supabase
    .from("movements")
    .select(`id, ${field}, dam_id, fgc_date_of_arrival, src_date_of_departure, occurred_at, fgc_vehicle_registration, src_vehicle_registration, dams:dam_id(name)`)
    .eq(field, value)
    .limit(1);
  if (error) throw error;
  const row = (data as any[] | null)?.[0];
  if (!row) return null;
  return {
    field,
    label: duplicateFieldLabels[field],
    value,
    location: {
      damName: row.dams?.name ?? null,
      date: row.fgc_date_of_arrival ?? row.src_date_of_departure ?? (row.occurred_at ? String(row.occurred_at).slice(0, 10) : null),
      vehicle: row.fgc_vehicle_registration ?? row.src_vehicle_registration ?? null,
    },
  };
}

export async function checkDuplicateMovementField(field: DuplicateFieldName, rawValue: string): Promise<DuplicateMatch | null> {
  const value = rawValue.trim();
  if (!value) return null;
  return findExistingMatch(field, value);
}

export async function findDuplicateMovementReference(form: Record<string, string>): Promise<DuplicateMatch | null> {
  for (const field of duplicateFields) {
    const dup = await checkDuplicateMovementField(field, form[field] ?? "");
    if (dup) return dup;
  }
  return null;
}

export function formatDuplicateMessage(dup: DuplicateMatch): string {
  const loc = dup.location;
  const parts: string[] = [];
  if (loc?.damName) parts.push(loc.damName);
  if (loc?.date) parts.push(loc.date);
  if (loc?.vehicle) parts.push(`vehicle ${loc.vehicle}`);
  const where = parts.length ? ` — already in ${parts.join(", ")}` : "";
  return `Duplicate ${dup.label} "${dup.value}"${where}`;
}

export function duplicateFieldFromDatabaseError(error: any): { field: DuplicateFieldName; label: string } | null {
  const text = `${error?.message ?? ""} ${error?.details ?? ""}`;
  const entry = duplicateFields.find((field) => text.includes(field) || text.includes(duplicateFieldLabels[field]));
  return entry ? { field: entry, label: duplicateFieldLabels[entry] } : null;
}

export function extractDuplicateMessage(error: any): string | null {
  const msg = String(error?.message ?? "");
  if (msg.startsWith("Duplicate detected:")) return msg.replace(/^Duplicate detected:\s*/, "Duplicate ");
  return null;
}

export function isDuplicateError(error: any): boolean {
  const msg = String(error?.message ?? "");
  return msg.startsWith("Duplicate detected:");
}

/** Insert a movement bypassing the duplicate-check trigger (user approved). */
export async function forceInsertMovement(payload: Record<string, any>) {
  const { data, error } = await (supabase.rpc as any)("insert_movement_force", { payload });
  if (error) throw error;
  return data;
}
