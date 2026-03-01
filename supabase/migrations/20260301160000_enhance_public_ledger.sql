-- 20260301160000_enhance_public_ledger.sql
-- Enhance public ledger RPCs to include currency and payload for icons/logos

DROP FUNCTION IF EXISTS public.get_public_ledger(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.get_public_ledger_transaction(UUID);
DROP FUNCTION IF EXISTS public.get_private_ledger_transaction(UUID);

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS currency_code TEXT DEFAULT 'OUSD';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS sender_amount NUMERIC;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS sender_currency_code TEXT DEFAULT 'OUSD';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS receiver_amount NUMERIC;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS receiver_currency_code TEXT DEFAULT 'OUSD';

DROP FUNCTION IF EXISTS public.transfer_funds(UUID, UUID, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.transfer_funds(UUID, UUID, NUMERIC, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT);
CREATE OR REPLACE FUNCTION public.transfer_funds(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_amount NUMERIC,
  p_note TEXT DEFAULT '',
  p_currency_code TEXT DEFAULT 'OUSD',
  p_sender_amount NUMERIC DEFAULT NULL,
  p_sender_currency_code TEXT DEFAULT NULL,
  p_receiver_amount NUMERIC DEFAULT NULL,
  p_receiver_currency_code TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_balance NUMERIC(12,2);
  v_receiver_balance NUMERIC(12,2);
  v_transaction_id UUID;
  v_currency_code TEXT := UPPER(TRIM(COALESCE(p_currency_code, 'OUSD')));
  v_sender_amount NUMERIC := COALESCE(p_sender_amount, p_amount);
  v_sender_currency_code TEXT := UPPER(TRIM(COALESCE(p_sender_currency_code, v_currency_code, 'OUSD')));
  v_receiver_amount NUMERIC := COALESCE(p_receiver_amount, p_amount);
  v_receiver_currency_code TEXT := UPPER(TRIM(COALESCE(p_receiver_currency_code, 'OUSD')));
BEGIN
  IF p_sender_id IS NULL OR p_receiver_id IS NULL THEN
    RAISE EXCEPTION 'Missing sender or receiver';
  END IF;

  IF p_sender_id = p_receiver_id THEN
    RAISE EXCEPTION 'Cannot send to yourself';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  SELECT balance INTO v_sender_balance
  FROM public.wallets
  WHERE user_id = p_sender_id
  FOR UPDATE;

  IF v_sender_balance IS NULL THEN
    RAISE EXCEPTION 'Sender wallet not found';
  END IF;

  SELECT balance INTO v_receiver_balance
  FROM public.wallets
  WHERE user_id = p_receiver_id
  FOR UPDATE;

  IF v_receiver_balance IS NULL THEN
    RAISE EXCEPTION 'Recipient wallet not found';
  END IF;

  IF v_sender_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.wallets
  SET balance = v_sender_balance - p_amount,
      updated_at = now()
  WHERE user_id = p_sender_id;

  UPDATE public.wallets
  SET balance = v_receiver_balance + p_amount,
      updated_at = now()
  WHERE user_id = p_receiver_id;

  INSERT INTO public.transactions (
    sender_id,
    receiver_id,
    amount,
    note,
    status,
    currency_code,
    sender_amount,
    sender_currency_code,
    receiver_amount,
    receiver_currency_code
  )
  VALUES (
    p_sender_id,
    p_receiver_id,
    p_amount,
    COALESCE(p_note, ''),
    'completed',
    v_currency_code,
    v_sender_amount,
    v_sender_currency_code,
    v_receiver_amount,
    v_receiver_currency_code
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_funds(UUID, UUID, NUMERIC, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_funds(UUID, UUID, NUMERIC, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT) TO service_role;

DROP FUNCTION IF EXISTS public.transfer_funds_authenticated(UUID, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.transfer_funds_authenticated(UUID, NUMERIC, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT);
CREATE OR REPLACE FUNCTION public.transfer_funds_authenticated(
  p_receiver_id UUID,
  p_amount NUMERIC,
  p_note TEXT DEFAULT '',
  p_currency_code TEXT DEFAULT 'OUSD',
  p_sender_amount NUMERIC DEFAULT NULL,
  p_sender_currency_code TEXT DEFAULT NULL,
  p_receiver_amount NUMERIC DEFAULT NULL,
  p_receiver_currency_code TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id UUID := auth.uid();
BEGIN
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN public.transfer_funds(
    v_sender_id,
    p_receiver_id,
    p_amount,
    COALESCE(p_note, ''),
    p_currency_code,
    p_sender_amount,
    p_sender_currency_code,
    p_receiver_amount,
    p_receiver_currency_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_funds_authenticated(UUID, NUMERIC, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_funds_authenticated(UUID, NUMERIC, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.bulk_transfer_funds(UUID[], NUMERIC[], TEXT[]);
DROP FUNCTION IF EXISTS public.bulk_transfer_funds(UUID[], NUMERIC[], TEXT[], TEXT, NUMERIC, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.bulk_transfer_funds(
  p_recipients UUID[],
  p_amounts NUMERIC[],
  p_notes TEXT[],
  p_currency_code TEXT DEFAULT 'OUSD',
  p_sender_amount NUMERIC DEFAULT NULL,
  p_sender_currency_code TEXT DEFAULT NULL,
  p_receiver_currency_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id UUID := auth.uid();
  v_sender_balance NUMERIC;
  v_total_amount NUMERIC := 0;
  v_i INTEGER;
  v_tx_ids UUID[] := '{}';
  v_tx_id UUID;
  v_currency_code TEXT := UPPER(TRIM(COALESCE(p_currency_code, 'OUSD')));
  v_sender_amount NUMERIC := COALESCE(p_sender_amount, 0);
  v_sender_currency_code TEXT := UPPER(TRIM(COALESCE(p_sender_currency_code, v_currency_code, 'OUSD')));
  v_receiver_currency_code TEXT := UPPER(TRIM(COALESCE(p_receiver_currency_code, 'OUSD')));
BEGIN
  IF array_length(p_recipients, 1) IS NULL OR array_length(p_recipients, 1) = 0 THEN
    RETURN jsonb_build_object('error', 'No recipients specified');
  END IF;

  IF array_length(p_recipients, 1) <> array_length(p_amounts, 1) OR 
     array_length(p_recipients, 1) <> array_length(p_notes, 1) THEN
    RETURN jsonb_build_object('error', 'Input arrays must have the same length');
  END IF;

  IF array_length(p_recipients, 1) > 5 THEN
    RETURN jsonb_build_object('error', 'Maximum 5 recipients allowed per bulk transfer');
  END IF;

  FOR v_i IN 1..array_length(p_recipients, 1) LOOP
    IF p_recipients[v_i] = v_sender_id THEN
      RETURN jsonb_build_object('error', 'Cannot send funds to yourself');
    END IF;
    IF p_amounts[v_i] <= 0 THEN
      RETURN jsonb_build_object('error', 'Transfer amount must be positive');
    END IF;
    v_total_amount := v_total_amount + p_amounts[v_i];
  END LOOP;

  SELECT balance INTO v_sender_balance
  FROM public.wallets
  WHERE user_id = v_sender_id
  FOR UPDATE;

  IF v_sender_balance < v_total_amount THEN
    RETURN jsonb_build_object('error', 'Insufficient funds for total bulk transfer');
  END IF;

  FOR v_i IN 1..array_length(p_recipients, 1) LOOP
    UPDATE public.wallets
    SET balance = balance - p_amounts[v_i],
        updated_at = now()
    WHERE user_id = v_sender_id;

    UPDATE public.wallets
    SET balance = balance + p_amounts[v_i],
        updated_at = now()
    WHERE user_id = p_recipients[v_i];

    INSERT INTO public.transactions (
      sender_id,
      receiver_id,
      amount,
      note,
      status,
      currency_code,
      sender_amount,
      sender_currency_code,
      receiver_amount,
      receiver_currency_code
    ) VALUES (
      v_sender_id,
      p_recipients[v_i],
      p_amounts[v_i],
      COALESCE(p_notes[v_i], ''),
      'completed',
      v_currency_code,
      CASE WHEN v_sender_amount > 0 THEN v_sender_amount ELSE p_amounts[v_i] END,
      v_sender_currency_code,
      p_amounts[v_i],
      v_receiver_currency_code
    ) RETURNING id INTO v_tx_id;

    v_tx_ids := array_append(v_tx_ids, v_tx_id);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_ids', v_tx_ids,
    'total_amount', v_total_amount
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_transfer_funds(UUID[], NUMERIC[], TEXT[], TEXT, NUMERIC, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.log_transaction_insert_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ledger_events (
    source_table,
    source_id,
    event_type,
    actor_user_id,
    related_user_id,
    amount,
    status,
    note,
    payload,
    occurred_at
  )
  VALUES (
    'transactions',
    NEW.id,
    'transaction_created',
    NEW.sender_id,
    NEW.receiver_id,
    NEW.amount,
    NEW.status,
    COALESCE(NEW.note, ''),
    jsonb_build_object(
      'sender_id', NEW.sender_id,
      'receiver_id', NEW.receiver_id,
      'currency_code', COALESCE(NULLIF(TRIM(NEW.currency_code), ''), 'OUSD'),
      'sender_amount', COALESCE(NEW.sender_amount, NEW.amount),
      'sender_currency_code', COALESCE(NULLIF(TRIM(NEW.sender_currency_code), ''), COALESCE(NULLIF(TRIM(NEW.currency_code), ''), 'OUSD')),
      'receiver_amount', COALESCE(NEW.receiver_amount, NEW.amount),
      'receiver_currency_code', COALESCE(NULLIF(TRIM(NEW.receiver_currency_code), ''), COALESCE(NULLIF(TRIM(NEW.currency_code), ''), 'OUSD'))
    ),
    NEW.created_at
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_transaction_update_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.amount IS DISTINCT FROM OLD.amount
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.note IS DISTINCT FROM OLD.note THEN
    INSERT INTO public.ledger_events (
      source_table,
      source_id,
      event_type,
      actor_user_id,
      related_user_id,
      amount,
      status,
      note,
      payload,
      occurred_at
    )
    VALUES (
      'transactions',
      NEW.id,
      'transaction_updated',
      NEW.sender_id,
      NEW.receiver_id,
      NEW.amount,
      NEW.status,
      COALESCE(NEW.note, ''),
      jsonb_build_object(
        'old_amount', OLD.amount,
        'new_amount', NEW.amount,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'old_note', COALESCE(OLD.note, ''),
        'new_note', COALESCE(NEW.note, ''),
        'currency_code', COALESCE(NULLIF(TRIM(NEW.currency_code), ''), 'OUSD'),
        'sender_amount', COALESCE(NEW.sender_amount, NEW.amount),
        'sender_currency_code', COALESCE(NULLIF(TRIM(NEW.sender_currency_code), ''), COALESCE(NULLIF(TRIM(NEW.currency_code), ''), 'OUSD')),
        'receiver_amount', COALESCE(NEW.receiver_amount, NEW.amount),
        'receiver_currency_code', COALESCE(NULLIF(TRIM(NEW.receiver_currency_code), ''), COALESCE(NULLIF(TRIM(NEW.currency_code), ''), 'OUSD'))
      ),
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_user_topup_request_insert_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ledger_events (
    source_table,
    source_id,
    event_type,
    actor_user_id,
    related_user_id,
    amount,
    status,
    note,
    payload,
    occurred_at
  )
  VALUES (
    'user_topup_requests',
    NEW.id,
    'topup_request_created',
    NEW.user_id,
    NULL,
    NEW.amount,
    NEW.status,
    COALESCE(NEW.provider, ''),
    jsonb_build_object(
      'provider', NEW.provider,
      'payment_method', NEW.provider,
      'reference_code', NEW.reference_code,
      'proof_url', NEW.proof_url,
      'currency_code', 'OUSD',
      'sender_amount', NEW.amount,
      'sender_currency_code', 'OUSD',
      'receiver_amount', NEW.amount,
      'receiver_currency_code', 'OUSD'
    ),
    NEW.created_at
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_user_topup_request_update_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
    OR NEW.amount IS DISTINCT FROM OLD.amount
    OR NEW.reference_code IS DISTINCT FROM OLD.reference_code THEN
    INSERT INTO public.ledger_events (
      source_table,
      source_id,
      event_type,
      actor_user_id,
      related_user_id,
      amount,
      status,
      note,
      payload,
      occurred_at
    )
    VALUES (
      'user_topup_requests',
      NEW.id,
      'topup_request_updated',
      NEW.user_id,
      NULL,
      NEW.amount,
      NEW.status,
      COALESCE(NEW.provider, ''),
      jsonb_build_object(
        'provider', NEW.provider,
        'payment_method', NEW.provider,
        'reference_code', NEW.reference_code,
        'proof_url', NEW.proof_url,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'currency_code', 'OUSD',
        'sender_amount', NEW.amount,
        'sender_currency_code', 'OUSD',
        'receiver_amount', NEW.amount,
        'receiver_currency_code', 'OUSD'
      ),
      COALESCE(NEW.updated_at, now())
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_user_topup_requests_insert ON public.user_topup_requests;
CREATE TRIGGER trg_ledger_user_topup_requests_insert
AFTER INSERT ON public.user_topup_requests
FOR EACH ROW EXECUTE FUNCTION public.log_user_topup_request_insert_to_ledger();

DROP TRIGGER IF EXISTS trg_ledger_user_topup_requests_update ON public.user_topup_requests;
CREATE TRIGGER trg_ledger_user_topup_requests_update
AFTER UPDATE ON public.user_topup_requests
FOR EACH ROW EXECUTE FUNCTION public.log_user_topup_request_update_to_ledger();

CREATE OR REPLACE FUNCTION public.log_user_swap_withdrawal_insert_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ledger_events (
    source_table,
    source_id,
    event_type,
    actor_user_id,
    related_user_id,
    amount,
    status,
    note,
    payload,
    occurred_at
  )
  VALUES (
    'user_swap_withdrawals',
    NEW.id,
    'swap_withdrawal_created',
    NEW.user_id,
    NULL,
    NEW.amount,
    NEW.status,
    'Swap withdrawal',
    jsonb_build_object(
      'payment_method', 'Pi Wallet',
      'pi_wallet_address', NEW.pi_wallet_address,
      'openpay_account_number', NEW.openpay_account_number,
      'currency_code', 'PI',
      'sender_amount', NEW.amount,
      'sender_currency_code', 'OUSD',
      'receiver_amount', NEW.payout_amount,
      'receiver_currency_code', 'PI'
    ),
    NEW.created_at
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_user_swap_withdrawal_update_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
    OR NEW.amount IS DISTINCT FROM OLD.amount THEN
    INSERT INTO public.ledger_events (
      source_table,
      source_id,
      event_type,
      actor_user_id,
      related_user_id,
      amount,
      status,
      note,
      payload,
      occurred_at
    )
    VALUES (
      'user_swap_withdrawals',
      NEW.id,
      'swap_withdrawal_updated',
      NEW.user_id,
      NULL,
      NEW.amount,
      NEW.status,
      'Swap withdrawal',
      jsonb_build_object(
        'payment_method', 'Pi Wallet',
        'pi_wallet_address', NEW.pi_wallet_address,
        'openpay_account_number', NEW.openpay_account_number,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'currency_code', 'PI',
        'sender_amount', NEW.amount,
        'sender_currency_code', 'OUSD',
        'receiver_amount', NEW.payout_amount,
        'receiver_currency_code', 'PI'
      ),
      COALESCE(NEW.updated_at, now())
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_user_swap_withdrawals_insert ON public.user_swap_withdrawals;
CREATE TRIGGER trg_ledger_user_swap_withdrawals_insert
AFTER INSERT ON public.user_swap_withdrawals
FOR EACH ROW EXECUTE FUNCTION public.log_user_swap_withdrawal_insert_to_ledger();

DROP TRIGGER IF EXISTS trg_ledger_user_swap_withdrawals_update ON public.user_swap_withdrawals;
CREATE TRIGGER trg_ledger_user_swap_withdrawals_update
AFTER UPDATE ON public.user_swap_withdrawals
FOR EACH ROW EXECUTE FUNCTION public.log_user_swap_withdrawal_update_to_ledger();

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
  sender_amount NUMERIC,
  sender_currency_code TEXT,
  receiver_amount NUMERIC,
  receiver_currency_code TEXT,
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
    COALESCE(
      t.receiver_currency_code,
      t.currency_code,
      le.payload->>'receiver_currency_code',
      le.payload->>'currency_code',
      le.payload->>'currency',
      CASE
        WHEN le.source_table = 'wallets' THEN 'PI'
        WHEN le.source_table = 'user_swap_withdrawals' THEN 'PI'
        ELSE 'OUSD'
      END
    ) AS currency_code,
    COALESCE(t.sender_amount, NULLIF(le.payload->>'sender_amount', '')::numeric, le.amount) AS sender_amount,
    COALESCE(t.sender_currency_code, le.payload->>'sender_currency_code', le.payload->>'currency_code', 'OUSD') AS sender_currency_code,
    COALESCE(t.receiver_amount, NULLIF(le.payload->>'receiver_amount', '')::numeric, le.amount) AS receiver_amount,
    COALESCE(t.receiver_currency_code, le.payload->>'receiver_currency_code', le.payload->>'currency_code', 'OUSD') AS receiver_currency_code,
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
  WHERE le.source_table IN ('transactions', 'user_topup_requests', 'user_swap_withdrawals', 'wallets', 'payment_requests')
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
  sender_amount NUMERIC,
  sender_currency_code TEXT,
  receiver_amount NUMERIC,
  receiver_currency_code TEXT,
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
    COALESCE(
      t.receiver_currency_code,
      t.currency_code,
      le.payload->>'receiver_currency_code',
      le.payload->>'currency_code',
      le.payload->>'currency',
      CASE
        WHEN le.source_table = 'wallets' THEN 'PI'
        WHEN le.source_table = 'user_swap_withdrawals' THEN 'PI'
        ELSE 'OUSD'
      END
    ) AS currency_code,
    COALESCE(t.sender_amount, NULLIF(le.payload->>'sender_amount', '')::numeric, le.amount) AS sender_amount,
    COALESCE(t.sender_currency_code, le.payload->>'sender_currency_code', le.payload->>'currency_code', 'OUSD') AS sender_currency_code,
    COALESCE(t.receiver_amount, NULLIF(le.payload->>'receiver_amount', '')::numeric, le.amount) AS receiver_amount,
    COALESCE(t.receiver_currency_code, le.payload->>'receiver_currency_code', le.payload->>'currency_code', 'OUSD') AS receiver_currency_code,
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
  sender_amount NUMERIC,
  sender_currency_code TEXT,
  receiver_amount NUMERIC,
  receiver_currency_code TEXT,
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
    COALESCE(
      t.receiver_currency_code,
      t.currency_code,
      le.payload->>'receiver_currency_code',
      le.payload->>'currency_code',
      le.payload->>'currency',
      CASE
        WHEN le.source_table = 'wallets' THEN 'PI'
        WHEN le.source_table = 'user_swap_withdrawals' THEN 'PI'
        ELSE 'OUSD'
      END
    ) AS currency_code,
    COALESCE(t.sender_amount, NULLIF(le.payload->>'sender_amount', '')::numeric, le.amount) AS sender_amount,
    COALESCE(t.sender_currency_code, le.payload->>'sender_currency_code', le.payload->>'currency_code', 'OUSD') AS sender_currency_code,
    COALESCE(t.receiver_amount, NULLIF(le.payload->>'receiver_amount', '')::numeric, le.amount) AS receiver_amount,
    COALESCE(t.receiver_currency_code, le.payload->>'receiver_currency_code', le.payload->>'currency_code', 'OUSD') AS receiver_currency_code,
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
