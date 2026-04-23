ALTER TABLE public.loads
ADD COLUMN IF NOT EXISTS fgc_net_mass NUMERIC(14,3);

UPDATE public.loads
SET fgc_net_mass = weight_tons
WHERE fgc_net_mass IS NULL;

ALTER TABLE public.loads
ALTER COLUMN dam_id SET NOT NULL,
ALTER COLUMN fgc_net_mass SET NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_movement_stock_input()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.dam_id IS NULL THEN
    RAISE EXCEPTION 'Dam selection is required';
  END IF;

  IF NEW.fgc_net_mass IS NULL OR NEW.fgc_net_mass <= 0 THEN
    RAISE EXCEPTION 'FGC net mass must be greater than zero';
  END IF;

  IF NEW.movement_type NOT IN ('incoming', 'outgoing') THEN
    RAISE EXCEPTION 'Movement type must be incoming or outgoing';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.dams WHERE id = NEW.dam_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Selected dam does not exist';
  END IF;

  NEW.quantity_tons := NEW.fgc_net_mass;
  NEW.fgc_net := NEW.fgc_net_mass;
  NEW.fgc_in := CASE WHEN NEW.movement_type = 'incoming' THEN NEW.fgc_net_mass ELSE NULL END;
  NEW.fgc_out := CASE WHEN NEW.movement_type = 'outgoing' THEN NEW.fgc_net_mass ELSE NULL END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_movement_stock_input_before_insert ON public.movements;
CREATE TRIGGER validate_movement_stock_input_before_insert
BEFORE INSERT ON public.movements
FOR EACH ROW
EXECUTE FUNCTION public.validate_movement_stock_input();

DROP TRIGGER IF EXISTS validate_movement_stock_input_before_update ON public.movements;
CREATE TRIGGER validate_movement_stock_input_before_update
BEFORE UPDATE ON public.movements
FOR EACH ROW
EXECUTE FUNCTION public.validate_movement_stock_input();

CREATE OR REPLACE FUNCTION public.apply_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_vol NUMERIC(14,3);
  next_vol NUMERIC(14,3);
BEGIN
  SELECT current_volume_tons INTO current_vol
  FROM public.dams
  WHERE id = NEW.dam_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected dam does not exist';
  END IF;

  IF NEW.movement_type = 'incoming' THEN
    next_vol := current_vol + NEW.fgc_net_mass;
  ELSIF NEW.movement_type = 'outgoing' THEN
    next_vol := current_vol - NEW.fgc_net_mass;
    IF next_vol < 0 THEN
      RAISE EXCEPTION 'Insufficient volume in selected dam (% tons available, requested %)', current_vol, NEW.fgc_net_mass;
    END IF;
  ELSE
    RAISE EXCEPTION 'Movement type must be incoming or outgoing';
  END IF;

  UPDATE public.dams
  SET current_volume_tons = next_vol,
      updated_at = now()
  WHERE id = NEW.dam_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_movement_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vol NUMERIC(14,3);
BEGIN
  SELECT current_volume_tons INTO vol
  FROM public.dams
  WHERE id = OLD.dam_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected dam does not exist';
  END IF;

  IF OLD.movement_type = 'incoming' THEN
    vol := vol - OLD.fgc_net_mass;
    IF vol < 0 THEN
      RAISE EXCEPTION 'Deleting this incoming would make dam go below zero (% tons)', vol;
    END IF;
  ELSIF OLD.movement_type = 'outgoing' THEN
    vol := vol + OLD.fgc_net_mass;
  ELSE
    RAISE EXCEPTION 'Movement type must be incoming or outgoing';
  END IF;

  UPDATE public.dams
  SET current_volume_tons = vol,
      updated_at = now()
  WHERE id = OLD.dam_id;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.reapply_movement_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_vol NUMERIC(14,3);
  new_vol NUMERIC(14,3);
BEGIN
  SELECT current_volume_tons INTO old_vol
  FROM public.dams
  WHERE id = OLD.dam_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original dam does not exist';
  END IF;

  IF OLD.movement_type = 'incoming' THEN
    old_vol := old_vol - OLD.fgc_net_mass;
  ELSIF OLD.movement_type = 'outgoing' THEN
    old_vol := old_vol + OLD.fgc_net_mass;
  ELSE
    RAISE EXCEPTION 'Original movement type must be incoming or outgoing';
  END IF;

  IF old_vol < 0 THEN
    RAISE EXCEPTION 'Reversing this movement would make selected dam go below zero (% tons)', old_vol;
  END IF;

  UPDATE public.dams
  SET current_volume_tons = old_vol,
      updated_at = now()
  WHERE id = OLD.dam_id;

  SELECT current_volume_tons INTO new_vol
  FROM public.dams
  WHERE id = NEW.dam_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected dam does not exist';
  END IF;

  IF NEW.movement_type = 'incoming' THEN
    new_vol := new_vol + NEW.fgc_net_mass;
  ELSIF NEW.movement_type = 'outgoing' THEN
    IF new_vol < NEW.fgc_net_mass THEN
      RAISE EXCEPTION 'Insufficient volume in selected dam (% tons available, requested %)', new_vol, NEW.fgc_net_mass;
    END IF;
    new_vol := new_vol - NEW.fgc_net_mass;
  ELSE
    RAISE EXCEPTION 'Movement type must be incoming or outgoing';
  END IF;

  UPDATE public.dams
  SET current_volume_tons = new_vol,
      updated_at = now()
  WHERE id = NEW.dam_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_movement_after_insert ON public.movements;
