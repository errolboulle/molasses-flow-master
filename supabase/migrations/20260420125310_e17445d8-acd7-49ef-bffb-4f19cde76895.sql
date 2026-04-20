
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'viewer');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_active(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT status FROM public.profiles WHERE id = _user_id), 'active') = 'active'
$$;

-- Settings (singleton)
CREATE TABLE public.settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  density_kg_per_l NUMERIC(8,4) NOT NULL DEFAULT 1.4,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Dams
CREATE TABLE public.dams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  capacity_tons NUMERIC(14,3),
  starting_balance_tons NUMERIC(14,3) NOT NULL DEFAULT 0,
  current_volume_tons NUMERIC(14,3) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dams ENABLE ROW LEVEL SECURITY;

INSERT INTO public.dams (name) VALUES ('Dam 1'), ('Dam 2'), ('Dam 3');

-- Movements (truck deliveries / dispatches)
CREATE TABLE public.movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dam_id UUID NOT NULL REFERENCES public.dams(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('incoming','outgoing')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Source mill (left)
  src_date_of_departure DATE,
  src_time TIME,
  src_vehicle_registration TEXT,
  src_haulier TEXT,
  src_delivery_note TEXT,
  src_mill_number TEXT,
  src_mill TEXT,
  src_gross_mass NUMERIC(14,3),
  src_tare_mass NUMERIC(14,3),
  src_net_mass NUMERIC(14,3),
  src_molasses_temperature NUMERIC(8,2),
  src_sample_number TEXT,

  -- FGC (right)
  fgc_date_of_arrival DATE,
  fgc_time TIME,
  fgc_vehicle_registration TEXT,
  fgc_haulier TEXT,
  fgc_consignment_note_number TEXT,
  fgc_zsm_weighbridge_number TEXT,
  fgc_gross_mass NUMERIC(14,3),
  fgc_tare_mass NUMERIC(14,3),
  fgc_net_mass NUMERIC(14,3),
  fgc_variance NUMERIC(14,3),
  fgc_brix NUMERIC(8,2),
  fgc_in_out TEXT,
  fgc_zsm_operator TEXT,
  fgc_if_out_haulier TEXT,
  fgc_in NUMERIC(14,3),
  fgc_out NUMERIC(14,3),
  fgc_net NUMERIC(14,3),

  -- Quantity that affects dam (tons)
  quantity_tons NUMERIC(14,3) NOT NULL,
  driver_or_company TEXT,
  notes TEXT,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_movements_dam_occurred ON public.movements(dam_id, occurred_at DESC);
CREATE INDEX idx_movements_type ON public.movements(movement_type);

-- Dam adjustments log (immutable)
CREATE TABLE public.dam_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dam_id UUID NOT NULL REFERENCES public.dams(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES auth.users(id),
  previous_volume_tons NUMERIC(14,3) NOT NULL,
  new_volume_tons NUMERIC(14,3) NOT NULL,
  difference_tons NUMERIC(14,3) GENERATED ALWAYS AS (new_volume_tons - previous_volume_tons) STORED,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dam_adjustments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_adjustments_dam ON public.dam_adjustments(dam_id, created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_dams_updated BEFORE UPDATE ON public.dams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + assign role on signup. First user becomes admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INT;
  assigned_role app_role;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count <= 1 THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'operator';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Apply movement to dam volume + balance guard
CREATE OR REPLACE FUNCTION public.apply_movement()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  current_vol NUMERIC(14,3);
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

CREATE TRIGGER trg_apply_movement AFTER INSERT ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_movement();

-- ==================== RLS POLICIES ====================

-- profiles
CREATE POLICY "Users view own profile, admins view all" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- settings
CREATE POLICY "Authenticated read settings" ON public.settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- dams
CREATE POLICY "Authenticated read dams" ON public.dams
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert dams" ON public.dams
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update dams" ON public.dams
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete dams" ON public.dams
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- movements
CREATE POLICY "Authenticated read movements" ON public.movements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins/operators insert movements" ON public.movements
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operator'));
CREATE POLICY "Admins delete movements" ON public.movements
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- dam_adjustments (immutable: insert + select only)
CREATE POLICY "Authenticated read adjustments" ON public.dam_adjustments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert adjustments" ON public.dam_adjustments
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
