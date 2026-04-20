
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.apply_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE current_vol NUMERIC(14,3);
BEGIN
  SELECT current_volume_tons INTO current_vol FROM public.dams WHERE id = NEW.dam_id FOR UPDATE;
  IF NEW.movement_type = 'incoming' THEN
    UPDATE public.dams SET current_volume_tons = current_vol + NEW.quantity_tons WHERE id = NEW.dam_id;
  ELSE
    IF current_vol < NEW.quantity_tons THEN
      RAISE EXCEPTION 'Insufficient volume in dam (% tons available, requested %)', current_vol, NEW.quantity_tons;
    END IF;
    UPDATE public.dams SET current_volume_tons = current_vol - NEW.quantity_tons WHERE id = NEW.dam_id;
  END IF;
  RETURN NEW;
END $$;
