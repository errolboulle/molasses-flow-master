CREATE OR REPLACE FUNCTION public.log_manual_data_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid := auth.uid();
  changed_id uuid;
  audit_action text;
  before_data jsonb;
  after_data jsonb;
BEGIN
  IF TG_TABLE_NAME = 'audit_logs' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    changed_id := NEW.id;
    audit_action := 'CREATE_' || upper(TG_TABLE_NAME);
    before_data := NULL;
    after_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    changed_id := NEW.id;
    audit_action := 'UPDATE_' || upper(TG_TABLE_NAME);
    before_data := to_jsonb(OLD);
    after_data := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    changed_id := OLD.id;
    audit_action := 'DELETE_' || upper(TG_TABLE_NAME);
    before_data := to_jsonb(OLD);
    after_data := NULL;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (
    actor_id,
    audit_action,
    TG_TABLE_NAME,
    changed_id,
    jsonb_build_object(
      'operation', TG_OP,
      'before', before_data,
      'after', after_data
    )
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_dams_manual_changes ON public.dams;
CREATE TRIGGER audit_dams_manual_changes
AFTER INSERT OR UPDATE OR DELETE ON public.dams
FOR EACH ROW EXECUTE FUNCTION public.log_manual_data_change();

DROP TRIGGER IF EXISTS audit_trucks_manual_changes ON public.trucks;
CREATE TRIGGER audit_trucks_manual_changes
AFTER INSERT OR UPDATE OR DELETE ON public.trucks
FOR EACH ROW EXECUTE FUNCTION public.log_manual_data_change();

DROP TRIGGER IF EXISTS audit_movements_manual_changes ON public.movements;
CREATE TRIGGER audit_movements_manual_changes
AFTER INSERT OR UPDATE OR DELETE ON public.movements
FOR EACH ROW EXECUTE FUNCTION public.log_manual_data_change();

DROP TRIGGER IF EXISTS audit_loads_manual_changes ON public.loads;
CREATE TRIGGER audit_loads_manual_changes
AFTER INSERT OR UPDATE OR DELETE ON public.loads
FOR EACH ROW EXECUTE FUNCTION public.log_manual_data_change();

DROP TRIGGER IF EXISTS audit_settings_manual_changes ON public.settings;
CREATE TRIGGER audit_settings_manual_changes
AFTER UPDATE ON public.settings
FOR EACH ROW EXECUTE FUNCTION public.log_manual_data_change();

DROP TRIGGER IF EXISTS audit_profiles_manual_changes ON public.profiles;
CREATE TRIGGER audit_profiles_manual_changes
AFTER UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_manual_data_change();

DROP TRIGGER IF EXISTS audit_user_roles_manual_changes ON public.user_roles;
CREATE TRIGGER audit_user_roles_manual_changes
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_manual_data_change();