CREATE TRIGGER apply_movement_after_insert
AFTER INSERT ON public.movements
FOR EACH ROW
EXECUTE FUNCTION public.apply_movement();

DROP TRIGGER IF EXISTS reverse_movement_after_delete ON public.movements;
CREATE TRIGGER reverse_movement_after_delete
AFTER DELETE ON public.movements
FOR EACH ROW
EXECUTE FUNCTION public.reverse_movement_on_delete();

DROP TRIGGER IF EXISTS reapply_movement_after_update ON public.movements;
CREATE TRIGGER reapply_movement_after_update
AFTER UPDATE ON public.movements
FOR EACH ROW
WHEN (
  OLD.dam_id IS DISTINCT FROM NEW.dam_id OR
  OLD.movement_type IS DISTINCT FROM NEW.movement_type OR
  OLD.fgc_net_mass IS DISTINCT FROM NEW.fgc_net_mass
)
EXECUTE FUNCTION public.reapply_movement_on_update();

DROP FUNCTION IF EXISTS public.create_load_transaction(uuid, uuid, public.load_type, numeric, numeric, timestamp with time zone, public.load_status);

CREATE FUNCTION public.create_load_transaction(
  _truck_id uuid,
  _dam_id uuid,
  _type public.load_type,
  _fgc_net_mass numeric,
  _volume_liters numeric DEFAULT 0,
  _timestamp timestamp with time zone DEFAULT now(),
  _status public.load_status DEFAULT 'completed'::public.load_status
)
RETURNS public.loads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_load public.loads;
  v_dam public.dams;
  v_truck public.trucks;
  v_change_tons NUMERIC(14,3);
  v_change_liters NUMERIC(16,3);
  v_result_tons NUMERIC(14,3);
  v_result_liters NUMERIC(16,3);
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT (public.has_role(v_user, 'admin') OR public.has_role(v_user, 'operator')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _dam_id IS NULL THEN
    RAISE EXCEPTION 'Dam selection is required';
  END IF;

  IF _fgc_net_mass IS NULL OR _fgc_net_mass <= 0 THEN
    RAISE EXCEPTION 'FGC net mass must be greater than zero';
  END IF;

  SELECT * INTO v_truck FROM public.trucks WHERE id = _truck_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Truck not found';
  END IF;

  SELECT * INTO v_dam FROM public.dams WHERE id = _dam_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected dam does not exist';
  END IF;
  IF v_dam.status <> 'active' THEN
    RAISE EXCEPTION 'Dam is not active';
  END IF;

  v_change_tons := CASE WHEN _type = 'incoming' THEN _fgc_net_mass ELSE -_fgc_net_mass END;
  v_change_liters := CASE WHEN _type = 'incoming' THEN COALESCE(_volume_liters, 0) ELSE -COALESCE(_volume_liters, 0) END;
  v_result_tons := v_dam.current_volume_tons + CASE WHEN _status = 'completed' THEN v_change_tons ELSE 0 END;
  v_result_liters := v_dam.current_volume_liters + CASE WHEN _status = 'completed' THEN v_change_liters ELSE 0 END;

  IF _status = 'completed' THEN
    IF v_result_tons < 0 OR v_result_liters < 0 THEN
      RAISE EXCEPTION 'Dam volume cannot go below zero';
    END IF;
    IF v_dam.capacity_tons IS NOT NULL AND v_result_tons > v_dam.capacity_tons THEN
      RAISE EXCEPTION 'Dam ton capacity exceeded';
    END IF;
    IF v_dam.capacity_liters IS NOT NULL AND v_result_liters > v_dam.capacity_liters THEN
      RAISE EXCEPTION 'Dam liter capacity exceeded';
    END IF;
  END IF;

  INSERT INTO public.loads (truck_id, dam_id, type, weight_tons, fgc_net_mass, volume_liters, timestamp, status, created_by)
  VALUES (_truck_id, _dam_id, _type, _fgc_net_mass, _fgc_net_mass, COALESCE(_volume_liters, 0), _timestamp, _status, v_user)
  RETURNING * INTO v_load;

  IF _status = 'completed' THEN
    UPDATE public.dams
    SET current_volume_tons = v_result_tons,
        current_volume_liters = v_result_liters,
        updated_at = now()
    WHERE id = _dam_id;

    INSERT INTO public.dam_transactions (dam_id, load_id, change_tons, change_liters, resulting_balance_tons, resulting_balance_liters)
    VALUES (_dam_id, v_load.id, v_change_tons, v_change_liters, v_result_tons, v_result_liters);
  END IF;

  UPDATE public.trucks
  SET status = CASE WHEN _status = 'completed' THEN 'idle'::public.truck_status ELSE status END,
      updated_at = now()
  WHERE id = _truck_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (v_user, 'CREATE_LOAD', 'load', v_load.id, jsonb_build_object('truck_id', _truck_id, 'dam_id', _dam_id, 'type', _type, 'fgc_net_mass', _fgc_net_mass, 'status', _status));

  RETURN v_load;
END;
$$;