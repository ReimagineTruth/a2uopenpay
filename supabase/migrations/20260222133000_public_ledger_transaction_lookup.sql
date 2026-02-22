CREATE OR REPLACE FUNCTION public.get_public_ledger_transaction(
  p_transaction_id UUID
)
RETURNS TABLE (
  amount NUMERIC,
  note TEXT,
  status TEXT,
  occurred_at TIMESTAMPTZ,
  event_type TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    le.amount,
    CASE
      WHEN le.note IS NULL THEN NULL
      ELSE regexp_replace(
        le.note,
        '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
        '[hidden]',
        'g'
      )
    END AS note,
    COALESCE(le.status, 'completed') AS status,
    le.occurred_at,
    le.event_type
  FROM public.ledger_events le
  WHERE le.source_table = 'transactions'
    AND le.source_id = p_transaction_id
    AND le.amount IS NOT NULL
  ORDER BY le.occurred_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_ledger_transaction(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_ledger_transaction(UUID) TO anon, authenticated;
