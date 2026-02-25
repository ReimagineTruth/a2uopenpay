-- Master top up (internal credit) for @wainfoundation only
CREATE OR REPLACE FUNCTION public.master_topup_internal(
  p_amount NUMERIC,
  p_target_account_number TEXT DEFAULT NULL,
  p_target_username TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_admin_username TEXT;
  v_amount NUMERIC(12,2) := ROUND(COALESCE(p_amount, 0), 2);
  v_target_account TEXT := UPPER(TRIM(COALESCE(p_target_account_number, '')));
  v_target_username TEXT := LOWER(TRIM(COALESCE(p_target_username, '')));
  v_target_user_id UUID;
  v_user_balance NUMERIC(12,2);
  v_tx_id UUID;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT LOWER(COALESCE(username, ''))
  INTO v_admin_username
  FROM public.profiles
  WHERE id = v_admin_id;

  IF v_admin_username <> 'wainfoundation' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF v_amount < 1 THEN
    RAISE EXCEPTION 'Minimum top up is 1 OPEN USD';
  END IF;

  IF v_target_account = '' AND v_target_username = '' THEN
    RAISE EXCEPTION 'Target account number or username is required';
  END IF;

  SELECT ua.user_id
  INTO v_target_user_id
  FROM public.user_accounts ua
  WHERE (v_target_account <> '' AND UPPER(ua.account_number) = v_target_account)
     OR (v_target_username <> '' AND LOWER(ua.account_username) = v_target_username)
  LIMIT 1;

  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target account not found';
  END IF;

  SELECT balance
  INTO v_user_balance
  FROM public.wallets
  WHERE user_id = v_target_user_id
  FOR UPDATE;

  IF v_user_balance IS NULL THEN
    RAISE EXCEPTION 'User wallet not found';
  END IF;

  UPDATE public.wallets
  SET balance = v_user_balance + v_amount,
      updated_at = now()
  WHERE user_id = v_target_user_id;

  INSERT INTO public.transactions (sender_id, receiver_id, amount, note, status)
  VALUES (
    v_target_user_id,
    v_target_user_id,
    v_amount,
    '[internal] Master top up',
    'completed'
  )
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

REVOKE ALL ON FUNCTION public.master_topup_internal(NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.master_topup_internal(NUMERIC, TEXT, TEXT) TO authenticated;
