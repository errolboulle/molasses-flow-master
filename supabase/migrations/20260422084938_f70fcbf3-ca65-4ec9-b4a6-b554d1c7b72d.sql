ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deactivated_by UUID;

DROP POLICY IF EXISTS "Admins/operators update movements" ON public.movements;
DROP POLICY IF EXISTS "Admins delete movements" ON public.movements;

CREATE POLICY "Admins update movement history"
ON public.movements
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete movement history"
ON public.movements
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_profile_deactivation_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'disabled' AND OLD.status IS DISTINCT FROM 'disabled' THEN
    NEW.deactivated_at := now();
    NEW.deactivated_by := auth.uid();
  ELSIF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    NEW.deactivated_at := NULL;
    NEW.deactivated_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_deactivation_metadata ON public.profiles;
CREATE TRIGGER profiles_deactivation_metadata
BEFORE UPDATE OF status ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_profile_deactivation_metadata();