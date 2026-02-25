DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'user_topup_requests'
      AND c.relkind = 'r'
  ) THEN
    GRANT SELECT ON TABLE public.user_topup_requests TO authenticated;
  END IF;
END $$;
