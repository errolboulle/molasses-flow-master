import { supabase } from "@/integrations/supabase/client";

export type DuplicateFieldName =
  | "src_delivery_note"
  | "src_mill_number"
  | "src_sample_number"
  | "fgc_consignment_note_number"
  | "fgc_zsm_weighbridge_number";

export const duplicateFieldLabels: Record<DuplicateFieldName, string> = {
  src_delivery_note: "Delivery Note",
  src_mill_number: "Mill Number",
  src_sample_number: "Sample Number",
  fgc_consignment_note_number: "Consignment Note Number",
  fgc_zsm_weighbridge_number: "ZSM Weighbridge Number",
};

const duplicateFields = Object.keys(duplicateFieldLabels) as DuplicateFieldName[];

const normalizeDuplicateValue = (value: string) => value.trim().toLowerCase();

const escapeLikeValue = (value: string) => value.replace(/[\\%_]/g, (match) => `\\${match}`);

export async function checkDuplicateMovementField(field: DuplicateFieldName, rawValue: string) {
  const value = rawValue.trim();
  if (!value) return null;

  const { data, error } = await supabase
    .from("movements")
    .select(`id, ${field}`)
    .ilike(field, `%${escapeLikeValue(value)}%`)
    .limit(10);

  if (error) throw error;

  const normalized = normalizeDuplicateValue(value);
  const exists = (data as Array<Record<string, string | null>> | null)?.some((row) => normalizeDuplicateValue(row[field] ?? "") === normalized);
  return exists ? { field, label: duplicateFieldLabels[field] } : null;
}

export async function findDuplicateMovementReference(form: Record<string, string>) {
  for (const field of duplicateFields) {
    const duplicate = await checkDuplicateMovementField(field, form[field] ?? "");
    if (duplicate) return duplicate;
  }
  return null;
}

export function duplicateFieldFromDatabaseError(error: any) {
  const text = `${error?.message ?? ""} ${error?.details ?? ""}`;
  const entry = duplicateFields.find((field) => text.includes(field) || text.includes(`movements_unique_${field}`));
  return entry ? { field: entry, label: duplicateFieldLabels[entry] } : null;
}