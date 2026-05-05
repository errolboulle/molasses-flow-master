CREATE OR REPLACE FUNCTION public.prevent_duplicate_movement_references()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  duplicate_label text;
BEGIN
  SELECT label INTO duplicate_label
  FROM (
    VALUES
      ('Delivery Note', 'src_delivery_note', NEW.src_delivery_note),
      ('Consignment Note Number', 'fgc_consignment_note_number', NEW.fgc_consignment_note_number),
      ('ZSM Weighbridge Number', 'fgc_zsm_weighbridge_number', NEW.fgc_zsm_weighbridge_number)
  ) AS checked_fields(label, field_name, field_value)
  WHERE NULLIF(TRIM(field_value), '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.movements existing
      WHERE existing.id IS DISTINCT FROM NEW.id
        AND CASE checked_fields.field_name
          WHEN 'src_delivery_note' THEN lower(trim(existing.src_delivery_note)) = lower(trim(checked_fields.field_value))
          WHEN 'fgc_consignment_note_number' THEN lower(trim(existing.fgc_consignment_note_number)) = lower(trim(checked_fields.field_value))
          WHEN 'fgc_zsm_weighbridge_number' THEN lower(trim(existing.fgc_zsm_weighbridge_number)) = lower(trim(checked_fields.field_value))
          ELSE false
        END
    )
  LIMIT 1;

  IF duplicate_label IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate detected: % already exists', duplicate_label;
  END IF;

  RETURN NEW;
END;
$function$;