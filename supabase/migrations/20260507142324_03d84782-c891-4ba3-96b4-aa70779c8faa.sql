-- Allow demo users to view operational data (read-only)
CREATE OR REPLACE FUNCTION public.can_view_operations()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'operator')
      OR public.has_role(auth.uid(), 'supervisor')
      OR public.has_role(auth.uid(), 'demo')
$function$;

-- Demo users may also view their own profile (already covered by existing policy via id = auth.uid())
-- Demo users may view audit logs (read-only, helpful for tour)
CREATE POLICY "Demo views audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'demo'));
