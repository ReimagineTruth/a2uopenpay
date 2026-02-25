DO $$
BEGIN
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

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'support_faq_categories'
      AND c.relkind = 'r'
  ) THEN
    GRANT SELECT ON TABLE public.support_faq_categories TO authenticated;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'support_faq_items'
      AND c.relkind = 'r'
  ) THEN
    GRANT SELECT ON TABLE public.support_faq_items TO authenticated;
  END IF;
END $$;
