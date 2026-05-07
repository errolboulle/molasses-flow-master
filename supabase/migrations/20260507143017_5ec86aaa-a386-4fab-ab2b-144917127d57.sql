-- Add is_demo flag
ALTER TABLE public.dams ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.movements ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.loads ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- Helper to detect demo user
CREATE OR REPLACE FUNCTION public.is_demo_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'demo') $$;

-- ============ DAMS ============
DROP POLICY IF EXISTS "Authenticated read dams" ON public.dams;
DROP POLICY IF EXISTS "Supervisors read dams" ON public.dams;
CREATE POLICY "Read dams isolated by demo"
ON public.dams FOR SELECT TO authenticated
USING (
  (public.is_demo_user() AND is_demo = true)
  OR (NOT public.is_demo_user() AND is_demo = false)
);

-- ============ MOVEMENTS ============
DROP POLICY IF EXISTS "Authenticated read movements" ON public.movements;
DROP POLICY IF EXISTS "Supervisors read movements" ON public.movements;
CREATE POLICY "Read movements isolated by demo"
ON public.movements FOR SELECT TO authenticated
USING (
  (public.is_demo_user() AND is_demo = true)
  OR (NOT public.is_demo_user() AND is_demo = false)
);

-- ============ TRUCKS ============
DROP POLICY IF EXISTS "Operations users view trucks" ON public.trucks;
CREATE POLICY "Read trucks isolated by demo"
ON public.trucks FOR SELECT TO authenticated
USING (
  (public.is_demo_user() AND is_demo = true)
  OR (NOT public.is_demo_user() AND public.can_view_operations() AND is_demo = false)
);

-- ============ LOADS ============
DROP POLICY IF EXISTS "Operations users view loads" ON public.loads;
CREATE POLICY "Read loads isolated by demo"
ON public.loads FOR SELECT TO authenticated
USING (
  (public.is_demo_user() AND is_demo = true)
  OR (NOT public.is_demo_user() AND public.can_view_operations() AND is_demo = false)
);

-- Auto-tag any rows inserted by demo user (defensive — demo has no insert policies, but just in case)
CREATE OR REPLACE FUNCTION public.tag_demo_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'demo') THEN
    NEW.is_demo := true;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tag_demo_dams ON public.dams;
CREATE TRIGGER tag_demo_dams BEFORE INSERT ON public.dams FOR EACH ROW EXECUTE FUNCTION public.tag_demo_insert();
DROP TRIGGER IF EXISTS tag_demo_movements ON public.movements;
CREATE TRIGGER tag_demo_movements BEFORE INSERT ON public.movements FOR EACH ROW EXECUTE FUNCTION public.tag_demo_insert();
DROP TRIGGER IF EXISTS tag_demo_trucks ON public.trucks;
CREATE TRIGGER tag_demo_trucks BEFORE INSERT ON public.trucks FOR EACH ROW EXECUTE FUNCTION public.tag_demo_insert();
DROP TRIGGER IF EXISTS tag_demo_loads ON public.loads;
CREATE TRIGGER tag_demo_loads BEFORE INSERT ON public.loads FOR EACH ROW EXECUTE FUNCTION public.tag_demo_insert();
