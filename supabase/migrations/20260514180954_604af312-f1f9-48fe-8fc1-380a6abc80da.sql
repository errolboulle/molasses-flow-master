-- Extend audit_logs schema for categorized logging
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS log_type text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS user_email text,
  ADD COLUMN IF NOT EXISTS status text;

CREATE INDEX IF NOT EXISTS idx_audit_logs_log_type ON public.audit_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);

-- Allow users to view their own audit logs (admin-only page is enforced by frontend / existing policy)
DROP POLICY IF EXISTS "Users view own audit logs" ON public.audit_logs;
CREATE POLICY "Users view own audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- RPC: callable from the client to log an event with the current user attached
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _log_type text,
  _action text,
  _entity_type text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _status text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_id uuid;
BEGIN
  IF v_user IS NOT NULL THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = v_user;
  END IF;
  INSERT INTO public.audit_logs (user_id, user_email, log_type, action, entity_type, entity_id, metadata, status)
  VALUES (v_user, v_email, _log_type, _action, _entity_type, _entity_id, COALESCE(_metadata, '{}'::jsonb), _status)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, uuid, jsonb, text) TO authenticated;

-- Trigger function: log every movement create/update/delete
CREATE OR REPLACE FUNCTION public.log_movement_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text;
  v_dam_name text;
  v_action text;
  v_row public.movements;
  v_meta jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := OLD; v_action := 'deleted';
  ELSIF TG_OP = 'INSERT' THEN
    v_row := NEW; v_action := 'created';
  ELSE
    v_row := NEW; v_action := 'updated';
  END IF;

  IF v_actor IS NULL THEN
    v_actor := COALESCE(v_row.created_by, NULL);
  END IF;
  IF v_actor IS NOT NULL THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = v_actor;
  END IF;
  SELECT name INTO v_dam_name FROM public.dams WHERE id = v_row.dam_id;

  v_meta := jsonb_build_object(
    'movement_id', v_row.id,
    'dam_id', v_row.dam_id,
    'dam_name', v_dam_name,
    'movement_type', v_row.movement_type,
    'vehicle_registration', COALESCE(v_row.fgc_vehicle_registration, v_row.src_vehicle_registration),
    'fgc_net_mass', v_row.fgc_net_mass,
    'occurred_at', v_row.occurred_at,
    'src_delivery_note', v_row.src_delivery_note,
    'fgc_consignment_note_number', v_row.fgc_consignment_note_number
  );
  IF TG_OP = 'UPDATE' THEN
    v_meta := v_meta || jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW));
  END IF;

  INSERT INTO public.audit_logs (user_id, user_email, log_type, action, entity_type, entity_id, metadata, status)
  VALUES (v_actor, v_email, 'movement', v_action, 'movement', v_row.id, v_meta, 'success');

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS movements_audit_trg ON public.movements;
CREATE TRIGGER movements_audit_trg
AFTER INSERT OR UPDATE OR DELETE ON public.movements
FOR EACH ROW EXECUTE FUNCTION public.log_movement_change();