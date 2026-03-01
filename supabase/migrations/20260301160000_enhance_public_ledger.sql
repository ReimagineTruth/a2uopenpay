-- 20260301160000_enhance_public_ledger.sql
-- Enhance public ledger RPCs to include currency and payload for icons/logos

DROP FUNCTION IF EXISTS public.get_public_ledger(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.get_public_ledger_transaction(UUID);
DROP FUNCTION IF EXISTS public.get_private_ledger_transaction(UUID);

-- 1. Update get_public_ledger
CREATE OR REPLACE FUNCTION public.get_public_ledger(
  p_limit INTEGER DEFAULT 30,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  amount NUMERIC,
  note TEXT,
  status TEXT,
  occurred_at TIMESTAMPTZ,
  event_type TEXT,
  currency_code TEXT,
  payload JSONB,
  sender_name TEXT,
  sender_username TEXT,
  sender_avatar TEXT,
  receiver_name TEXT,
  receiver_username TEXT,
  receiver_avatar TEXT
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
    le.event_type,
    COALESCE(t.currency_code, 'OUSD') AS currency_code,
    le.payload,
    ps.full_name AS sender_name,
    ps.username AS sender_username,
    ps.avatar_url AS sender_avatar,
    pr.full_name AS receiver_name,
    pr.username AS receiver_username,
    pr.avatar_url AS receiver_avatar
  FROM public.ledger_events le
  LEFT JOIN public.transactions t ON t.id = le.source_id
  LEFT JOIN public.profiles ps ON ps.id = le.actor_user_id
  LEFT JOIN public.profiles pr ON pr.id = le.related_user_id
  WHERE le.source_table IN ('transactions', 'user_topup_requests', 'swap_withdrawals', 'wallets', 'payment_requests')
    AND le.amount IS NOT NULL
    AND (le.note IS NULL OR le.note NOT ILIKE '[internal]%')
    AND NOT (
      LOWER(COALESCE(ps.username, '')) = 'wainfoundation'
      AND LOWER(COALESCE(pr.username, '')) = 'openpay'
    )
  ORDER BY le.occurred_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

-- 2. Update get_public_ledger_transaction
CREATE OR REPLACE FUNCTION public.get_public_ledger_transaction(
  p_transaction_id UUID
)
RETURNS TABLE (
  amount NUMERIC,
  note TEXT,
  status TEXT,
  occurred_at TIMESTAMPTZ,
  event_type TEXT,
  currency_code TEXT,
  payload JSONB,
  sender_name TEXT,
  sender_username TEXT,
  sender_avatar TEXT,
  receiver_name TEXT,
  receiver_username TEXT,
  receiver_avatar TEXT
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
    le.event_type,
    COALESCE(t.currency_code, 'OUSD') AS currency_code,
    le.payload,
    ps.full_name AS sender_name,
    ps.username AS sender_username,
    ps.avatar_url AS sender_avatar,
    pr.full_name AS receiver_name,
    pr.username AS receiver_username,
    pr.avatar_url AS receiver_avatar
  FROM public.ledger_events le
  LEFT JOIN public.transactions t ON t.id = le.source_id
  LEFT JOIN public.profiles ps ON ps.id = le.actor_user_id
  LEFT JOIN public.profiles pr ON pr.id = le.related_user_id
  WHERE le.source_id = p_transaction_id
    AND le.amount IS NOT NULL
    AND (le.note IS NULL OR le.note NOT ILIKE '[internal]%')
    AND NOT (
      LOWER(COALESCE(ps.username, '')) = 'wainfoundation'
      AND LOWER(COALESCE(pr.username, '')) = 'openpay'
    )
  ORDER BY le.occurred_at DESC
  LIMIT 1;
$$;

-- 3. Update get_private_ledger_transaction
CREATE OR REPLACE FUNCTION public.get_private_ledger_transaction(
  p_transaction_id UUID
)
RETURNS TABLE (
  amount NUMERIC,
  note TEXT,
  status TEXT,
  occurred_at TIMESTAMPTZ,
  event_type TEXT,
  currency_code TEXT,
  payload JSONB,
  sender_name TEXT,
  sender_username TEXT,
  sender_avatar TEXT,
  receiver_name TEXT,
  receiver_username TEXT,
  receiver_avatar TEXT
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
    le.event_type,
    COALESCE(t.currency_code, 'OUSD') AS currency_code,
    le.payload,
    ps.full_name AS sender_name,
    ps.username AS sender_username,
    ps.avatar_url AS sender_avatar,
    pr.full_name AS receiver_name,
    pr.username AS receiver_username,
    pr.avatar_url AS receiver_avatar
  FROM public.ledger_events le
  LEFT JOIN public.transactions t ON t.id = le.source_id
  LEFT JOIN public.profiles ps ON ps.id = le.actor_user_id
  LEFT JOIN public.profiles pr ON pr.id = le.related_user_id
  WHERE le.source_id = p_transaction_id
    AND le.amount IS NOT NULL
    AND (
      t.sender_id = auth.uid()
      OR t.receiver_id = auth.uid()
      OR le.actor_user_id = auth.uid()
      OR le.related_user_id = auth.uid()
    )
  ORDER BY le.occurred_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_ledger(INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_ledger_transaction(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_private_ledger_transaction(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
