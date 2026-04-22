DROP POLICY IF EXISTS "Admins create audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Backend only creates audit logs" ON public.audit_logs;

CREATE POLICY "Backend only creates audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (false);