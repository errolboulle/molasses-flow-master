DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dam_status') THEN
    CREATE TYPE public.dam_status AS ENUM ('active', 'maintenance');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'truck_status') THEN
    CREATE TYPE public.truck_status AS ENUM ('idle', 'en_route', 'waiting', 'offloading');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'load_type') THEN
    CREATE TYPE public.load_type AS ENUM ('incoming', 'outgoing');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'load_status') THEN
    CREATE TYPE public.load_status AS ENUM ('pending', 'completed', 'cancelled');
  END IF;
END $$;

ALTER TABLE public.dams
  ADD COLUMN IF NOT EXISTS capacity_liters NUMERIC(16,3),
  ADD COLUMN IF NOT EXISTS current_volume_liters NUMERIC(16,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS status public.dam_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

UPDATE public.dams
SET
  capacity_liters = COALESCE(capacity_liters, CASE WHEN capacity_tons IS NULL THEN NULL ELSE capacity_tons * 1000 / 1.4 END),
  current_volume_liters = CASE WHEN current_volume_liters = 0 AND current_volume_tons <> 0 THEN current_volume_tons * 1000 / 1.4 ELSE current_volume_liters END;

CREATE TABLE IF NOT EXISTS public.trucks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number TEXT NOT NULL UNIQUE,
  driver_name TEXT NOT NULL,
  transporter_company TEXT NOT NULL,
  status public.truck_status NOT NULL DEFAULT 'idle',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.loads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id UUID NOT NULL REFERENCES public.trucks(id),
  dam_id UUID NOT NULL REFERENCES public.dams(id),
  type public.load_type NOT NULL,
  weight_tons NUMERIC(14,3) NOT NULL,
  volume_liters NUMERIC(16,3) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  status public.load_status NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.dam_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dam_id UUID NOT NULL REFERENCES public.dams(id),
  load_id UUID NOT NULL UNIQUE REFERENCES public.loads(id),
  change_tons NUMERIC(14,3) NOT NULL,
  change_liters NUMERIC(16,3) NOT NULL,
  resulting_balance_tons NUMERIC(14,3) NOT NULL,
  resulting_balance_liters NUMERIC(16,3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  generated_by UUID,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dams_status ON public.dams(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_trucks_status ON public.trucks(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_loads_timestamp ON public.loads(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_loads_dam_id ON public.loads(dam_id);
CREATE INDEX IF NOT EXISTS idx_loads_truck_id ON public.loads(truck_id);
CREATE INDEX IF NOT EXISTS idx_loads_status ON public.loads(status);
CREATE INDEX IF NOT EXISTS idx_loads_type ON public.loads(type);
CREATE INDEX IF NOT EXISTS idx_dam_transactions_dam_id ON public.dam_transactions(dam_id);
CREATE INDEX IF NOT EXISTS idx_dam_transactions_created_at ON public.dam_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

CREATE OR REPLACE FUNCTION public.can_operate()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator')
$$;

CREATE OR REPLACE FUNCTION public.can_view_operations()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'supervisor')
$$;

CREATE OR REPLACE FUNCTION public.create_load_transaction(
  _truck_id UUID,
  _dam_id UUID,
  _type public.load_type,
  _weight_tons NUMERIC,
  _volume_liters NUMERIC,
  _timestamp TIMESTAMPTZ DEFAULT now(),
  _status public.load_status DEFAULT 'completed'
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

  IF _weight_tons <= 0 OR _volume_liters <= 0 THEN
    RAISE EXCEPTION 'Load weight and volume must be greater than zero';
  END IF;

  SELECT * INTO v_truck FROM public.trucks WHERE id = _truck_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Truck not found';
  END IF;

  SELECT * INTO v_dam FROM public.dams WHERE id = _dam_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dam not found';
  END IF;
  IF v_dam.status <> 'active' THEN
    RAISE EXCEPTION 'Dam is not active';
  END IF;

  v_change_tons := CASE WHEN _type = 'incoming' THEN _weight_tons ELSE -_weight_tons END;
  v_change_liters := CASE WHEN _type = 'incoming' THEN _volume_liters ELSE -_volume_liters END;
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

  INSERT INTO public.loads (truck_id, dam_id, type, weight_tons, volume_liters, timestamp, status, created_by)
  VALUES (_truck_id, _dam_id, _type, _weight_tons, _volume_liters, _timestamp, _status, v_user)
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
  VALUES (v_user, 'CREATE_LOAD', 'load', v_load.id, jsonb_build_object('truck_id', _truck_id, 'dam_id', _dam_id, 'type', _type, 'weight_tons', _weight_tons, 'volume_liters', _volume_liters, 'status', _status));

  RETURN v_load;
END;
$$;

ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dam_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operations users view trucks" ON public.trucks;
CREATE POLICY "Operations users view trucks" ON public.trucks FOR SELECT TO authenticated USING (public.can_view_operations());
DROP POLICY IF EXISTS "Admins manage trucks" ON public.trucks;
CREATE POLICY "Admins manage trucks" ON public.trucks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Operators update truck status" ON public.trucks;
CREATE POLICY "Operators update truck status" ON public.trucks FOR UPDATE TO authenticated USING (public.can_operate()) WITH CHECK (public.can_operate());

DROP POLICY IF EXISTS "Operations users view loads" ON public.loads;
CREATE POLICY "Operations users view loads" ON public.loads FOR SELECT TO authenticated USING (public.can_view_operations());
DROP POLICY IF EXISTS "Operators create loads" ON public.loads;
CREATE POLICY "Operators create loads" ON public.loads FOR INSERT TO authenticated WITH CHECK (public.can_operate() AND created_by = auth.uid());
DROP POLICY IF EXISTS "Admins manage loads" ON public.loads;
CREATE POLICY "Admins manage loads" ON public.loads FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Operations users view dam transactions" ON public.dam_transactions;
CREATE POLICY "Operations users view dam transactions" ON public.dam_transactions FOR SELECT TO authenticated USING (public.can_view_operations());
DROP POLICY IF EXISTS "Admins manage dam transactions" ON public.dam_transactions;
CREATE POLICY "Admins manage dam transactions" ON public.dam_transactions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins supervisors view audit logs" ON public.audit_logs;
CREATE POLICY "Admins supervisors view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));
DROP POLICY IF EXISTS "Admins create audit logs" ON public.audit_logs;
CREATE POLICY "Admins create audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.can_operate() OR public.has_role(auth.uid(), 'supervisor'));

DROP POLICY IF EXISTS "Admins supervisors view reports" ON public.reports;
CREATE POLICY "Admins supervisors view reports" ON public.reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));
DROP POLICY IF EXISTS "Admins supervisors create reports" ON public.reports;
CREATE POLICY "Admins supervisors create reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));
DROP POLICY IF EXISTS "Admins manage reports" ON public.reports;
CREATE POLICY "Admins manage reports" ON public.reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Supervisors read dams" ON public.dams;
CREATE POLICY "Supervisors read dams" ON public.dams FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));
DROP POLICY IF EXISTS "Supervisors read movements" ON public.movements;
CREATE POLICY "Supervisors read movements" ON public.movements FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));

DROP TRIGGER IF EXISTS update_trucks_updated_at ON public.trucks;
CREATE TRIGGER update_trucks_updated_at BEFORE UPDATE ON public.trucks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS update_loads_updated_at ON public.loads;
CREATE TRIGGER update_loads_updated_at BEFORE UPDATE ON public.loads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.dams;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.trucks;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.loads;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.dam_transactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;