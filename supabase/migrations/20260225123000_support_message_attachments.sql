-- Support message attachments (image uploads)
ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- Storage bucket for support attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Support attachments read'
  ) THEN
    CREATE POLICY "Support attachments read"
      ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'support-attachments');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Support attachments insert'
  ) THEN
    CREATE POLICY "Support attachments insert"
      ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'support-attachments');
  END IF;
END $$;
