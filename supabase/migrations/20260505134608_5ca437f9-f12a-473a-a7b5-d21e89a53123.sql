
ALTER TABLE public.movements ADD COLUMN IF NOT EXISTS scanned_document_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('scanned-documents', 'scanned-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth users upload scans"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'scanned-documents' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator')));

CREATE POLICY "Auth users read scans"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'scanned-documents' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'supervisor')));

CREATE POLICY "Admins delete scans"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'scanned-documents' AND public.has_role(auth.uid(), 'admin'));
