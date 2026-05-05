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
  skip_flag text;
BEGIN
  -- Allow callers to opt out of the duplicate check (e.g. user has approved
  -- the duplicate). The flag is set per-transaction via SET LOCAL.
  BEGIN
    skip_flag := current_setting('app.skip_dup_check', true);
  EXCEPTION WHEN others THEN
    skip_flag := NULL;
  END;
  IF skip_flag = 'true' THEN
    RETURN NEW;
  END IF;

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

CREATE OR REPLACE FUNCTION public.insert_movement_force(payload jsonb)
 RETURNS public.movements
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_row public.movements;
BEGIN
  IF v_user IS NULL OR NOT (public.has_role(v_user, 'admin') OR public.has_role(v_user, 'operator')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM set_config('app.skip_dup_check', 'true', true);

  INSERT INTO public.movements (
    dam_id, movement_type, occurred_at, quantity_tons, created_by,
    src_date_of_departure, src_time, src_vehicle_registration, src_haulier,
    src_delivery_note, src_mill_number, src_mill,
    src_gross_mass, src_tare_mass, src_net_mass, src_molasses_temperature, src_sample_number,
    fgc_date_of_arrival, fgc_time, fgc_vehicle_registration, fgc_haulier,
    fgc_consignment_note_number, fgc_zsm_weighbridge_number,
    fgc_gross_mass, fgc_tare_mass, fgc_net_mass, fgc_variance, fgc_brix,
    fgc_in_out, fgc_zsm_operator, fgc_in, fgc_out, fgc_net
  ) VALUES (
    (payload->>'dam_id')::uuid,
    payload->>'movement_type',
    COALESCE((payload->>'occurred_at')::timestamptz, now()),
    (payload->>'quantity_tons')::numeric,
    v_user,
    NULLIF(payload->>'src_date_of_departure','')::date,
    NULLIF(payload->>'src_time','')::time,
    payload->>'src_vehicle_registration',
    payload->>'src_haulier',
    payload->>'src_delivery_note',
    payload->>'src_mill_number',
    payload->>'src_mill',
    NULLIF(payload->>'src_gross_mass','')::numeric,
    NULLIF(payload->>'src_tare_mass','')::numeric,
    NULLIF(payload->>'src_net_mass','')::numeric,
    NULLIF(payload->>'src_molasses_temperature','')::numeric,
    payload->>'src_sample_number',
    NULLIF(payload->>'fgc_date_of_arrival','')::date,
    NULLIF(payload->>'fgc_time','')::time,
    payload->>'fgc_vehicle_registration',
    payload->>'fgc_haulier',
    payload->>'fgc_consignment_note_number',
    payload->>'fgc_zsm_weighbridge_number',
    NULLIF(payload->>'fgc_gross_mass','')::numeric,
    NULLIF(payload->>'fgc_tare_mass','')::numeric,
    (payload->>'fgc_net_mass')::numeric,
    NULLIF(payload->>'fgc_variance','')::numeric,
    NULLIF(payload->>'fgc_brix','')::numeric,
    payload->>'fgc_in_out',
    payload->>'fgc_zsm_operator',
    NULLIF(payload->>'fgc_in','')::numeric,
    NULLIF(payload->>'fgc_out','')::numeric,
    NULLIF(payload->>'fgc_net','')::numeric
  ) RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.insert_movement_force(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_movement_force(jsonb) TO authenticated;