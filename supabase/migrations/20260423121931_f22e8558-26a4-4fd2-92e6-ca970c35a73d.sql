DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE public.report_status AS ENUM ('draft', 'active', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_file_type') THEN
    CREATE TYPE public.report_file_type AS ENUM ('pdf', 'xlsx', 'docx');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_audit_action') THEN
    CREATE TYPE public.report_audit_action AS ENUM ('created', 'updated', 'deleted', 'restored', 'downloaded');
  END IF;
END $$;

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS status public.report_status NOT NULL DEFAULT 'active';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS current_version_id uuid;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.reports
SET user_id = generated_by
WHERE user_id IS NULL AND generated_by IS NOT NULL;

UPDATE public.reports
SET title = COALESCE(NULLIF(type, ''), 'Untitled report')
WHERE title IS NULL;

ALTER TABLE public.reports ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.reports ALTER COLUMN title SET NOT NULL;
ALTER TABLE public.reports ALTER COLUMN user_id SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.report_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE RESTRICT,
  version_number integer NOT NULL,
  file_path text NOT NULL,
  file_type public.report_file_type NOT NULL,
  file_size bigint NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_versions_version_positive CHECK (version_number > 0),
  CONSTRAINT report_versions_file_size_positive CHECK (file_size > 0),
  CONSTRAINT report_versions_unique_version UNIQUE (report_id, version_number),
  CONSTRAINT report_versions_unique_path UNIQUE (file_path)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reports_current_version_id_fkey'
  ) THEN
    ALTER TABLE public.reports
      ADD CONSTRAINT reports_current_version_id_fkey
      FOREIGN KEY (current_version_id)
      REFERENCES public.report_versions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.report_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  action public.report_audit_action NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_user_deleted_created ON public.reports(user_id, is_deleted, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_versions_report_version ON public.report_versions(report_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_report_audit_log_report_created ON public.report_audit_log(report_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_report_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_reports_updated_at ON public.reports;
CREATE TRIGGER set_reports_updated_at
BEFORE UPDATE ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.set_report_updated_at();

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage reports" ON public.reports;
DROP POLICY IF EXISTS "Admins supervisors create reports" ON public.reports;
DROP POLICY IF EXISTS "Admins supervisors view reports" ON public.reports;
DROP POLICY IF EXISTS "Users view own reports" ON public.reports;
CREATE POLICY "Users view own reports"
ON public.reports
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users create own reports" ON public.reports;
CREATE POLICY "Users create own reports"
ON public.reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own reports" ON public.reports;
CREATE POLICY "Users update own reports"
ON public.reports
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own report versions" ON public.report_versions;
CREATE POLICY "Users view own report versions"
ON public.report_versions
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users create own report versions" ON public.report_versions;
CREATE POLICY "Users create own report versions"
ON public.report_versions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users view own report audit log" ON public.report_audit_log;
CREATE POLICY "Users view own report audit log"
ON public.report_audit_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users create own report audit log" ON public.report_audit_log;
CREATE POLICY "Users create own report audit log"
ON public.report_audit_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.user_id = auth.uid()));

INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Users read own report files" ON storage.objects;
CREATE POLICY "Users read own report files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users upload own report files" ON storage.objects;
CREATE POLICY "Users upload own report files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users update own report files" ON storage.objects;
CREATE POLICY "Users update own report files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);