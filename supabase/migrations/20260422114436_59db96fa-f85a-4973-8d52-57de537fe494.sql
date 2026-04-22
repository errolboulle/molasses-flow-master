-- Allow authenticated users to create only their own profile record.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users insert own profile'
  ) THEN
    CREATE POLICY "Users insert own profile"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- Restrict Realtime channel subscriptions for operational broadcasts.
-- Only operational roles can receive messages on the named operational channels.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'realtime'
      AND tablename = 'messages'
      AND policyname = 'Operational users can subscribe to operations realtime'
  ) THEN
    CREATE POLICY "Operational users can subscribe to operations realtime"
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
      public.can_view_operations()
      AND realtime.topic() IN ('dams', 'trucks', 'loads', 'dam_transactions')
    );
  END IF;
END $$;