
-- 1) Stop auto-assigning operator role to new signups. First user still becomes admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count <= 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  -- Subsequent users get no role; admins must explicitly grant one.
  RETURN NEW;
END $$;

-- 2) Prevent users from re-enabling themselves or escalating profile fields.
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND status = (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid())
  AND deactivated_at IS NOT DISTINCT FROM (SELECT p.deactivated_at FROM public.profiles p WHERE p.id = auth.uid())
  AND deactivated_by IS NOT DISTINCT FROM (SELECT p.deactivated_by FROM public.profiles p WHERE p.id = auth.uid())
);
