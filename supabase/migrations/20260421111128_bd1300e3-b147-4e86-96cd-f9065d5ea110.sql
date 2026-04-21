-- Allow admins/operators to update and delete movements; safely adjust dam volumes on edit/delete

-- 1) UPDATE policy on movements (admins + operators)
DROP POLICY IF EXISTS "Admins/operators update movements" ON public.movements;
CREATE POLICY "Admins/operators update movements"
ON public.movements
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- 2) DELETE policy: keep admins-only (already exists, leave as-is)

-- 3) Trigger: on UPDATE, reverse old effect then apply new effect (handles dam_id change, type change, qty change)
CREATE OR REPLACE FUNCTION public.reapply_movement_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  old_vol NUMERIC(14,3);
  new_vol NUMERIC(14,3);
BEGIN
  -- Reverse OLD effect on OLD dam
  SELECT current_volume_tons INTO old_vol FROM public.dams WHERE id = OLD.dam_id FOR UPDATE;
  IF OLD.movement_type = 'incoming' THEN
    old_vol := old_vol - OLD.quantity_tons;
  ELSE
    old_vol := old_vol + OLD.quantity_tons;
  END IF;
  IF old_vol < 0 THEN
    RAISE EXCEPTION 'Reversing this movement would make % go below zero (% tons)', OLD.dam_id, old_vol;
  END IF;
  UPDATE public.dams SET current_volume_tons = old_vol WHERE id = OLD.dam_id;

  -- Apply NEW effect on NEW dam
  SELECT current_volume_tons INTO new_vol FROM public.dams WHERE id = NEW.dam_id FOR UPDATE;
  IF NEW.movement_type = 'incoming' THEN
    new_vol := new_vol + NEW.quantity_tons;
  ELSE
    IF new_vol < NEW.quantity_tons THEN
      RAISE EXCEPTION 'Insufficient volume in dam (% tons available, requested %)', new_vol, NEW.quantity_tons;
    END IF;
    new_vol := new_vol - NEW.quantity_tons;
  END IF;
  UPDATE public.dams SET current_volume_tons = new_vol WHERE id = NEW.dam_id;

  RETURN NEW;
END $$;

-- 4) Trigger: on DELETE, reverse the movement
CREATE OR REPLACE FUNCTION public.reverse_movement_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  vol NUMERIC(14,3);
BEGIN
  SELECT current_volume_tons INTO vol FROM public.dams WHERE id = OLD.dam_id FOR UPDATE;
  IF OLD.movement_type = 'incoming' THEN
    vol := vol - OLD.quantity_tons;
    IF vol < 0 THEN
      RAISE EXCEPTION 'Deleting this incoming would make dam go below zero (% tons)', vol;
    END IF;
  ELSE
    vol := vol + OLD.quantity_tons;
  END IF;
  UPDATE public.dams SET current_volume_tons = vol WHERE id = OLD.dam_id;
  RETURN OLD;
END $$;

-- 5) Wire triggers
DROP TRIGGER IF EXISTS trg_apply_movement_insert ON public.movements;
CREATE TRIGGER trg_apply_movement_insert
AFTER INSERT ON public.movements
FOR EACH ROW EXECUTE FUNCTION public.apply_movement();

DROP TRIGGER IF EXISTS trg_reapply_movement_update ON public.movements;
CREATE TRIGGER trg_reapply_movement_update
AFTER UPDATE ON public.movements
FOR EACH ROW
WHEN (OLD.dam_id IS DISTINCT FROM NEW.dam_id
   OR OLD.movement_type IS DISTINCT FROM NEW.movement_type
   OR OLD.quantity_tons IS DISTINCT FROM NEW.quantity_tons)
EXECUTE FUNCTION public.reapply_movement_on_update();

DROP TRIGGER IF EXISTS trg_reverse_movement_delete ON public.movements;
CREATE TRIGGER trg_reverse_movement_delete
BEFORE DELETE ON public.movements
FOR EACH ROW EXECUTE FUNCTION public.reverse_movement_on_delete();

-- 6) Allow operators (not just admins) to log dam adjustments — fixes audit log not recording
DROP POLICY IF EXISTS "Admins insert adjustments" ON public.dam_adjustments;
CREATE POLICY "Admins/operators insert adjustments"
ON public.dam_adjustments
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- 7) Auto-fill difference_tons on adjustment insert so audit log always shows delta
CREATE OR REPLACE FUNCTION public.set_adjustment_difference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.difference_tons IS NULL THEN
    NEW.difference_tons := NEW.new_volume_tons - NEW.previous_volume_tons;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_adjustment_difference ON public.dam_adjustments;
CREATE TRIGGER trg_set_adjustment_difference
BEFORE INSERT ON public.dam_adjustments
FOR EACH ROW EXECUTE FUNCTION public.set_adjustment_difference();