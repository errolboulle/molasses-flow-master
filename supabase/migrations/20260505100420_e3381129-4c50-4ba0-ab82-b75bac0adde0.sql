CREATE OR REPLACE FUNCTION public.prevent_duplicate_movement_references()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  duplicate_label text;
  duplicate_value text;
  existing_row public.movements;
  existing_dam text;
BEGIN
  SELECT label, field_value INTO duplicate_label, duplicate_value
  FROM (
    VALUES
      ('Delivery Note', 'src_delivery_note', NEW.src_delivery_note),
      ('Consignment Note Number', 'fgc_consignment_note_number', NEW.fgc_consignment_note_number),
      ('ZSM Weighbridge Number', 'fgc_zsm_weighbridge_number', NEW.fgc_zsm_weighbridge_number),
      ('Mill Number', 'src_mill_number', NEW.src_mill_number),
      ('Sample Number', 'src_sample_number', NEW.src_sample_number)
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
          WHEN 'src_mill_number' THEN lower(trim(existing.src_mill_number)) = lower(trim(checked_fields.field_value))
          WHEN 'src_sample_number' THEN lower(trim(existing.src_sample_number)) = lower(trim(checked_fields.field_value))
          ELSE false
        END
    )
  LIMIT 1;

  IF duplicate_label IS NOT NULL THEN
    -- find one existing match to report location
    SELECT * INTO existing_row FROM public.movements existing
    WHERE existing.id IS DISTINCT FROM NEW.id
      AND (
        (duplicate_label = 'Delivery Note' AND lower(trim(existing.src_delivery_note)) = lower(trim(duplicate_value))) OR
        (duplicate_label = 'Consignment Note Number' AND lower(trim(existing.fgc_consignment_note_number)) = lower(trim(duplicate_value))) OR
        (duplicate_label = 'ZSM Weighbridge Number' AND lower(trim(existing.fgc_zsm_weighbridge_number)) = lower(trim(duplicate_value))) OR
        (duplicate_label = 'Mill Number' AND lower(trim(existing.src_mill_number)) = lower(trim(duplicate_value))) OR
        (duplicate_label = 'Sample Number' AND lower(trim(existing.src_sample_number)) = lower(trim(duplicate_value)))
      )
    LIMIT 1;

    SELECT name INTO existing_dam FROM public.dams WHERE id = existing_row.dam_id;

    RAISE EXCEPTION 'Duplicate detected: % "%" already exists in % on % (vehicle %)',
      duplicate_label, duplicate_value,
      COALESCE(existing_dam, 'another dam'),
      COALESCE(existing_row.fgc_date_of_arrival::text, existing_row.src_date_of_departure::text, existing_row.occurred_at::date::text),
      COALESCE(existing_row.fgc_vehicle_registration, existing_row.src_vehicle_registration, '?');
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS movements_prevent_duplicate_references ON public.movements;
CREATE TRIGGER movements_prevent_duplicate_references
BEFORE INSERT OR UPDATE ON public.movements
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_movement_references();