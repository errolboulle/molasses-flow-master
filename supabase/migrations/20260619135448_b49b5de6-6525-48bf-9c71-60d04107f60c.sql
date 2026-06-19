
-- 1) Demo users: restrict audit log visibility to demo-flagged entries only.
DROP POLICY IF EXISTS "Demo views audit logs" ON public.audit_logs;
CREATE POLICY "Demo views audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'demo'::app_role)
    AND COALESCE((metadata->>'is_demo')::boolean, false) = true
  );

-- 2) Movements SELECT: require an operational role in addition to demo isolation.
DROP POLICY IF EXISTS "Read movements isolated by demo" ON public.movements;
CREATE POLICY "Read movements isolated by demo"
  ON public.movements
  FOR SELECT
  TO authenticated
  USING (
    public.can_view_operations()
    AND (
      (public.is_demo_user() AND is_demo = true)
      OR ((NOT public.is_demo_user()) AND is_demo = false)
    )
  );

-- 3) Reports storage bucket: allow owner and admin to delete their files.
DROP POLICY IF EXISTS "Reports owner can delete" ON storage.objects;
CREATE POLICY "Reports owner can delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'reports'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );
