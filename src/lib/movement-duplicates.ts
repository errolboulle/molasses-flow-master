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

export async function findDuplicateMovementReference(form: Record<string, string>) {
  for (const field of duplicateFields) {
    const value = form[field]?.trim();
    if (!value) continue;
    const { data, error } = await supabase.from("movements").select("id").eq(field, value).limit(1);
    if (error) throw error;
    if (data && data.length > 0) return { field, label: duplicateFieldLabels[field] };
  }
  return null;
}

export function duplicateFieldFromDatabaseError(error: any) {
  const text = `${error?.message ?? ""} ${error?.details ?? ""}`;
  const entry = duplicateFields.find((field) => text.includes(field) || text.includes(`movements_unique_${field}`));
  return entry ? { field: entry, label: duplicateFieldLabels[entry] } : null;
}