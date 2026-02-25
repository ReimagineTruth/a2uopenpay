CREATE OR REPLACE FUNCTION public.get_private_ledger_transaction(
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
    le.note,
    COALESCE(le.status, 'completed') AS status,
    le.occurred_at,
    le.event_type
  FROM public.ledger_events le
  LEFT JOIN public.transactions t ON t.id = le.source_id
  WHERE le.source_table = 'transactions'
    AND le.source_id = p_transaction_id
    AND le.amount IS NOT NULL
    AND (
      t.sender_id = auth.uid()
      OR t.receiver_id = auth.uid()
    )
  ORDER BY le.occurred_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_private_ledger_transaction(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_private_ledger_transaction(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
