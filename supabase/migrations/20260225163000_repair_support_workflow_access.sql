DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'support_tickets'
      AND c.relkind = 'r'
  ) THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE public.support_tickets TO authenticated;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'support_conversations'
      AND c.relkind = 'r'
  ) THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE public.support_conversations TO authenticated;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'support_messages'
      AND c.relkind = 'r'
  ) THEN
    GRANT SELECT, INSERT ON TABLE public.support_messages TO authenticated;
  END IF;
END $$;

ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS attachment_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Support attachments read'
  ) THEN
    CREATE POLICY "Support attachments read"
      ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'support-attachments');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Support attachments insert'
  ) THEN
    CREATE POLICY "Support attachments insert"
      ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'support-attachments');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
