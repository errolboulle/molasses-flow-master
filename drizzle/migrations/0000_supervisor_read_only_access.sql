CREATE OR REPLACE FUNCTION public.is_read_only_supervisor() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT public.has_role(auth.uid(), 'supervisor'::public.app_role) $$;
GRANT EXECUTE ON FUNCTION public.is_read_only_supervisor() TO authenticated, service_role;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['dams','movements','loads','trucks','dam_adjustments','dam_transactions','settings','user_roles','reports','report_versions','report_audit_log'] LOOP
    EXECUTE format('CREATE POLICY "Supervisor cannot insert" ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_read_only_supervisor())', t);
    EXECUTE format('CREATE POLICY "Supervisor cannot update" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_read_only_supervisor()) WITH CHECK (NOT public.is_read_only_supervisor())', t);
    EXECUTE format('CREATE POLICY "Supervisor cannot delete" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_read_only_supervisor())', t);
  END LOOP;
END $$;
CREATE POLICY "Supervisor reads profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_read_only_supervisor());
CREATE POLICY "Supervisor reads roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_read_only_supervisor());
CREATE POLICY "Supervisor reads all reports" ON public.reports FOR SELECT TO authenticated USING (public.is_read_only_supervisor());
CREATE POLICY "Supervisor reads report versions" ON public.report_versions FOR SELECT TO authenticated USING (public.is_read_only_supervisor());
CREATE POLICY "Supervisor reads report audit" ON public.report_audit_log FOR SELECT TO authenticated USING (public.is_read_only_supervisor());
CREATE OR REPLACE FUNCTION public.prevent_supervisor_profile_changes() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF public.is_read_only_supervisor() AND (TG_OP <> 'UPDATE' OR (to_jsonb(NEW) - ARRAY['terms_accepted_at','last_active_at','updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['terms_accepted_at','last_active_at','updated_at'])) THEN RAISE EXCEPTION 'Supervisors have read-only access' USING ERRCODE='42501'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$;
CREATE TRIGGER supervisor_profile_read_only BEFORE INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_supervisor_profile_changes();