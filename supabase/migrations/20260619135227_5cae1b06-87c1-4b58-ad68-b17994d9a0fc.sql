
-- 1) Optimistic concurrency version column on movements
ALTER TABLE public.movements
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.bump_movement_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.version := COALESCE(OLD.version, 1) + 1;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bump_movement_version_trg ON public.movements;
CREATE TRIGGER bump_movement_version_trg
  BEFORE UPDATE ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.bump_movement_version();

-- 2) Transactional bulk insert RPC. Whole batch succeeds or whole batch rolls back.
CREATE OR REPLACE FUNCTION public.bulk_insert_movements(payloads jsonb, force boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_item jsonb;
  v_inserted int := 0;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_row public.movements;
BEGIN
  IF v_user IS NULL OR NOT (public.has_role(v_user, 'admin') OR public.has_role(v_user, 'operator')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF jsonb_typeof(payloads) <> 'array' THEN
    RAISE EXCEPTION 'payloads must be a JSON array';
  END IF;

  IF force THEN
    PERFORM set_config('app.skip_dup_check', 'true', true);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payloads)
  LOOP
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
      (v_item->>'dam_id')::uuid,
      v_item->>'movement_type',
      COALESCE((v_item->>'occurred_at')::timestamptz, now()),
      (v_item->>'quantity_tons')::numeric,
      v_user,
      NULLIF(v_item->>'src_date_of_departure','')::date,
      NULLIF(v_item->>'src_time','')::time,
      v_item->>'src_vehicle_registration',
      v_item->>'src_haulier',
      v_item->>'src_delivery_note',
      v_item->>'src_mill_number',
      v_item->>'src_mill',
      NULLIF(v_item->>'src_gross_mass','')::numeric,
      NULLIF(v_item->>'src_tare_mass','')::numeric,
      NULLIF(v_item->>'src_net_mass','')::numeric,
      NULLIF(v_item->>'src_molasses_temperature','')::numeric,
      v_item->>'src_sample_number',
      NULLIF(v_item->>'fgc_date_of_arrival','')::date,
      NULLIF(v_item->>'fgc_time','')::time,
      v_item->>'fgc_vehicle_registration',
      v_item->>'fgc_haulier',
      v_item->>'fgc_consignment_note_number',
      v_item->>'fgc_zsm_weighbridge_number',
      NULLIF(v_item->>'fgc_gross_mass','')::numeric,
      NULLIF(v_item->>'fgc_tare_mass','')::numeric,
      (v_item->>'fgc_net_mass')::numeric,
      NULLIF(v_item->>'fgc_variance','')::numeric,
      NULLIF(v_item->>'fgc_brix','')::numeric,
      v_item->>'fgc_in_out',
      v_item->>'fgc_zsm_operator',
      NULLIF(v_item->>'fgc_in','')::numeric,
      NULLIF(v_item->>'fgc_out','')::numeric,
      NULLIF(v_item->>'fgc_net','')::numeric
    ) RETURNING * INTO v_row;

    v_inserted := v_inserted + 1;
    v_ids := array_append(v_ids, v_row.id);
  END LOOP;

  RETURN jsonb_build_object('inserted', v_inserted, 'ids', to_jsonb(v_ids));
END $$;

REVOKE ALL ON FUNCTION public.bulk_insert_movements(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_insert_movements(jsonb, boolean) TO authenticated;
